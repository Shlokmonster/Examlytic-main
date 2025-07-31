import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import Peer from 'peerjs';
import { FaVideo, FaVideoSlash, FaDesktop, FaExclamationTriangle } from 'react-icons/fa';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { uploadToCloudinary } from "../utils/cloudinary";

// Function to log exam events
const logExamEvent = async (examAttemptId, studentId, eventType, eventDetails = {}) => {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    examAttemptId,
    studentId,
    eventType,
    ...eventDetails
  };
  
  // Log to console for debugging
  console.log(`[Exam Monitor] ${eventType}`, logData);
  
  try {
    // Log to Supabase
    const { data, error } = await supabase
      .from('exam_logs')
      .insert([
        { 
          exam_attempt_id: examAttemptId,
          student_id: studentId,
          event_type: eventType,
          event_details: eventDetails
        }
      ]);

    if (error) {
      console.error('[Exam Monitor] Error logging to Supabase:', error);
    } else {
      console.log(`[Exam Monitor] Successfully logged ${eventType} to Supabase`);
    }
  } catch (error) {
    console.error('[Exam Monitor] Error in logExamEvent:', error);
  }
};

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
  const [examAttemptId, setExamAttemptId] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const lastLogTime = useRef(Date.now())
  const logCooldown = 5000 // 5 seconds cooldown between logs for the same event
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
  const [faceDetector, setFaceDetector] = useState(null);
  const [objectDetector, setObjectDetector] = useState(null);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [flags, setFlags] = useState([]);
  const [lastFlagTime, setLastFlagTime] = useState(0);
  const flagCooldown = 30000; // 30 seconds cooldown between flags of same type
  const suspiciousObjects = ['cell phone', 'book', 'laptop', 'tv', 'remote', 'mouse', 'keyboard'];
  const lastObjectDetection = useRef(0);
  const objectDetectionCooldown = 30000; // 30 seconds between object detection checks

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

  // Initialize Detectors
  const initializeDetectors = useCallback(async () => {
    try {
      // Initialize Face Detection
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      
      const faceDetector = await FaceDetector.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.7,
          minSuppressionThreshold: 0.3
        }
      );
      
      // Initialize Object Detection
      await tf.ready();
      const objectDetector = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      
      setFaceDetector(faceDetector);
      setObjectDetector(objectDetector);
      console.log('Detectors initialized');
    } catch (error) {
      console.error('Error initializing detectors:', error);
    }
  }, []);

  // Save flag to Supabase
  const saveFlag = useCallback(async (flagType, metadata = {}) => {
    try {
      const now = new Date().toISOString();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!user) throw new Error('No authenticated user found');
      if (!examId) throw new Error('No exam ID available');
      
      console.log('Current user:', { id: user.id, email: user.email });
      console.log('Exam ID:', examId);
      
      // Check cooldown for this flag type
      const lastFlagTime = lastFlagTimers.current[flagType] || 0;
      const nowTime = Date.now();
      
      if (nowTime - lastFlagTime < flagCooldown) {
        console.log(`Skipping ${flagType} flag - in cooldown`);
        return;
      }
      
      // Update cooldown timer
      lastFlagTimers.current[flagType] = nowTime;
      
      const flagData = {
        exam_id: examId,
        user_id: user.id,
        flag_type: flagType,
        timestamp: now,
        metadata: {
          ...metadata,
          user_agent: navigator.userAgent,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          window_size: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: now
        }
      };
      
      console.log('Attempting to save flag:', JSON.stringify(flagData, null, 2));
      
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('exam_flags')
        .select('id')
        .limit(1);
      
      if (testError) throw new Error(`Supabase test query failed: ${testError.message}`);
      console.log('Supabase connection test successful');
      
      // Insert the flag
      const { data, error } = await supabase
        .from('exam_flags')
        .insert([flagData])
        .select();
        
      if (error) throw new Error(`Failed to insert flag: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from insert');
      
      console.log('Flag saved successfully:', data[0]);
      
      // Update local state with the new flag
      setFlags(prev => [
        { id: data[0].id, ...flagData },
        ...prev.slice(0, 9) // Keep only the 10 most recent flags
      ]);
      
      // Show notification if permission is granted
      if (Notification.permission === 'granted') {
        new Notification(`Exam Alert: ${flagType}`, {
          body: `Flagged at ${new Date(now).toLocaleTimeString()}`,
          icon: '/logo192.png'
        });
      }
      
      return data[0];
    } catch (error) {
      console.error('❌ Error in saveFlag:', {
        message: error.message,
        stack: error.stack,
        flagType,
        metadata,
        examId,
        supabaseUrl: supabase.supabaseUrl,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }, [examId]);

  // Run object detection
  const runObjectDetection = useCallback(async (video) => {
    if (!objectDetector || !detectionRunning) {
      console.log('Object detection not running. Check:', { objectDetector: !!objectDetector, detectionRunning });
      return;
    }
    
    const now = Date.now();
    if (now - lastObjectDetection.current < objectDetectionCooldown) {
      console.log('Skipping object detection - in cooldown');
      // Schedule next detection
      if (detectionRunning) {
        setTimeout(() => runObjectDetection(video), 1000);
      }
      return;
    }
    
    try {
      const predictions = await objectDetector.detect(video);
      
      // Check for suspicious objects
      const suspiciousItems = predictions.filter(prediction => 
        suspiciousObjects.includes(prediction.class.toLowerCase()) && 
        prediction.score > 0.7
      );
      
      if (suspiciousItems.length > 0) {
        console.log(`🚨 Suspicious objects detected:`, suspiciousItems);
        await saveFlag('SUSPICIOUS_OBJECT_DETECTED', {
          objects: suspiciousItems.map(item => ({
            class: item.class,
            score: item.score,
            bbox: item.bbox
          })),
          timestamp: new Date().toISOString()
        });
        console.log('✅ Suspicious objects flag saved to Supabase');
        lastObjectDetection.current = now;
      }
    } catch (error) {
      console.error('Error in object detection:', error);
    }
  }, [objectDetector, detectionRunning]);

  // Run face and object detection
  const runDetections = useCallback(async () => {
    if (!faceDetector || !detectionRunning || !videoRef.current) {
      console.log('Detection not running. Check conditions:', {
        faceDetector: !!faceDetector,
        detectionRunning,
        videoRef: !!videoRef.current,
        videoReady: videoRef.current?.readyState
      });
      return;
    }
    
    const video = videoRef.current;
    if (video.readyState < 2) {
      console.log('Video not ready. Ready state:', video.readyState);
      if (detectionRunning) {
        requestAnimationFrame(runDetections);
      }
      return;
    }
    
    try {
      // Run face detection
      const detections = await faceDetector.detectForVideo(video, Date.now());
      console.log('Face detections:', detections.detections.length);
      
      // Check for multiple faces
      if (detections.detections.length >= 2) {
        console.log('Multiple faces detected:', detections.detections.length);
        await saveFlag('MULTIPLE_FACES_DETECTED', {
          face_count: detections.detections.length,
          detection_confidence: Math.max(...detections.detections.map(d => d.categories[0].score)),
          detection_timestamp: new Date().toISOString()
        });
      } 
      // Check if no face is detected
      else if (detections.detections.length === 0) {
        console.log('No face detected');
        await saveFlag('NO_FACE_DETECTED', {
          detection_confidence: 0,
          detection_timestamp: new Date().toISOString()
        });
      }
      // Check face position
      else {
        const face = detections.detections[0];
        const faceBox = face.boundingBox;
        const centerX = faceBox.originX + (faceBox.width / 2);
        const centerY = faceBox.originY + (faceBox.height / 2);
        
        // Check if face is not centered
        const video = videoRef.current;
        const xOffset = Math.abs((centerX / video.videoWidth) - 0.5);
        const yOffset = Math.abs((centerY / video.videoHeight) - 0.5);
        
        if (xOffset > 0.3 || yOffset > 0.3) {
          console.log('Irregular face position detected');
          await saveFlag('IRREGULAR_FACE_POSITION', {
            x_position: centerX / video.videoWidth,
            y_position: centerY / video.videoHeight,
            detection_confidence: face.categories[0].score,
            detection_timestamp: new Date().toISOString()
          });
        }
      }
      
      // Run object detection periodically
      const now = Date.now();
      if (now - lastObjectDetection.current > objectDetectionCooldown) {
        lastObjectDetection.current = now;
        runObjectDetection(video);
      }
      
      // Continue detection loop
      if (detectionRunning) {
        requestAnimationFrame(runDetections);
      }
      
    } catch (error) {
      console.error('❌ Error in detections:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Retry after a delay if there's an error
      if (detectionRunning) {
        setTimeout(runDetections, 1000);
      }
    }
  }, [faceDetector, objectDetector, detectionRunning, saveFlag]);

  // Run face detection
  const runFaceDetection = useCallback(async () => {
    if (!faceDetector || !videoRef.current || !detectionRunning) {
      console.log('Face detection not running. Conditions:', {
        faceDetector: !!faceDetector,
        videoRef: !!videoRef.current,
        detectionRunning
      });
      return;
    }
    
    try {
      console.log('Running face detection...');
      const detections = await faceDetector.detectForVideo(videoRef.current, Date.now());
      console.log('Face detections:', detections.detections.length);
      
      // Check for multiple faces
      if (detections.detections.length >= 2) {
        console.log('Multiple faces detected:', detections.detections.length);
        await saveFlag('MULTIPLE_FACES_DETECTED', {
          face_count: detections.detections.length,
          detection_confidence: Math.max(...detections.detections.map(d => d.categories[0].score)),
          detection_timestamp: new Date().toISOString()
        });
      } 
      // Check if no face is detected
      else if (detections.detections.length === 0) {
        console.log('No face detected');
        await saveFlag('NO_FACE_DETECTED', {
          detection_confidence: 0,
          detection_timestamp: new Date().toISOString()
        });
      }
      // Check face position
      else {
        const face = detections.detections[0];
        const faceBox = face.boundingBox;
        const centerX = faceBox.originX + (faceBox.width / 2);
        const centerY = faceBox.originY + (faceBox.height / 2);
        
        // Check if face is not centered (simple check - can be refined)
        const video = videoRef.current;
        const xOffset = Math.abs((centerX / video.videoWidth) - 0.5);
        const yOffset = Math.abs((centerY / video.videoHeight) - 0.5);
        
        if (xOffset > 0.3 || yOffset > 0.3) {
          console.log('Irregular face position detected');
          await saveFlag('IRREGULAR_FACE_POSITION', {
            x_position: centerX / video.videoWidth,
            y_position: centerY / video.videoHeight,
            detection_confidence: face.categories[0].score,
            detection_timestamp: new Date().toISOString()
          });
        }
      }
      
      // Continue detection loop
      if (detectionRunning) {
        requestAnimationFrame(runFaceDetection);
      }
    } catch (error) {
      console.error('❌ Error in face detection:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Retry after a delay if there's an error
      if (detectionRunning) {
        setTimeout(runFaceDetection, 1000);
      }
    }
  }, [faceDetector, detectionRunning, saveFlag]);

  // Clean up resources
  const cleanupResources = useCallback(() => {
    console.log('Cleaning up resources...');
    setDetectionRunning(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    if (faceDetector) {
      faceDetector.close();
    }
  }, [faceDetector]);

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
  const [uploadWarning, setUploadWarning] = useState(null);
  
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
    onStop: async (blobUrl, blob) => {
      try {
        if (!blob || blob.size === 0) {
          console.error('Empty or invalid recording blob received');
          return;
        }
        
        const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
        console.log(`Recording stopped, size: ${sizeInMB}MB`);
        
        // Create a new blob reference to avoid potential issues with the original
        const blobCopy = new Blob([blob], { type: blob.type });
        
        // Update state with the new blob
        setRecordingBlob(blobCopy);
        setRecordingUrl(blobUrl);
        
        // Process the recording in the background
        try {
          const userResult = await supabase.auth.getUser();
          const user = userResult?.data?.user;
          
          if (user) {
            console.log('Starting background upload of recording...');
            await processRecording(blobCopy, user.id);
          } else {
            console.warn('User not authenticated, skipping recording upload');
          }
        } catch (uploadError) {
          console.error('Background upload failed:', uploadError);
          // Don't throw, just log the error
        }
        
        // Mark as ready (for any components that might be waiting)
        setRecordingReady(true);
        console.log('Recording processing completed');
      } catch (error) {
        console.error('Error in recording onStop handler:', error);
        setError('Error processing recording: ' + error.message);
      }
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
    // Skip if we already have a stream
    if (streamRef.current) {
      console.log('Webcam stream already exists');
      return streamRef.current;
    }

    try {
      console.log('Requesting webcam access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 24 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Store the stream reference
      streamRef.current = stream;
      
      // Setup video element
      if (videoRef.current) {
        console.log('Webcam access granted, setting up video element...');
        
        // Stop any existing tracks to prevent memory leaks
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', '');
        
        // Start detection when video is playing
        const onPlaying = () => {
          console.log('Video is playing, starting detections...', {
            videoWidth: videoRef.current.videoWidth,
            videoHeight: videoRef.current.videoHeight,
            readyState: videoRef.current.readyState
          });
          
          if (faceDetector && objectDetector && !detectionRunning) {
            console.log('All detectors ready, starting detection loop');
            setDetectionRunning(true);
            // Start detection loop
            runDetections();
          }
        };
        
        // Remove any existing event listeners to prevent duplicates
        videoRef.current.onplaying = null;
        videoRef.current.onplaying = onPlaying;
        
        // If video is already playing, start detection immediately
        if (videoRef.current.readyState >= 2) {
          onPlaying();
        }
      }
      return stream;
    } catch (err) {
      console.error("Webcam error:", err);
      setConnectionStatus('Webcam access denied. Some features may not work.');
      await saveFlag('WEBCAM_ACCESS_DENIED');
      return null;
    }
  }, [faceDetector, detectionRunning, runDetections]);

  // Initialize detectors on component mount
  useEffect(() => {
    console.log('Component mounted, initializing detectors...');
    
    const init = async () => {
      try {
        await initializeDetectors();
        
        // Request notification permission
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          console.log('Requesting notification permission...');
          await Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
          });
        }
        
        // Start webcam stream
        console.log('Setting up webcam stream...');
        const stream = await setupWebcamStream();
        
        if (stream) {
          console.log('Webcam stream ready, starting detections...');
          setDetectionRunning(true);
          runDetections();
        }
      } catch (error) {
        console.error('❌ Error during initialization:', {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    };
    
    init();
    
    // Cleanup function
    return () => {
      console.log('Cleaning up...');
      setDetectionRunning(false);
      
      // Clean up face detector
      if (faceDetector) {
        faceDetector.close();
      }
      
      // Clean up TensorFlow.js memory
      tf.dispose();
      
      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []); // Removed dependencies to prevent re-runs

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

    const handleTabSwitch = () => {}
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

  // Log exam event
  const logExamEvent = async (examId, studentId, eventType, eventDetails = {}) => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      exam_id: examId,  // For our reference in logs
      student_id: studentId,
      event_type: eventType,
      ...eventDetails
    };
    
    // Log to console for debugging
    console.log(`[Exam Monitor] ${eventType}`, logData);
    
    try {
      // Log to Supabase - using null for exam_attempt_id since it's not required
      const { data, error } = await supabase
        .from('exam_logs')
        .insert([
          { 
            exam_attempt_id: null,  // Set to null to avoid foreign key constraint
            student_id: studentId,
            event_type: eventType,
            event_details: { ...eventDetails, exam_id: examId }  // Include exam_id in details
          }
        ]);

      if (error) {
        console.error('[Exam Monitor] Error logging to Supabase:', error);
      } else {
        console.log(`[Exam Monitor] Successfully logged ${eventType} to Supabase`);
      }
    } catch (error) {
      console.error('[Exam Monitor] Error in logExamEvent:', error);
    }
  };

  // Anti-cheating hooks
  // Log suspicious activities
  useEffect(() => {
    console.log('[Exam Monitor] Setting up event listeners...');
    
    // Get student ID from auth
    const initializeLogging = async () => {
      console.log('[Exam Monitor] Getting user info...');
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('[Exam Monitor] Error getting user:', authError);
          return;
        }
        
        if (user) {
          console.log('[Exam Monitor] User found:', user.id);
          setStudentId(user.id);
          
          // Log initial exam start
          logExamEvent(examId, user.id, 'EXAM_STARTED', {
            timestamp: new Date().toISOString(),
            message: 'Exam session started',
            user_agent: navigator.userAgent,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            window_size: `${window.innerWidth}x${window.innerHeight}`
          });
        }
      } catch (err) {
        console.error('[Exam Monitor] Error initializing logging:', err);
      }
    };
    
    initializeLogging();

    // Tab visibility change handler
    const handleVisibilityChange = () => {
      console.log('[Exam Monitor] Visibility changed. Hidden:', document.hidden);
      if (document.hidden && studentId) {
        console.log('[Exam Monitor] Tab switch detected, logging...');
        logExamEvent(examId, studentId, 'TAB_SWITCH', {
          timestamp: new Date().toISOString(),
          message: 'User switched tabs or minimized browser',
          url: window.location.href
        });
      }
    };

    // Mouse leave handler
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && studentId) {
        logExamEvent(examId, studentId, 'MOUSE_LEAVE', {
          timestamp: new Date().toISOString(),
          message: 'Mouse left the browser window',
          x_position: e.clientX,
          y_position: e.clientY
        });
      }
    };

    // Window blur handler (alt+tab, win+tab, etc.)
    const handleBlur = () => {
      if (studentId) {
        logExamEvent(examId, studentId, 'WINDOW_BLUR', {
          timestamp: new Date().toISOString(),
          message: 'Window lost focus',
          url: window.location.href
        });
      }
    };

    // Add event listeners
    console.log('[Exam Monitor] Adding event listeners...');
    const visibilityChangeHandler = () => handleVisibilityChange();
    const mouseLeaveHandler = (e) => handleMouseLeave(e);
    const blurHandler = () => handleBlur();
    
    document.addEventListener('visibilitychange', visibilityChangeHandler);
    document.addEventListener('mouseleave', mouseLeaveHandler);
    window.addEventListener('blur', blurHandler);
    
    // Initial test logging
    if (studentId) {
      console.log('[Exam Monitor] Initial test log');
      logExamEvent(examId, studentId, 'EXAM_VIEW_LOADED', {
        timestamp: new Date().toISOString(),
        message: 'Exam view loaded',
        user_agent: navigator.userAgent
      });
    }

    // Detect right-click
    const handleContextMenu = (e) => {
      if (studentId) {
        logExamEvent(examId, studentId, 'RIGHT_CLICK', {
          timestamp: new Date().toISOString(),
          message: 'Right-click detected',
          target_element: e.target.tagName,
          page_x: e.pageX,
          page_y: e.pageY
        });
      }
    };
    
    document.addEventListener('contextmenu', handleContextMenu);

    // Detect keyboard shortcuts (Ctrl+C, Ctrl+V, etc.)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const now = Date.now();
        if (now - lastLogTime.current > logCooldown) {
          logExamEvent(examAttemptId, studentId, 'KEYBOARD_SHORTCUT', {
            timestamp: new Date().toISOString(),
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey
          });
          lastLogTime.current = now;
        }
      }
    });

    // Cleanup
    return () => {
      console.log('[Exam Monitor] Cleaning up event listeners...');
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      document.removeEventListener('mouseleave', mouseLeaveHandler);
      window.removeEventListener('blur', blurHandler);
      document.removeEventListener('contextmenu', handleContextMenu);
      
      // Log exam end
      if (studentId) {
        logExamEvent(examId, studentId, 'EXAM_ENDED', {
          timestamp: new Date().toISOString(),
          message: 'Exam session ended',
          duration: 'Session duration not tracked in this version'
        });
      }
    };
  }, [examAttemptId, studentId]);

  useEffect(() => {
    // Tab switch
    const handleTabSwitch = () => {
      logEvent('tab_switch', {});
      // Tab switch detected, logging silently
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) handleTabSwitch();
    });
    // Fullscreen exit
    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        logEvent('fullscreen_exit', {});
        // Fullscreen exited, logging silently
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
      // Stop screen recording if it's active
      if (status === 'recording') {
        setRecordingReady(false);
        stopRecording();
        
        // Start processing recording in the background
        console.log('Starting background recording processing...');
        processRecording(() => {
          console.log('Background recording processing completed');
        });
      }
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

  // Function to upload blob to Cloudinary
  const uploadBlob = async (blob, userId) => {
    if (!blob) {
      console.warn('No recording blob available');
      return null;
    }

    const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log('Starting upload of', sizeInMB, 'MB recording to Cloudinary...');
    
    try {
      // Convert blob to file with a meaningful name
      const fileName = `exam_${examId}_${userId}_${Date.now()}.webm`;
      const file = new File([blob], fileName, { type: 'video/webm' });
      
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file, userId, `examlytic/recordings/${examId}/${userId}`);
      
      console.log('Upload to Cloudinary successful:', uploadResult.url);
      return {
        url: uploadResult.url,
        public_id: uploadResult.public_id,
        duration: uploadResult.duration
      };
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Failed to upload recording to Cloudinary');
    }
  };

  // Helper function to update the latest exam attempt with recording info
  const updateLatestAttemptWithRecording = async (userId, examId, recordingData) => {
    try {
      console.log('Looking for latest exam attempt for user:', userId, 'exam:', examId);
      
      // Find the most recent exam attempt for this user and exam
      const { data: latestAttempt, error } = await supabase
        .from('exam_attempts')
        .select('id, submitted_at')
        .eq('student_id', userId)
        .eq('exam_id', examId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !latestAttempt) {
        console.error('Error finding latest attempt:', error || 'No attempts found');
        return null;
      }

      console.log('Found latest attempt:', latestAttempt.id);
      
      // Update the attempt with recording info
      const { error: updateError } = await supabase
        .from('exam_attempts')
        .update(recordingData)
        .eq('id', latestAttempt.id);

      if (updateError) {
        console.error('Error updating latest attempt:', updateError);
        return null;
      }

      console.log('Successfully updated latest attempt with recording info');
      return latestAttempt.id;
    } catch (error) {
      console.error('Error in updateLatestAttemptWithRecording:', error);
      return null;
    }
  };

  // Process recording asynchronously
  const processRecording = async (blob, userId, onComplete) => {
    if (!blob || blob.size === 0) {
      console.log('No valid recording blob to process');
      onComplete?.();
      return;
    }

    console.log('Starting async recording processing...');
    
    try {
      console.log('Processing recording, size:', (blob.size / (1024 * 1024)).toFixed(2), 'MB');
      
      // Upload to Cloudinary
      const uploadResult = await uploadBlob(blob, userId);
      
      if (uploadResult?.url) {
        console.log('Recording uploaded successfully:', uploadResult.url);
        
        // If we have a valid examAttemptId, update the record
        if (examAttemptId) {
          console.log('Updating exam attempt with recording URL, attempt ID:', examAttemptId);
          const { error: updateError } = await supabase
            .from('exam_attempts')
            .update({ 
              recording_url: uploadResult.url,
              cloudinary_public_id: uploadResult.public_id,
              recording_duration: uploadResult.duration
            })
            .eq('id', examAttemptId);
            
          if (updateError) {
            console.error('Error updating attempt with recording URL:', updateError);
            // If update fails, try to find the latest attempt for this user and exam
            await updateLatestAttemptWithRecording(userId, examId, {
              recording_url: uploadResult.url,
              cloudinary_public_id: uploadResult.public_id,
              recording_duration: uploadResult.duration
            });
          }
        } else {
          console.log('No examAttemptId available, trying to find latest attempt...');
          // If we don't have an examAttemptId, try to find the latest attempt for this user and exam
          await updateLatestAttemptWithRecording(userId, examId, {
            recording_url: uploadResult.url,
            cloudinary_public_id: uploadResult.public_id,
            recording_duration: uploadResult.duration
          });
        }
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      // Don't throw, just log the error
    } finally {
      console.log('Recording processing completed');
      onComplete?.();
    }
  };

  // On submit, save answers and all logs
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to submit the exam? You cannot change your answers after submission.")) return;
    
    setIsSubmitting(true);
    setError(null);

    let user = null;
    let examQuestions = [];
    let currentAttemptId = examAttemptId; // Store the current attempt ID

    try {
      // Get the current authenticated user
      const userResult = await supabase.auth.getUser();
      user = userResult?.data?.user;
      if (!user || userResult.error) {
        throw new Error('User not authenticated');
      }

      // Stop recording if it's active
      if (status === 'recording') {
        console.log('Stopping recording before submission...');
        stopRecording();
        
        // Small delay to allow recording to stop
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Save answers (always, even if recording upload failed)
      const updateFields = {
        answers: answers,
        submitted_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        score: calculateScore(answers, questions), // Use the questions from state
      };
      
      // Include recording URL if available (might be set by onStop handler)
      if (recordingUrl) {
        updateFields.recording_url = recordingUrl;
      }
      
      try {
        // If we have a valid attempt ID, try to update, otherwise insert a new attempt
      let attemptData;
      
      if (currentAttemptId) {
        // Try to update existing attempt
        const { data: updated, error: updateError } = await supabase
          .from('exam_attempts')
          .update(updateFields)
          .eq('id', currentAttemptId)
          .select()
          .single();
          
        if (updateError) {
          console.error('Error updating attempt:', updateError);
          // If update fails, we'll try to insert a new attempt
          currentAttemptId = null;
        } else {
          attemptData = updated;
        }
      }
      
      // If we don't have attempt data (either no ID or update failed), insert a new attempt
      if (!attemptData) {
        const insertFields = {
          exam_id: examId,
          student_id: user.id,
          ...updateFields,
        };
        
        const { data: inserted, error: insertError } = await supabase
          .from('exam_attempts')
          .insert([insertFields])
          .select()
          .single();
          
        if (insertError || !inserted) {
          console.error('Error inserting attempt:', insertError);
          throw new Error('Could not save your answers to the server. Please inform your instructor.');
        }
        
        // Update the current attempt ID with the newly created one
        currentAttemptId = inserted.id;
        attemptData = inserted;
      }
      } catch (err) {
        console.error('Error saving answers:', err);
        throw new Error('Could not fully save your answers. Please inform your instructor.');
      }
      
      // If we have a recording blob that hasn't been uploaded yet, process it in the background
      if (recordingBlob && !recordingUrl) {
        console.log('Processing recording in the background...');
        processRecording(recordingBlob, user.id)
          .then(() => console.log('Background recording processing completed'))
          .catch(err => console.error('Background recording processing failed:', err));
      }
      
      // Navigate to the done page with the current state
      navigate(`/exam/${examId}/done`, {
        state: {
          examId,
          answers,
          questions: questions, // Use the questions from state
          score: calculateScore(answers, questions),
          totalQuestions: questions.length,
          warning: uploadWarning,
        }
      });
      
    } catch (error) {
      console.error('Error during exam submission:', error);
      setError(error.message || 'Failed to submit exam. Please try again.');
    } finally {
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
        {/* Proctoring Alerts */}
        <div className="proctoring-alerts">
          {flags.slice(-3).map((flag, index) => (
            <div key={index} className="alert alert-warning">
              <FaExclamationTriangle /> Suspicious activity detected: {flag.type.replace(/_/g, ' ').toLowerCase()}
              <small> at {new Date(flag.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
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
  /* Proctoring alerts */
  .proctoring-alerts {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 300px;
  }
  
  .alert {
    padding: 10px 15px;
    margin-bottom: 10px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    background: #fff3cd;
    color: #856404;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  .alert svg {
    margin-right: 8px;
  }
  
  .alert small {
    opacity: 0.8;
    margin-left: auto;
    font-size: 0.8em;
  }
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