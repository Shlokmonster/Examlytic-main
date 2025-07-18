import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import Peer from 'peerjs';
import { FaVideo, FaVideoSlash, FaDesktop } from 'react-icons/fa';
import { useReactMediaRecorder } from 'react-media-recorder';

export default function ExamAttempt() {
  const { id: examId } = useParams()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [exam, setExam] = useState(null)
  const [timeLeft, setTimeLeft] = useState(5400)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const videoRef = useRef()
  const screenRecorderRef = useRef()
  const screenChunks = useRef([])
  const peerRef = useRef(null)
  const streamRef = useRef(null)
  const [peerId] = useState(`student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const adminPeerId = 'admin-dashboard';
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [recordingUrl, setRecordingUrl] = useState(null);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0')
    }
  }

  const { hours, minutes, seconds } = formatTime(timeLeft)

  // Clean up resources
  const cleanupResources = useCallback(() => {
    console.log('Cleaning up resources...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  }, []);

  // Constants for upload configuration
  const MAX_RETRIES = 3;
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const UPLOAD_TIMEOUT = 30000; // 30 seconds
  const CONCURRENCY = 3; // Number of parallel uploads
  
  // Configure react-media-recorder with optimized settings
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingReady, setRecordingReady] = useState(false);
  
  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl,
    error: recordingError
  } = useReactMediaRecorder({
    screen: true,
    video: {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 10, max: 15 }
    },
    // Use audio constraints instead of audioBitsPerSecond for better compatibility
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    },
    // Use a more compatible mime type
    mimeType: 'video/webm',
    // Add constraints to control quality without using bitrate
    mediaRecorderOptions: {
      audioBitsPerSecond: 32000,
      videoBitsPerSecond: 1000000, // 1Mbps
      bitsPerSecond: 1032000 // Total bitrate (1000kbps video + 32kbps audio)
    },
    onStop: (blobUrl, blob) => {
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
      console.log(`Recording stopped, size: ${sizeInMB}MB`);
      setRecordingBlob(blob);
      setRecordingUrl(blobUrl);
      setRecordingReady(true);
      console.log('Recording blob is ready for upload');
    }
  });
  
  // Log recording status changes and handle cleanup
  useEffect(() => {
    console.log('Recording status:', status);
    if (recordingError) {
      console.error('Recording error:', recordingError);
      setError('Recording error: ' + recordingError.message);
    }
    
    // Reset recording ready state when starting a new recording
    if (status === 'recording') {
      setRecordingReady(false);
    }
    
    // Cleanup function
    return () => {
      if (mediaBlobUrl) {
        URL.revokeObjectURL(mediaBlobUrl);
      }
    };
  }, [status, recordingError, mediaBlobUrl]);

  // Update isRecording state based on status
  useEffect(() => {
    if (status === 'recording') {
      setIsRecording(true);
    } else if (status === 'stopped' || status === 'idle') {
      setIsRecording(false);
    }
    
    if (recordingError) {
      console.error('Recording error:', recordingError);
      setError('Recording error: ' + recordingError);
    }
  }, [status, recordingError]);

  // Initialize PeerJS connection with reconnection logic
  const setupPeerConnection = useCallback(async () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setConnectionStatus('Failed to connect after multiple attempts. Please refresh the page.');
      return;
    }

    try {
      const peer = new Peer(peerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 3,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('open', (id) => {
        console.log('Connected to PeerJS server with ID:', id);
        setConnectionStatus('Connected to server');
        reconnectAttempts.current = 0; // Reset reconnect attempts
        connectToAdmin(peer);
      });

      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
          // If ID is taken, we'll get a new ID in the next attempt
          setConnectionStatus('ID conflict. Reconnecting...');
        } else {
          setConnectionStatus(`Connection error: ${err.message}. Retrying...`);
        }
        reconnectAttempts.current++;
        setTimeout(setupPeerConnection, 2000);
      });

      peer.on('disconnected', () => {
        console.log('Disconnected from server. Reconnecting...');
        setConnectionStatus('Disconnected. Reconnecting...');
        peer.reconnect();
      });

      peerRef.current = peer;
    } catch (error) {
      console.error('Error initializing PeerJS:', error);
      setConnectionStatus(`Error: ${error.message}. Retrying...`);
      reconnectAttempts.current++;
      setTimeout(setupPeerConnection, 2000);
    }
  }, [peerId]);

  // Start screen share and call admin
const startScreenShareAndCallAdmin = async (peer) => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
        logicalSurface: true,
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 15, max: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });
    streamRef.current = stream;
    setIsScreenSharing(true);
    setConnectionStatus('Screen sharing active');
    // Call the admin with the screen stream
    const call = peer.call(adminPeerId, stream, { metadata: { type: 'screen-share' } });
    call.on('close', () => {
      setIsScreenSharing(false);
      setConnectionStatus('Screen sharing ended by admin');
    });
    call.on('error', (err) => {
      setIsScreenSharing(false);
      setConnectionStatus('Screen sharing error');
    });
  } catch (err) {
    setConnectionStatus('Screen sharing permission denied or failed');
  }
};

// Connect to admin dashboard
const connectToAdmin = (peer) => {
  try {
    console.log('Connecting to admin...');
    setConnectionStatus('Connecting to admin...');
    
    const conn = peer.connect(adminPeerId, {
      reliable: true,
      serialization: 'json'
    });

    conn.on('open', () => {
      console.log('Connected to admin dashboard');
      setConnectionStatus('Connected to admin');
      
      // Send student info to admin
      conn.send({
        type: 'student-info',
        studentId: peer.id,
        examId: examId,
        studentName: 'Student' // Replace with actual student name
      });

      // Set up call handling
      setupCallHandling(peer);
      startScreenShareAndCallAdmin(peer);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setConnectionStatus('Connection error. Retrying...');
      setTimeout(() => connectToAdmin(peer), 2000);
    });

    conn.on('close', () => {
      console.log('Connection to admin closed');
      setConnectionStatus('Disconnected from admin. Reconnecting...');
      setTimeout(() => connectToAdmin(peer), 2000);
    });
  } catch (err) {
    console.error('Error connecting to admin:', err);
    setConnectionStatus('Error connecting to admin. Retrying...');
    setTimeout(() => connectToAdmin(peer), 2000);
  }
};

  // Handle incoming calls from admin
  const setupCallHandling = (peer) => {
    console.log('Setting up call handling...');
    
    peer.on('call', async (call) => {
      console.log('Received call from admin:', call.metadata);
      setConnectionStatus('Admin requested screen sharing...');
      
      try {
        // Stop any existing stream
        if (streamRef.current) {
          stopAllTracks(streamRef.current);
          streamRef.current = null;
        }
        
        // Request screen sharing with specific constraints
        let stream;
        try {
          // First try with system audio if available
          const constraints = {
            video: {
              displaySurface: 'monitor',
              logicalSurface: true,
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 15, max: 30 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            },
            systemAudio: 'include', // Try to include system audio if possible
            selfBrowserSurface: 'exclude', // Don't show the current tab as an option
            surfaceSwitching: 'include', // Allow switching between screens/windows
            preferCurrentTab: false // Don't default to the current tab
          };
          
          console.log('Requesting screen sharing with constraints:', JSON.stringify(constraints, null, 2));
          
          stream = await navigator.mediaDevices.getDisplayMedia(constraints).catch(err => {
            console.warn('Error with system audio, trying without:', err);
            // Fallback to simpler constraints if the first attempt fails
            return navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
            });
          });
          
          // Log the actual constraints that were applied
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            console.log('Using video settings:', {
              width: videoTrack.getSettings().width,
              height: videoTrack.getSettings().height,
              frameRate: videoTrack.getSettings().frameRate,
              deviceId: videoTrack.getSettings().deviceId,
              displaySurface: videoTrack.getSettings().displaySurface
            });
          }
          
        } catch (err) {
          console.error('Error getting display media:', err);
          setConnectionStatus('Screen sharing permission denied or failed');
          call.close();
          return;
        }
        
        if (!stream) {
          console.error('Failed to get display media');
          setConnectionStatus('Failed to access screen');
          call.close();
          return;
        }
        // ADD THIS CHECK
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks.length || videoTracks[0].readyState !== 'live') {
          console.warn('Screen stream is not live or has no video tracks.');
          setConnectionStatus('Screen stream is not live or has no video tracks.');
          stopAllTracks(stream);
          call.close();
          return;
        }
        streamRef.current = stream;
        setIsScreenSharing(true);
        setConnectionStatus('Screen sharing active');
        
        // Answer the call with our stream
        console.log('Answering call with stream:', stream.id);
        try {
          call.answer(stream);
          
          // Log stream information
          console.log('Stream tracks:', stream.getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted,
            settings: t.getSettings ? t.getSettings() : {}
          })));
          
          // Set up call event handlers
          call.on('stream', (remoteStream) => {
            console.log('Received remote stream from admin');
          });
          
          call.on('close', () => {
            console.log('Call ended by admin');
            setIsScreenSharing(false);
            setConnectionStatus('Screen sharing ended by admin');
            stopAllTracks(stream);
          });
          
          call.on('error', (err) => {
            console.error('Call error:', err);
            setIsScreenSharing(false);
            setConnectionStatus('Screen sharing error');
            stopAllTracks(stream);
          });

          // Handle track ended (user stops sharing)
          stream.getTracks().forEach(track => {
            const onTrackEnded = () => {
              console.log('Screen sharing track ended:', track.kind);
              track.onended = null; // Prevent multiple calls
              setIsScreenSharing(false);
              setConnectionStatus('Screen sharing ended by user');
              stopAllTracks(stream);
            };
            track.onended = onTrackEnded;
          });
          
        } catch (err) {
          console.error('Error answering call:', err);
          setConnectionStatus('Failed to start screen sharing');
          stopAllTracks(stream);
          call.close();
        }
        
      } catch (err) {
        console.error('Error in call handling:', err);
        setConnectionStatus('Screen sharing error');
        if (streamRef.current) {
          stopAllTracks(streamRef.current);
          streamRef.current = null;
        }
        try {
          call.close();
        } catch (e) {
          console.error('Error closing call:', e);
        }
      }
    });
  };

  // Stop all tracks in a stream
  const stopAllTracks = (stream) => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.onended = null;
      });
    }
  };

  // Set up webcam stream
  const setupWebcamStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 24 }
        }, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute to prevent echo
        streamRef.current = stream;
      }
      return stream;
    } catch (err) {
      console.error("Webcam error:", err);
      setConnectionStatus('Webcam access denied. Some features may not work.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!examId) {
      navigate('/exams')
      return
    }

    const fetchExam = async () => {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .single()

        if (error) throw error
        setExam(data)
        setQuestions(data.questions)
        setTimeLeft(data.duration * 60)
        setIsLoading(false)

        // Start screen recording when exam loads
        startRecording();
      } catch (error) {
        console.error('Error fetching exam:', error)
        setError('Failed to load exam. Please try again.')
        setIsLoading(false)
      }
    }

    fetchExam()
  }, [examId, navigate]);

  useEffect(() => {
    const loadExam = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single()
        if (examError) throw examError

        setExam(examData)
        if (examData.questions && Array.isArray(examData.questions)) {
          const formattedQuestions = examData.questions.map((q, index) => ({
            id: q.id || `q-${index}`,
            question_text: q.question || q.question_text || '',
            options: q.type === 'mcq' ? [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) : [],
            correct_answer: q.correct_answer,
            marks: q.marks || 1,
            type: q.type || 'mcq',
          }))
          setQuestions(formattedQuestions)
          const initialAnswers = {}
          formattedQuestions.forEach(q => initialAnswers[q.id] = '')
          setAnswers(initialAnswers)
          setTimeLeft((examData.duration_minutes || 90) * 60)
        } else {
          setError('No questions found in this exam.')
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load exam.')
      } finally {
        setIsLoading(false)
      }
    }

    const setupWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        console.error("Webcam error:", err)
      }
    }

    // Function to get the best supported MIME type
    const getSupportedMimeType = () => {
      const types = [
        'video/mp4;codecs=h264,aac',  // MP4 with H.264 video and AAC audio
        'video/webm;codecs=h264,opus', // WebM with H.264 video and Opus audio
        'video/webm;codecs=vp9,opus',  // WebM with VP9 video and Opus audio
        'video/webm;codecs=vp8,opus',  // WebM with VP8 video and Opus audio
        'video/webm'                   // Fallback to default WebM
      ];

      return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    };

    const handleTabSwitch = () => alert("Tab switch detected! This will be reported.")
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) handleTabSwitch()
    })

    loadExam();
    
    // Initialize WebRTC and screen recording
    const init = async () => {
      try {
        await setupWebcamStream();
        await setupPeerConnection();
      } catch (error) {
        console.error('Initialization error:', error);
        setConnectionStatus(`Error: ${error.message}`);
      }
    };
    
    init();
    
    // Set up periodic status updates
    const statusInterval = setInterval(() => {
      if (peerRef.current && !peerRef.current.disconnected) {
        setConnectionStatus(prev => {
          if (!prev.includes('Connected')) {
            return 'Connected to admin';
          }
          return prev;
        });
      }
    }, 10000);

    return () => {
      document.removeEventListener("visibilitychange", () => {
        if (document.hidden) handleTabSwitch()
      });
      
      // Clean up resources
      cleanupResources();
      clearInterval(statusInterval);
      
      // Stop screen recording if active
      if (status === 'recording') {
        stopRecording();
      }
      // Clean up peer connection
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.destroy();
      }
    }
  }, [examId])

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit()
      return
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const handleOptionChange = (questionId, selectedOption) => {
    setAnswers(prev => ({ ...prev, [questionId]: selectedOption }))
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1)
    else handleSubmit()
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1)
  }

  const [attemptId, setAttemptId] = useState(null);
  const [logs, setLogs] = useState([]);

  // Log event locally and to Supabase
  const logEvent = async (eventType, eventDetails = {}) => {
    setLogs(prev => [...prev, { eventType, eventDetails, timestamp: new Date().toISOString() }]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('exam_logs').insert([
        {
          exam_attempt_id: attemptId,
          student_id: userData?.user?.id,
          event_type: eventType,
          event_details: eventDetails,
        }
      ]);
    } catch (err) {
      console.error('Log error:', err);
    }
  };

  // Anti-cheating hooks
  useEffect(() => {
    // Tab switch
    const handleTabSwitch = () => {
      logEvent('tab_switch', {});
      alert('Tab switch detected! This will be reported.');
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) handleTabSwitch();
    });
    // Fullscreen exit
    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        logEvent('fullscreen_exit', {});
        alert('Fullscreen exited! This will be reported.');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    // Copy/cut/paste
    const preventCopy = e => { e.preventDefault(); logEvent('copy_cut_paste', { type: e.type }); };
    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('paste', preventCopy);
    // Right-click
    // const preventContext = e => { e.preventDefault(); logEvent('context_menu', {}); };
    // document.addEventListener('contextmenu', preventContext);
    // Window blur
    const handleBlur = () => { logEvent('window_blur', {}); };
    window.addEventListener('blur', handleBlur);
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleTabSwitch);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('paste', preventCopy);
      // document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('blur', handleBlur);
    };
  }, [attemptId]);

  // Function to calculate score
  const calculateScore = (answers, questions) => {
    if (!answers || !questions || !questions.length) return 0;
    let correct = 0;
    questions.forEach((q, index) => {
      if (q.correct_answer === answers[q.id]) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  // Function to upload blob with chunked upload support
  const uploadBlob = async (blob, userId) => {
    if (!blob) {
      console.warn('No recording blob available');
      return null;
    }

    const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log('Starting upload of', sizeInMB, 'MB recording...');
    setUploadProgress(0);

    try {
      // Verify Supabase client is properly initialized
      if (!supabase) {
        throw new Error('Supabase client is not properly initialized');
      }

      // Verify storage is accessible
      const { data: bucketList, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        console.error('Error accessing storage:', bucketError);
        throw new Error('Failed to access storage. Please check your connection and try again.');
      }
      
      console.log('Available buckets:', bucketList);
      
      const bucketExists = bucketList.some(bucket => bucket.name === 'exam-recordings');
      if (!bucketExists) {
        console.error('Bucket "exam-recordings" does not exist');
        throw new Error('Storage configuration error. The "exam-recordings" bucket is missing.');
      }

      // Check file size before upload (40MB threshold to leave buffer)
      const MAX_SIZE_MB = 40;
      if (blob.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Recording size (${sizeInMB}MB) exceeds ${MAX_SIZE_MB}MB limit.`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${userId}/recording-${timestamp}-${Date.now()}.webm`;
      
      console.log('Uploading to file:', fileName);
      
      // For small files, upload directly
      if (blob.size <= CHUNK_SIZE * 2) {
        console.log('File is small, uploading directly...');
        try {
          console.log('Uploading file to Supabase storage...');
          console.log('File details:', {
            name: fileName,
            size: blob.size,
            type: blob.type
          });
          
          // Convert blob to File object if it isn't already
          const file = blob instanceof File ? blob : new File([blob], fileName, { type: 'video/webm' });
          
          console.log('Uploading file to bucket: exam-recordings');
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('exam-recordings')
            .upload(fileName, file, {
              contentType: 'video/webm',
              cacheControl: '3600',
              upsert: true,
              duplex: 'half',
              onUploadProgress: (progress) => {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Upload progress: ${percent}%`);
                setUploadProgress(percent);
              }
            });
            
          if (uploadError) {
            console.error('Upload error details:', {
              message: uploadError.message,
              status: uploadError.statusCode || 'N/A',
              error: uploadError.error || 'No additional error info',
              stack: uploadError.stack
            });
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          
          console.log('Upload successful. Data:', uploadData);
          
          if (!uploadData || !uploadData.path) {
            throw new Error('Upload succeeded but no file path was returned');
          }
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('exam-recordings')
            .getPublicUrl(uploadData.path);
            
          if (!publicUrl) {
            throw new Error('Failed to generate public URL for the uploaded file');
          }
          
          console.log('Direct upload complete. Public URL:', publicUrl);
          setUploadProgress(100);
          return publicUrl;
          
        } catch (uploadError) {
          console.error('Detailed upload error:', {
            name: uploadError.name,
            message: uploadError.message,
            stack: uploadError.stack,
            code: uploadError.code
          });
          throw new Error(`Failed to upload recording: ${uploadError.message}`);
        }
      }

      // For larger files, use chunked upload
      console.log('Starting chunked upload...');
      const chunkCount = Math.ceil(blob.size / CHUNK_SIZE);
      let uploadedChunks = 0;
      
      // Upload chunks with retries
      const uploadChunk = async (chunk, chunkIndex) => {
        let retryCount = 0;
        
        while (retryCount <= MAX_RETRIES) {
          try {
            const chunkName = `${fileName}.part${chunkIndex}`;
            const chunkBlob = blob.slice(
              chunkIndex * CHUNK_SIZE,
              Math.min(blob.size, (chunkIndex + 1) * CHUNK_SIZE)
            );
            
            const { error } = await supabase.storage
              .from('exam-recordings')
              .upload(chunkName, chunkBlob, {
                contentType: 'video/webm',
                cacheControl: '3600',
                upsert: false
              });
              
            if (error) throw error;
            
            uploadedChunks++;
            const progress = Math.round((uploadedChunks / chunkCount) * 100);
            setUploadProgress(progress);
            console.log(`Upload progress: ${progress}% (${uploadedChunks}/${chunkCount} chunks)`);
            
            return true;
          } catch (chunkError) {
            retryCount++;
            if (retryCount > MAX_RETRIES) {
              console.error(`Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} attempts:`, chunkError);
              throw new Error(`Failed to upload chunk ${chunkIndex}: ${chunkError.message}`);
            }
            console.warn(`Retrying chunk ${chunkIndex}, attempt ${retryCount}/${MAX_RETRIES}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          }
        }
      };
      
      // Upload chunks with concurrency control
      for (let i = 0; i < chunkCount; i += CONCURRENCY) {
        const chunkBatch = [];
        for (let j = 0; j < CONCURRENCY && i + j < chunkCount; j++) {
          chunkBatch.push(uploadChunk(null, i + j));
        }
        await Promise.all(chunkBatch);
      }
      
      console.log('All chunks uploaded, finalizing...');
      
      // Final upload of the complete file
      const { data, error } = await supabase.storage
        .from('exam-recordings')
        .upload(fileName, blob, {
          contentType: 'video/webm',
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('exam-recordings')
        .getPublicUrl(fileName);
      
      console.log('Upload successful! URL:', publicUrl);
      setUploadProgress(100);
      return publicUrl;
      
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // On submit, save answers and all logs
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to submit the exam? You cannot change your answers after submission.")) return;
    setIsSubmitting(true);
    setError(null);

    let recordingUrl = null;
    let uploadWarning = null;
    let user = null;
    let examQuestions = [];

    try {
      // Get the current authenticated user
      const userResult = await supabase.auth.getUser();
      user = userResult?.data?.user;
      if (!user || userResult.error) {
        throw new Error('User not authenticated');
      }

      // Get the current exam object for questions
      examQuestions = exam?.questions || [];

      // Stop screen recording if it's active
      if (status === 'recording') {
        setRecordingReady(false);
        stopRecording();
        try {
          // Wait for the recording to be processed
          const blob = await new Promise((resolve, reject) => {
            let timeout;
            let checkInterval;
            let attempt = 0;
            const MAX_ATTEMPTS = 50;
            const cleanup = () => {
              clearTimeout(timeout);
              clearInterval(checkInterval);
            };
            timeout = setTimeout(() => {
              cleanup();
              reject(new Error('Timeout waiting for recording data (15s elapsed)'));
            }, 15000);
            if (recordingReady && recordingBlob) {
              cleanup();
              return resolve(recordingBlob);
            }
            checkInterval = setInterval(() => {
              attempt++;
              if (recordingReady && recordingBlob) {
                cleanup();
                resolve(recordingBlob);
              } else if (status === 'stopped' && !recordingReady) {
                cleanup();
                reject(new Error('Recording stopped but data not ready'));
              } else if (attempt >= MAX_ATTEMPTS) {
                cleanup();
                reject(new Error('Max attempts reached waiting for recording data'));
              }
            }, 300);
            return () => cleanup();
          });

          if (blob) {
            setUploadProgress(0);
            setIsUploading(true);
            try {
              const uploadPromise = uploadBlob(blob, user.id);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Upload timed out after 30 seconds')), UPLOAD_TIMEOUT)
              );
              recordingUrl = await Promise.race([uploadPromise, timeoutPromise]);
              if (!recordingUrl) {
                throw new Error('Upload completed but no URL was returned');
              }
              // Save the recording URL to exam_attempts
              try {
                const { data: attemptData, error: fetchError } = await supabase
                  .from('exam_attempts')
                  .select('*')
                  .eq('exam_id', examId)
                  .eq('student_id', user.id)
                  .single();
                if (fetchError) throw new Error('Could not find exam attempt to update');
                const updateData = {
                  recording_url: recordingUrl,
                  updated_at: new Date().toISOString(),
                  ...attemptData,
                  exam_id: attemptData.exam_id,
                  student_id: attemptData.student_id,
                  started_at: attemptData.started_at
                };
                const { error: updateError } = await supabase
                  .from('exam_attempts')
                  .update(updateData)
                  .eq('id', attemptData.id)
                  .select();
                if (updateError) {
                  uploadWarning = 'Warning: Exam submitted but recording URL could not be saved. Please inform your instructor.';
                }
              } catch (updateError) {
                uploadWarning = 'Warning: Exam submitted but recording URL could not be saved. Please inform your instructor.';
              }
            } catch (uploadError) {
              uploadWarning = `Warning: Could not save recording. Your answers have been submitted, but please inform your instructor.`;
            }
          }
        } catch (uploadError) {
          uploadWarning = `Warning: Could not save recording. Your answers have been submitted, but please inform your instructor.`;
        } finally {
          setUploadProgress(0);
          setIsUploading(false);
        }
      }

      // Save answers (always, even if recording upload failed)
      try {
        const updateFields = {
          answers: answers,
          submitted_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          score: calculateScore(answers, examQuestions),
        };
        if (recordingUrl) updateFields.recording_url = recordingUrl;
        const { data: updated, error: updateError } = await supabase
           .from('exam_attempts')
           .update(updateFields)
           .eq('exam_id', examId)
           .eq('student_id', user.id)
           .select();

         if (updateError || !updated || updated.length === 0) {
           // No existing attempt row – insert instead
           const insertFields = {
             exam_id: examId,
             student_id: user.id,
             ...updateFields,
           };
           const { error: insertError } = await supabase
             .from('exam_attempts')
             .insert([insertFields]);
           if (insertError) {
             setError('Warning: Could not save your answers to the server. Please inform your instructor.');
           }
         }
      } catch (err) {
        setError('Warning: Could not fully save your answers. Please inform your instructor.');
      }
    } catch (error) {
      setError('Failed to submit exam. Please try again.');
    } finally {
      // Always redirect, passing any warning
      navigate(`/exam/${examId}/done`, {
        state: {
          examId,
          answers,
          questions: examQuestions,
          score: calculateScore(answers, examQuestions),
          totalQuestions: examQuestions.length,
          warning: uploadWarning,
        }
      });
      setIsSubmitting(false);
    }
  };

  
  const currentQuestion = questions[currentQuestionIndex] || {}

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  // Status indicator component with improved styling and animations
  const StatusIndicator = () => {
    // Determine status color based on connection state
    const getStatusColor = () => {
      if (connectionStatus.includes('Connected') || isScreenSharing) return '#4CAF50';
      if (connectionStatus.includes('error') || connectionStatus.includes('Error')) return '#f44336';
      if (connectionStatus.includes('Connecting') || connectionStatus.includes('Reconnecting')) return '#FFC107';
      return '#9E9E9E';
    };

    // Get status text based on screen sharing state
    const getStatusText = () => {
      if (isScreenSharing) return 'Screen Sharing Active';
      if (connectionStatus.includes('Connected')) return 'Connected';
      if (connectionStatus.includes('Connecting')) return 'Connecting...';
      if (connectionStatus.includes('Reconnecting')) return 'Reconnecting...';
      return 'Disconnected';
    };

    // Get status description
    const getStatusDescription = () => {
      if (isScreenSharing) return 'Your screen is being shared with the proctor';
      if (connectionStatus.includes('Connected')) return 'Ready to share screen when requested';
      if (connectionStatus.includes('error') || connectionStatus.includes('Error')) {
        return connectionStatus;
      }
      return 'Waiting for connection...';
    };

    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px 18px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderLeft: `4px solid ${getStatusColor()}`,
        maxWidth: '320px',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: getStatusColor(),
          flexShrink: 0,
          position: 'relative',
          animation: connectionStatus.includes('Connecting') || connectionStatus.includes('Reconnecting') 
            ? 'pulse 2s infinite' : 'none'
        }}>
          {/* Pulsing animation for connecting state */}
          <style>{
            `@keyframes pulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.5); opacity: 0.7; }
              100% { transform: scale(1); opacity: 1; }
            }`
          }</style>
        </div>
        <div>
          <div style={{ 
            fontWeight: 600,
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>Proctoring Status:</span>
            <span style={{ color: getStatusColor() }}>
              {getStatusText()}
            </span>
          </div>
          <div style={{ 
            fontSize: '12px', 
            opacity: 0.9,
            lineHeight: '1.4'
          }}>
            {getStatusDescription()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="exam-ui-new">
      {/* Status indicator */}
      <StatusIndicator />
      
      {/* Hidden video element for webcam preview */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        style={{ 
          position: 'fixed',
          width: '160px',
          height: '120px',
          bottom: '20px',
          left: '20px',
          borderRadius: '8px',
          border: '2px solid #ddd',
          zIndex: 1000,
          transform: 'scaleX(-1)', // Mirror the video
          opacity: 0.7,
          display: 'none' // Hide but keep it in the DOM for streaming
        }}
      />
      
      <style>{`
        body { background:white; }
        .exam-ui-new { min-height: 90vh; background:white; }
        .exam-container-new {
          max-width: 1200px;
          margin: 10px auto 0 auto;
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.07);
          padding: 36px 36px 48px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .webcam-preview-new {
          width: 900px;
          height: 500px;
          object-fit: cover;
          border-radius: 16px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.10);
          margin-bottom: 30px;
        }
        .top-controls-new {
          width: 100%;
          display: flex;
          justify-content: space-around;
          align-items: center;
          gap: 350px;
          margin-bottom: 40px;
        }
        .exit-btn-new {
          background: #f2f4f8;
          border: 1.5px solid #e0e6ed;
          border-radius: 8px;
          padding: 15px 25px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .exit-btn-new:hover {
          background:white;
        }
        .completed-badge-new {
          background: #2b7cff;
          color:black;
          font-weight: 600;
          border-radius: 8px;
           padding: 15px 25px;
          font-size: 15px;
        }
        .timer-section-new {
          display: flex;
          gap: 24px;
          margin: 0 0 32px 0;
        }
        .timer-box-new {
          background: #f2f4f8;
          border-radius: 12px;
          padding: 20px 100px;
          text-align: center;
          min-width: 90px;
        }
        .timer-value-new {
          font-size: 1.5rem;
          font-weight: 700;
          color:black;
        }
        .timer-label-new {
          font-size: 1rem;
          color: #7a869a;
          margin-top: 2px;
        }
        .questions-scroll-new {
          width: 100%;
          max-height: 330px;
          overflow-y: auto;
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          
        }
        .question-card-new {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 2px 12px rgba(43,124,255,0.06);
          padding: 24px 28px 18px 28px;
          margin-bottom: 0;
        }
        .question-title-new {
          font-size: 1.18rem;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .question-text-new {
          font-size: 1.08rem;
          color: #222;
          margin-bottom: 18px;
        }
        .options-new {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .option-new {
          background: #f7fafd;
          border: 1.5px solid #e0e6ed;
          border-radius: 8px;
          padding: 12px 18px;
          font-size: 1.08rem;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: border 0.2s, background 0.2s;
        }
        .option-new input[type="radio"] {
          accent-color: #2b7cff;
          width: 18px;
          height: 18px;
        }
        .option-new.selected {
          border: 2px solid #2b7cff;
          background: #eaf2ff;
        }
        .text-answer-box {
          width: 100%;
          min-height: 44px;
          border-radius: 8px;
          border: 1.5px solid #e0e6ed;
          background: #f7fafd;
          font-size: 1.08rem;
          padding: 10px 14px;
          margin-top: 8px;
          margin-bottom: 8px;
          resize: vertical;
          transition: border 0.2s;
        }
        .text-answer-box:focus {
          border: 2px solid #2b7cff;
          outline: none;
          background: #eaf2ff;
        }
        @media (max-width: 700px) {
          .exam-container-new { padding: 12px; }
          .webcam-preview-new { width: 100%; height: 180px; }
          .timer-section-new { gap: 8px; }
          .timer-box-new { padding: 10px 8px; min-width: 60px; }
        }
      `}</style>
      <Navbar />
      <div className="exam-container-new">
        <div className="webcam-preview-wrapper">
          <video ref={videoRef} autoPlay muted className="webcam-preview-new" />
        </div>
        <div className="top-controls-new">
          <button onClick={handleSubmit} disabled={isSubmitting} className="exit-btn-new">Submit Test</button>
          <span className="completed-badge-new">Completed: {Object.values(answers).filter(Boolean).length}/{questions.length}</span>
        </div>
        <div className="timer-section-new">
          <div className="timer-box-new">
            <div className="timer-value-new">{hours}</div>
            <div className="timer-label-new">Hours</div>
          </div>
          <div className="timer-box-new">
            <div className="timer-value-new">{minutes}</div>
            <div className="timer-label-new">Minutes</div>
          </div>
          <div className="timer-box-new">
            <div className="timer-value-new">{seconds}</div>
            <div className="timer-label-new">Seconds</div>
          </div>
        </div>
        <div className="questions-scroll-new">
          {questions.map((q, idx) => (
            <div className="question-card-new" key={q.id}>
              <div className="question-title-new">Exam Question {idx + 1}</div>
              <div className="question-text-new">{q.question_text}</div>
              {q.type === 'mcq' ? (
                <div className="options-new">
                  {q.options?.map((opt, oidx) => {
                    const letter = String.fromCharCode(65 + oidx);
                    const selected = answers[q.id] === letter;
                    return (
                      <label key={oidx} className={`option-new${selected ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name={q.id}
                          value={letter}
                          checked={selected}
                          onChange={() => handleOptionChange(q.id, letter)}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  className="text-answer-box"
                  value={answers[q.id] || ''}
                  onChange={e => handleOptionChange(q.id, e.target.value)}
                  placeholder="Type your answer here..."
                  rows={3}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// Place this at the very top, before your component definition
const examAttemptStyles = `
.exam-ui {
  background: #f9fbfd;
  font-family: 'Segoe UI', sans-serif;
  min-height: 100vh;
  padding: 2rem 0;
}
.exam-container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}
.video-section {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  width: 100%;
  height: 260px;
  background: #f3f6fa;
  display: flex;
  align-items: center;
  justify-content: center;
}
.webcam-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}
.top-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.exit-btn {
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  padding: 8px 18px;
  font-weight: 500;
  font-size: 15px;
  cursor: pointer;
  color: #222;
  transition: background 0.2s;
}
.exit-btn:hover {
  background: #e0e0e0;
}
.completed-badge {
  background: #eaf4ff;
  color: #1976d2;
  border-radius: 8px;
  padding: 6px 18px;
  font-weight: 600;
  font-size: 16px;
}
.timer-section {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 32px;
}
.timer-box {
  background: #f3f6fa;
  border-radius: 12px;
  padding: 18px 36px;
  text-align: center;
  min-width: 90px;
}
.timer-value {
  font-size: 28px;
  font-weight: 700;
}
.timer-label {
  font-size: 15px;
  color: #888;
  margin-top: 4px;
}
.questions-scroll {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-height: 350px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  margin-bottom: 24px;
}
.question-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  padding: 2rem 2.5rem;
  margin-bottom: 24px;
  width: 100%;
  max-width: 420px;
  scroll-snap-align: start;
  border: 1.5px solid #f0f4f9;
}
.question-card h3 {
  font-size: 19px;
  font-weight: bold;
  margin-bottom: 0.5rem;
}
.question-card p {
  font-size: 16px;
  margin-bottom: 1.5rem;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}
.option {
  background: #f0f4f9;
  border: 2px solid transparent;
  padding: 1rem;
  border-radius: 10px;
  font-size: 16px;
  transition: all 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.option input {
  margin-right: 0.75rem;
}
.option:hover {
  background: #dbe9f7;
}
.option input:checked + span {
  font-weight: bold;
}
.status-bar {
  margin-top: 24px;
  color: #1976d2;
  font-size: 15px;
  text-align: left;
}
`;

if (typeof document !== 'undefined' && !document.getElementById('exam-attempt-inline-style')) {
  const style = document.createElement('style');
  style.id = 'exam-attempt-inline-style';
  style.innerHTML = examAttemptStyles;
  document.head.appendChild(style);
}
