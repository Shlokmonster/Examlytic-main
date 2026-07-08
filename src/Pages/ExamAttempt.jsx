import { useEffect, useState, useRef, useCallback } from "react";
import { Box, TextField } from '@mui/material';
import { useParams, useNavigate } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import Peer from 'peerjs';
import { FaVideo, FaVideoSlash, FaDesktop, FaExclamationTriangle, FaUser, FaFlag, FaRegFlag, FaLock, FaChevronLeft, FaChevronRight, FaCalculator, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { uploadToCloudinary } from "../utils/cloudinary";
import Loader from "../Components/common/Loader";

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
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [notes, setNotes] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
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
        videoRef.current.style.transform = 'scaleX(-1)'; // Mirror the video
        
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

  if (isLoading) return <Loader fullPage message="Loading exam content..." />;
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

  const formatDateTime = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
  };

  return (
    <div className="exam-workspace-new">
      {/* Dynamic styling injected inline */}
      <style>{`
        body {
          background: #f8fafc !important;
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #1e293b;
        }
        .exam-workspace-new {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
        }
        .exam-header-new {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 40px;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .brand-name {
          font-size: 22px;
          font-weight: 800;
          color: #3b82f6;
          letter-spacing: -0.5px;
        }
        .brand-divider {
          width: 1px;
          height: 20px;
          background: #cbd5e1;
        }
        .exam-title-display {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .header-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .timer-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          color: #334155;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          border: 1px solid #e2e8f0;
        }
        .finish-exam-btn {
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.15);
        }
        .finish-exam-btn:hover {
          background: #4338ca;
          box-shadow: 0 4px 8px rgba(79, 70, 229, 0.25);
        }
        .finish-exam-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }
        .exam-grid-new {
          display: grid;
          grid-template-columns: 280px 1fr 280px;
          gap: 24px;
          padding: 24px 40px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .sidebar-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .sidebar-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .sidebar-card-title {
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .webcam-card-new {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #f1f5f9;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .webcam-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .webcam-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
        }
        .webcam-timestamp {
          position: absolute;
          bottom: 8px;
          left: 8px;
          background: rgba(15, 23, 42, 0.75);
          color: #fff;
          font-family: monospace;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          backdrop-filter: blur(4px);
          pointer-events: none;
          z-index: 10;
        }
        .question-grid-new {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        .q-num-btn {
          width: 100%;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .q-num-btn:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }
        .q-num-btn.active {
          border-color: #4f46e5;
          color: #4f46e5;
          border-width: 2px;
          font-weight: 700;
        }
        .q-num-btn.answered {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #fff;
        }
        .q-num-btn.flagged {
          background: #f5f3ff;
          border-color: #c084fc;
          color: #7e22ce;
        }
        .completion-container {
          border-top: 1px solid #f1f5f9;
          padding-top: 15px;
        }
        .completion-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }
        .completion-bar-bg {
          width: 100%;
          height: 6px;
          background: #f1f5f9;
          border-radius: 3px;
          overflow: hidden;
        }
        .completion-bar-fill {
          height: 100%;
          background: #4f46e5;
          transition: width 0.3s ease;
        }
        .integrity-card-new {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .integrity-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          color: #166534;
        }
        .integrity-subtext {
          font-size: 11px;
          line-height: 1.4;
          color: #15803d;
        }
        .question-workspace-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 30px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          min-height: 480px;
        }
        .workspace-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .question-index-pill {
          background: #f5f3ff;
          color: #7e22ce;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid #e9d5ff;
        }
        .flag-review-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .flag-review-toggle:hover {
          color: #334155;
        }
        .flag-review-toggle.flagged {
          color: #7e22ce;
        }
        .question-body-text {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.45;
          color: #0f172a;
          margin-bottom: 24px;
        }
        .options-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 30px;
          flex: 1;
        }
        .custom-option-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .custom-option-card:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .custom-option-card.selected {
          background: #f5f3ff;
          border-color: #8b5cf6;
        }
        .custom-radio-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .custom-option-card.selected .custom-radio-circle {
          border-color: #8b5cf6;
        }
        .custom-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #8b5cf6;
        }
        .option-text-display {
          font-size: 15px;
          font-weight: 500;
          color: #334155;
        }
        .custom-option-card.selected .option-text-display {
          color: #1e1b4b;
          font-weight: 600;
        }
        .custom-textarea-answer {
          width: 100%;
          min-height: 150px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          font-size: 15px;
          padding: 14px;
          box-sizing: border-box;
          resize: vertical;
          transition: all 0.2s ease;
          margin-bottom: 30px;
          flex: 1;
        }
        .custom-textarea-answer:focus {
          border-color: #8b5cf6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .navigation-bar-new {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
        }
        .nav-text-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .nav-text-btn:hover {
          color: #1e293b;
        }
        .nav-text-btn:disabled {
          color: #cbd5e1;
          cursor: not-allowed;
        }
        .next-question-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.15);
        }
        .next-question-btn:hover {
          background: #4338ca;
          box-shadow: 0 4px 8px rgba(79, 70, 229, 0.25);
        }
        .tool-box-inner {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .tool-box-inner:last-child {
          margin-bottom: 0;
        }
        .tool-box-title {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
        }
        .tool-formula {
          font-family: monospace;
          font-size: 11px;
          color: #2563eb;
          background: #eff6ff;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #dbeafe;
          overflow-x: auto;
          white-space: nowrap;
        }
        .scratchpad-area {
          width: 100%;
          height: 90px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          padding: 8px;
          font-size: 12px;
          box-sizing: border-box;
          resize: none;
          font-family: inherit;
        }
        .scratchpad-area:focus {
          border-color: #8b5cf6;
          outline: none;
        }
        .stats-list-new {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-row-new {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .stat-label-with-dot {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .stat-dot.red { background: #ef4444; }
        .stat-dot.purple { background: #a855f7; }
        .stat-dot.blue { background: #3b82f6; }
        .stat-count-value {
          font-weight: 700;
          color: #1e293b;
        }
        .proctoring-alerts {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          max-width: 320px;
        }
        .alert {
          padding: 12px 16px;
          margin-bottom: 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          background: #fff3cd;
          color: #856404;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border: 1px solid #ffeeba;
          font-size: 13px;
        }
        .alert svg {
          margin-right: 8px;
          flex-shrink: 0;
        }
        .alert small {
          opacity: 0.8;
          margin-left: auto;
          font-size: 11px;
        }
        @media (max-width: 992px) {
          .exam-grid-new {
            grid-template-columns: 1fr;
            padding: 16px;
          }
        }
      `}</style>

      {/* Floating status indicator for real-time proctor server connection */}
      <StatusIndicator />

      {/* Header bar */}
      <header className="exam-header-new">
        <div className="header-brand">
          <span className="brand-name">Examlytic</span>
          <div className="brand-divider" />
          <span className="exam-title-display">
            {exam ? `${exam.title} - ${exam.subject || 'MIDTERM'}` : 'EXAM WORKSPACE'}
          </span>
        </div>
        <div className="header-controls">
          <div className="timer-pill">
            <span>⏱️</span>
            <span>{hours !== '00' ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`}</span>
          </div>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="finish-exam-btn"
          >
            Finish Exam
          </button>
        </div>
      </header>

      {/* Three Column Grid Workspace */}
      <main className="exam-grid-new">
        {/* Left Column */}
        <section className="sidebar-column">
          {/* Webcam Box */}
          <div className="webcam-card-new">
            <video ref={videoRef} autoPlay muted playsInline className="webcam-video" />
            <div className="webcam-timestamp">
              {formatDateTime(currentDateTime)}
            </div>
          </div>

          {/* Exam Progress Card */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              Exam Progress
            </div>
            <div className="question-grid-new">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQuestionIndex;
                const isAnswered = !!answers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                
                let btnClass = "q-num-btn";
                if (isCurrent) btnClass += " active";
                if (isAnswered) btnClass += " answered";
                if (isFlagged) btnClass += " flagged";
                
                return (
                  <button
                    key={q.id}
                    className={btnClass}
                    onClick={() => setCurrentQuestionIndex(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="completion-container">
              <div className="completion-label-row">
                <span>Completion</span>
                <span>
                  {questions.length > 0 
                    ? Math.round((questions.filter(q => answers[q.id]).length / questions.length) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="completion-bar-bg">
                <div 
                  className="completion-bar-fill" 
                  style={{ 
                    width: `${questions.length > 0 
                      ? Math.round((questions.filter(q => answers[q.id]).length / questions.length) * 100) 
                      : 0}%` 
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Integrity Shield Card */}
          <div className="integrity-card-new">
            <div className="integrity-header">
              <FaLock />
              <span>Integrity Shield Active</span>
            </div>
            <div className="integrity-subtext">
              Your session is being monitored for professional certification compliance.
            </div>
          </div>
        </section>

        {/* Center Main Workspace */}
        <section className="question-workspace-card">
          <div className="workspace-header">
            <div className="question-index-pill">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            <button 
              className={`flag-review-toggle ${flaggedQuestions[currentQuestion.id] ? 'flagged' : ''}`}
              onClick={() => setFlaggedQuestions(prev => ({ 
                ...prev, 
                [currentQuestion.id]: !prev[currentQuestion.id] 
              }))}
            >
              {flaggedQuestions[currentQuestion.id] ? <FaFlag /> : <FaRegFlag />}
              <span>Flag for review</span>
            </button>
          </div>

          {/* Question Text */}
          <div className="question-body-text">
            {currentQuestion.question_text}
          </div>

          {/* Dynamically Injected SVG Neural Network diagram for ANN questions */}
          {(currentQuestion.question_text?.toLowerCase().includes('gradient') || 
            currentQuestion.question_text?.toLowerCase().includes('neural') ||
            (exam && exam.title?.toLowerCase().includes('neural'))) && (
            <NeuralNetworkDiagram />
          )}

          {/* Question Input Selection */}
          {currentQuestion.type === 'mcq' ? (
            <div className="options-stack">
              {currentQuestion.options?.map((opt, oidx) => {
                const letter = String.fromCharCode(65 + oidx);
                const selected = answers[currentQuestion.id] === letter;
                return (
                  <div 
                    key={oidx} 
                    className={`custom-option-card ${selected ? 'selected' : ''}`}
                    onClick={() => handleOptionChange(currentQuestion.id, letter)}
                  >
                    <div className="custom-radio-circle">
                      {selected && <div className="custom-radio-inner" />}
                    </div>
                    <span className="option-text-display">{opt}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <textarea
              className="custom-textarea-answer"
              placeholder="Type your notes or answer details here..."
              value={answers[currentQuestion.id] || ''}
              onChange={e => handleOptionChange(currentQuestion.id, e.target.value)}
            />
          )}

          {/* Navigation Action Bar */}
          <div className="navigation-bar-new">
            <button 
              className="nav-text-btn"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <FaChevronLeft />
              <span>Previous</span>
            </button>

            <button 
              className="nav-text-btn"
              onClick={() => setFlaggedQuestions(prev => ({ 
                ...prev, 
                [currentQuestion.id]: !prev[currentQuestion.id] 
              }))}
            >
              <FaRegFlag />
              <span>Review Later</span>
            </button>

            <button 
              className="next-question-btn"
              onClick={handleNextQuestion}
            >
              <span>{currentQuestionIndex === questions.length - 1 ? 'Submit Exam' : 'Next Question'}</span>
              <FaChevronRight />
            </button>
          </div>
        </section>

        {/* Right Column */}
        <section className="sidebar-column">
          {/* Reference Tools Card */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <FaCalculator />
              <span>Reference Tools</span>
            </div>
            
            <div className="tool-box-inner">
              <div className="tool-box-title">Equation Helper</div>
              <div className="tool-formula">
                ∂L/∂w = (∂L/∂y) * (∂y/∂z) * (∂z/∂w)
              </div>
            </div>

            <div className="tool-box-inner">
              <div className="tool-box-title">Scratchpad</div>
              <textarea 
                className="scratchpad-area"
                placeholder="Type your notes here..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Navigation Card */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              Quick Navigation
            </div>
            <div className="stats-list-new">
              <div className="stat-row-new">
                <div className="stat-label-with-dot">
                  <div className="stat-dot red" />
                  <span>Unanswered</span>
                </div>
                <span className="stat-count-value">
                  {questions.filter(q => !answers[q.id]).length}
                </span>
              </div>
              <div className="stat-row-new">
                <div className="stat-label-with-dot">
                  <div className="stat-dot purple" />
                  <span>Flagged</span>
                </div>
                <span className="stat-count-value">
                  {Object.values(flaggedQuestions).filter(Boolean).length}
                </span>
              </div>
              <div className="stat-row-new">
                <div className="stat-label-with-dot">
                  <div className="stat-dot blue" />
                  <span>Attempted</span>
                </div>
                <span className="stat-count-value">
                  {questions.filter(q => answers[q.id]).length}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Proctoring Alerts Overlay */}
      <div className="proctoring-alerts">
        {flags.slice(-3).map((flag, index) => (
          <div key={index} className="alert alert-warning">
            <FaExclamationTriangle /> Suspicious activity detected: {flag.type.replace(/_/g, ' ').toLowerCase()}
            <small> at {new Date(flag.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Helper sub-components placed below for clarity and organization
// -------------------------------------------------------------

const NeuralNetworkDiagram = () => (
  <div className="neural-diagram-container" style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
    <svg width="100%" height="200" viewBox="0 0 600 200" style={{ maxWidth: '500px' }}>
      {/* Connection Lines (Weights) */}
      {[40, 80, 120, 160].map(y1 => 
        [20, 60, 100, 140, 180].map(y2 => 
          <line key={`l1-${y1}-${y2}`} x1="80" y1={y1} x2="220" y2={y2} stroke="#cbd5e1" strokeWidth="1" />
        )
      )}
      {[20, 60, 100, 140, 180].map(y1 => 
        [20, 60, 100, 140, 180].map(y2 => 
          <line key={`l2-${y1}-${y2}`} x1="220" y1={y1} x2="360" y2={y2} stroke="#94a3b8" strokeWidth="1" />
        )
      )}
      {[20, 60, 100, 140, 180].map(y1 => 
        [70, 130].map(y2 => 
          <line key={`l3-${y1}-${y2}`} x1="360" y1={y1} x2="500" y2={y2} stroke="#cbd5e1" strokeWidth="1" />
        )
      )}

      {/* Nodes - Input Layer */}
      {[40, 80, 120, 160].map((y, i) => (
        <circle key={`n1-${i}`} cx="80" cy={y} r="10" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
      ))}
      {/* Nodes - Hidden Layer 1 */}
      {[20, 60, 100, 140, 180].map((y, i) => (
        <circle key={`n2-${i}`} cx="220" cy={y} r="10" fill="#fff" stroke="#8b5cf6" strokeWidth="2.5" />
      ))}
      {/* Nodes - Hidden Layer 2 */}
      {[20, 60, 100, 140, 180].map((y, i) => (
        <circle key={`n3-${i}`} cx="360" cy={y} r="10" fill="#fff" stroke="#8b5cf6" strokeWidth="2.5" />
      ))}
      {/* Nodes - Output Layer */}
      {[70, 130].map((y, i) => (
        <circle key={`n4-${i}`} cx="500" cy={y} r="10" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
      ))}

      {/* Labels */}
      <text x="80" y="195" fill="#64748b" fontSize="9" textAnchor="middle" fontWeight="bold">Input Layer (X)</text>
      <text x="290" y="195" fill="#64748b" fontSize="9" textAnchor="middle" fontWeight="bold">Hidden Layers (H1, H2)</text>
      <text x="500" y="195" fill="#64748b" fontSize="9" textAnchor="middle" fontWeight="bold">Output Layer (Y)</text>

      {/* Curves representing Backprop */}
      <path d="M 230 30 Q 290 5 350 30" fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3,3" />
      <text x="290" y="15" fill="#7e22ce" fontSize="8" textAnchor="middle" fontStyle="italic">Backpropagated Error</text>
    </svg>
  </div>
);