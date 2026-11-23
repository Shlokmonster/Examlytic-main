import { useEffect, useState, useRef, useCallback } from "react";
import { Box, TextField } from '@mui/material';
import { useParams, useNavigate } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import { Room } from 'livekit-client';
import { FaVideo, FaVideoSlash, FaDesktop, FaExclamationTriangle, FaUser, FaFlag, FaRegFlag, FaLock, FaChevronLeft, FaChevronRight, FaCalculator, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { uploadToCloudinary } from "../utils/cloudinary";
import Loader from "../Components/common/Loader";
import { toast } from 'react-toastify';
import { fetchLiveKitToken, sendStudentHeartbeat, autoSaveAnswers, submitExamAttempt, fetchExamDetails } from "../services/examService";

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
  const [isExamLoaded, setIsExamLoaded] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef()
  const canvasRef = useRef()
  const webcamStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const isInitializingAttempt = useRef(false)
  const onStopResolver = useRef(null)
  const isDisposedRef = useRef(false)
  const [examAttemptId, setExamAttemptId] = useState(null)
  const currentAttemptIdRef = useRef(null)
  const expiresAtRef = useRef(null)
  const [studentId, setStudentId] = useState(null)
  const lastLogTime = useRef(Date.now())
  const logCooldown = 5000 // 5 seconds cooldown between logs for the same event
  const roomRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [faceDetector, setFaceDetector] = useState(null);
  const [objectDetector, setObjectDetector] = useState(null);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const detectionRunningRef = useRef(false);
  const [flags, setFlags] = useState([]);
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [notes, setNotes] = useState('');
  const lastFaceDetectionTimeRef = useRef(0);
  const FACE_DETECTION_INTERVAL_MS = 350; // Throttle AI face mesh to ~2.85 Hz (every 350ms) to prevent CPU/GPU starvation
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const flagCooldown = 30000; // 30 seconds cooldown between flags of same type
  const lastFlagTimers = useRef({});
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
      
      const faceLandmarker = await FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 2
        }
      );
      
      // Initialize Object Detection
      await tf.ready();
      const objectDetector = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      
      setFaceDetector(faceLandmarker);
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
        exam_attempt_id: currentAttemptIdRef.current || examAttemptId || null,
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
      const { error: testError } = await supabase
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectDetector, detectionRunning]);

  // Run face and object detection
  const runDetections = useCallback(async () => {
    if (!faceDetector || !detectionRunningRef.current || !videoRef.current) {
      return;
    }

    const nowTimestamp = Date.now();
    if (nowTimestamp - lastFaceDetectionTimeRef.current < FACE_DETECTION_INTERVAL_MS) {
      if (detectionRunningRef.current) {
        requestAnimationFrame(runDetections);
      }
      return;
    }
    lastFaceDetectionTimeRef.current = nowTimestamp;
    
    const video = videoRef.current;
    if (video.readyState < 2) {
      console.log('Video not ready. Ready state:', video.readyState);
      if (detectionRunningRef.current) {
        requestAnimationFrame(runDetections);
      }
      return;
    }
    
    try {
      // Run face landmark detection
      const result = await faceDetector.detectForVideo(video, Date.now());
      const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;
      
      // Update canvas overlay size and context
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw mesh wireframe for each detected face
        if (faceCount > 0) {
          ctx.strokeStyle = 'rgba(43, 124, 255, 0.35)';
          ctx.fillStyle = 'rgba(43, 124, 255, 0.5)';
          ctx.lineWidth = 1;
          
          result.faceLandmarks.forEach(landmarks => {
            // Draw all mesh points
            landmarks.forEach((pt) => {
              const px = pt.x * canvas.width;
              const py = pt.y * canvas.height;
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            // Draw major face contours
            const drawContour = (indices, close = false) => {
              ctx.beginPath();
              indices.forEach((idx, i) => {
                const pt = landmarks[idx];
                if (pt) {
                  const px = pt.x * canvas.width;
                  const py = pt.y * canvas.height;
                  if (i === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                }
              });
              if (close) ctx.closePath();
              ctx.stroke();
            };

            // Face Oval Contour
            drawContour([10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109], true);
            // Eyebrows
            drawContour([70, 63, 105, 66, 107]);
            drawContour([300, 293, 334, 296, 336]);
            // Eyes
            drawContour([33, 7, 163, 144, 145, 153, 154, 155, 133], true);
            drawContour([263, 249, 390, 373, 374, 380, 381, 382, 362], true);
            // Lips
            drawContour([61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291], true);
          });
        }
      }

      // Check for multiple faces
      if (faceCount >= 2) {
        console.log('Multiple faces detected:', faceCount);
        await saveFlag('MULTIPLE_FACES_DETECTED', {
          face_count: faceCount,
          detection_timestamp: new Date().toISOString()
        });
      } 
      // Check if no face is detected
      else if (faceCount === 0) {
        console.log('No face detected');
        await saveFlag('NO_FACE_DETECTED', {
          detection_timestamp: new Date().toISOString()
        });
      }
      // Check head pose and eye gaze for the single face
      else {
        const landmarks = result.faceLandmarks[0];
        const nose = landmarks[4];
        const leftEye = landmarks[263];
        const rightEye = landmarks[33];
        const chin = landmarks[152];
        
        if (nose && leftEye && rightEye && chin) {
          // 1. Yaw calculation (Looking left / right)
          const distLeft = Math.abs(nose.x - leftEye.x);
          const distRight = Math.abs(nose.x - rightEye.x);
          const totalDist = distLeft + distRight;
          
          if (totalDist > 0) {
            const yawRatio = distLeft / totalDist;
            // flag if looked too far left (yawRatio > 0.72) or right (yawRatio < 0.28)
            if (yawRatio > 0.72 || yawRatio < 0.28) {
              console.log('Head Yaw anomaly detected:', yawRatio);
              await saveFlag('LOOKING_AWAY', {
                rotation_type: 'horizontal_yaw',
                ratio: yawRatio,
                direction: yawRatio > 0.72 ? 'Left' : 'Right',
                detection_timestamp: new Date().toISOString()
              });
            }
          }
          
          // 2. Pitch calculation (Looking up / down)
          const eyeDistance = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
          const verticalDistance = Math.abs(nose.y - chin.y);
          if (eyeDistance > 0) {
            const pitchRatio = verticalDistance / eyeDistance;
            // flag if looked too far up or down
            if (pitchRatio < 1.0 || pitchRatio > 1.9) {
              console.log('Head Pitch anomaly detected:', pitchRatio);
              await saveFlag('LOOKING_AWAY', {
                rotation_type: 'vertical_pitch',
                ratio: pitchRatio,
                direction: pitchRatio < 1.0 ? 'Down' : 'Up',
                detection_timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
      
      // Run object detection periodically
      const now = Date.now();
      if (now - lastObjectDetection.current > objectDetectionCooldown) {
        lastObjectDetection.current = now;
        runObjectDetection(video);
      }
      
      // Continue detection loop
      if (detectionRunningRef.current) {
        requestAnimationFrame(runDetections);
      }
      
    } catch (error) {
      console.error('❌ Error in detections:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Retry after a delay if there's an error
      if (detectionRunningRef.current) {
        setTimeout(runDetections, 1000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceDetector, objectDetector, saveFlag]);

  // Run face detection


  // Clean up resources
  const cleanupResources = useCallback(() => {
    console.log('Cleaning up resources...');
    isDisposedRef.current = true;
    detectionRunningRef.current = false;
    setDetectionRunning(false);
    
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
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
  const [_isRecording, setIsRecording] = useState(false);
  const [_recordingReady, setRecordingReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState(null);

  const {
    status,
    startRecording,
    stopRecording
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
        setRecordingReady(true);
        
        // Resolve the submission resolver if active
        if (onStopResolver.current) {
          console.log('Resolving deferred stopResolver with blob Copy');
          onStopResolver.current(blobCopy);
          onStopResolver.current = null;
        }
        
        console.log('Recording processing completed');
      } catch (error) {
        console.error('Error in recording onStop handler:', error);
        setError('Error processing recording: ' + error.message);
      }
    }
  });

  // Keep isRecording state synced with react-media-recorder status
  useEffect(() => {
    if (status === 'recording') {
      setIsRecording(true);
      setRecordingReady(false);
    } else if (status === 'stopped' || status === 'idle') {
      setIsRecording(false);
    }
  }, [status]);

  // Clean up recording URL on unmount
  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  // Initialize LiveKit connection with reconnection logic
  const setupPeerConnection = useCallback(async () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setConnectionStatus('Failed to connect after multiple attempts. Please refresh the page.');
      return;
    }

    try {
      setConnectionStatus('Requesting streaming credentials...');
      
      const { data: { user } } = await supabase.auth.getUser();
      const resolvedStudentName = user?.user_metadata?.full_name || user?.email || 'Student';
      const effectiveAttemptId = currentAttemptIdRef.current || examAttemptId || 'attempt';
      const effectiveStudentId = studentId || user?.id || 'unknown';

      const { token, url } = await fetchLiveKitToken({
        roomName: `exam-${examId}`,
        participantName: `student___${effectiveAttemptId}___${effectiveStudentId}`,
        studentName: resolvedStudentName,
        isPublisher: true,
      });

      if (!url) {
        throw new Error('LiveKit streaming server URL is missing from server response. Please verify configuration.');
      }

      setConnectionStatus('Connecting to streaming server...');
      const room = new Room();

      room.on('disconnected', () => {
        if (isDisposedRef.current) {
          console.log('Disconnected intentionally. Skipping reconnect.');
          return;
        }
        console.log('Disconnected from LiveKit server. Reconnecting...');
        setConnectionStatus('Disconnected. Reconnecting...');
        reconnectAttempts.current++;
        setTimeout(() => {
          if (!isDisposedRef.current) {
            setupPeerConnection();
          }
        }, 2000);
      });

      await room.connect(url, token);
      console.log('Connected to LiveKit room:', room.name);
      setConnectionStatus('Connected to streaming server');
      reconnectAttempts.current = 0;
      roomRef.current = room;

      // 1. Immediately publish webcam video track for proctor live monitoring
      try {
        let webcamStream = webcamStreamRef.current;
        if (!webcamStream || webcamStream.getVideoTracks().length === 0 || !webcamStream.active) {
          webcamStream = await setupWebcamStream();
        }
        if (webcamStream && webcamStream.getVideoTracks().length > 0) {
          const cameraTrack = webcamStream.getVideoTracks()[0];
          console.log('[LiveKit] Publishing student camera track...');
          await room.localParticipant.publishTrack(cameraTrack, { name: 'camera' });
        }
      } catch (camErr) {
        console.warn('[LiveKit] Could not publish camera track:', camErr);
      }

      // 2. Notify backend that the stream is now connected
      if (effectiveAttemptId && effectiveAttemptId !== 'attempt') {
        try {
          await sendStudentHeartbeat(effectiveAttemptId, 'STREAM_CONNECTED');
        } catch (hbErr) {
          console.warn('[LiveKit] Initial heartbeat notice:', hbErr);
        }
      }

      // 3. Start screen share and publish track (non-blocking)
      try {
        let stream = screenStreamRef.current;
        if (!stream || stream.getVideoTracks().length === 0 || !stream.active) {
          const constraints = {
            video: {
              displaySurface: 'monitor',
              logicalSurface: true,
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 10, max: 15 }
            },
            audio: false
          };

          stream = await navigator.mediaDevices.getDisplayMedia(constraints).catch(err => {
            console.warn('[LiveKit] Screen sharing dismissed or not permitted:', err);
            return null;
          });

          if (stream) {
            screenStreamRef.current = stream;
          }
        }

        if (stream && stream.getVideoTracks().length > 0) {
          setIsScreenSharing(true);
          setConnectionStatus('Screen sharing active');

          const videoTrack = stream.getVideoTracks()[0];
          await room.localParticipant.publishTrack(videoTrack, { name: 'screen-share' });

          videoTrack.onended = () => {
            console.log('[LiveKit] Screen sharing track ended');
            setIsScreenSharing(false);
            setConnectionStatus('Screen sharing ended by user');
            stopAllTracks(stream);
          };
        }
      } catch (err) {
        console.warn('[LiveKit] Screen share setup note (camera feed active):', err);
      }

    } catch (error) {
      console.error('Error initializing LiveKit:', error);
      setConnectionStatus(`Error: ${error.message}. Retrying...`);
      reconnectAttempts.current++;
      setTimeout(setupPeerConnection, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, studentId, examAttemptId]);

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
    if (webcamStreamRef.current) {
      console.log('Webcam stream already exists');
      return webcamStreamRef.current;
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
      webcamStreamRef.current = stream;
      
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
          
          if (faceDetector && objectDetector && !detectionRunningRef.current) {
            console.log('All detectors ready, starting detection loop');
            detectionRunningRef.current = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          detectionRunningRef.current = true;
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
      detectionRunningRef.current = false;
      setDetectionRunning(false);
      
      // Clean up face detector
      if (faceDetector) {
        faceDetector.close();
      }
      
      // Clean up TensorFlow.js memory
      tf.dispose();
      
      // Stop all tracks in the stream
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        webcamStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed dependencies to prevent re-runs


  useEffect(() => {
    const loadExam = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (isInitializingAttempt.current) {
          console.log('Already initializing exam attempt, skipping concurrent loadExam call.');
          return false;
        }
        isInitializingAttempt.current = true;

        // 1. Authenticate student
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          isInitializingAttempt.current = false;
          throw new Error('User not authenticated. Please login again.');
        }
        setStudentId(user.id);

        // 2. Fetch basic exam metadata (title, duration_minutes, is_active)
        const { data: examMeta, error: metaError } = await supabase
          .from('exams')
          .select('id, title, duration_minutes, is_active')
          .eq('id', examId)
          .maybeSingle();

        if (metaError || !examMeta) {
          isInitializingAttempt.current = false;
          setError('Exam not found or unavailable.');
          return false;
        }

        // Check if instructor has locked the exam from dashboard
        if (examMeta.is_active === false) {
          console.warn('[Exam Lifecycle] Exam is locked by instructor.');
          isInitializingAttempt.current = false;
          navigate(`/exam/${examId}/blocked`, { replace: true });
          return false;
        }

        const durationMinutes = Number(examMeta.duration_minutes) || 90;
        const durationSeconds = durationMinutes * 60;

        // 3. Check if student already submitted or completed this exam
        const { data: userProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        const isUserAdmin = userProfile?.role === 'admin';

        const { data: completedAttempt } = await supabase
          .from('exam_attempts')
          .select('id, submitted_at, completed_at, status')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .or('submitted_at.not.is.null,completed_at.not.is.null,status.eq.completed')
          .maybeSingle();

        // Non-admin students who already submitted cannot retake
        if (completedAttempt && !isUserAdmin) {
          console.log('Student has already submitted this exam, redirecting to completion page...');
          isInitializingAttempt.current = false;
          navigate(`/exam/${examId}/done`, { replace: true });
          return false;
        }

        // 4. Check for an active (unsubmitted) attempt for this student and exam
        const { data: existingAttempt } = await supabase
          .from('exam_attempts')
          .select('id, answers, created_at, started_at, status')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .is('submitted_at', null)
          .maybeSingle();

        let _activeAttemptId = null;
        let loadedAnswers = {};
        let attemptStartTime = Date.now();

        if (existingAttempt) {
          const startTime = new Date(existingAttempt.started_at || existingAttempt.created_at).getTime();
          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
          const remainingSeconds = durationSeconds - elapsedSeconds;

          // If attempt is actively in progress within its duration, resume it!
          if (remainingSeconds > 0 && existingAttempt.status === 'in_progress') {
            console.log('Resuming active in-flight attempt:', existingAttempt.id);
            _activeAttemptId = existingAttempt.id;
            currentAttemptIdRef.current = existingAttempt.id;
            setExamAttemptId(existingAttempt.id);
            attemptStartTime = startTime;
            expiresAtRef.current = startTime + (durationSeconds * 1000);
            setTimeLeft(remainingSeconds);

            if (existingAttempt.answers) {
              loadedAnswers = existingAttempt.answers;
              setAnswers(existingAttempt.answers);
            }
          } else {
            // Attempt is stale/expired from hours or days ago. Close it and start fresh!
            console.log('[Exam Lifecycle] Closing stale attempt and provisioning fresh attempt:', existingAttempt.id);
            await supabase
              .from('exam_attempts')
              .update({ status: 'expired' })
              .eq('id', existingAttempt.id);

            const nowIso = new Date().toISOString();
            const { data: freshAttempt, error: freshErr } = await supabase
              .from('exam_attempts')
              .insert({
                exam_id: examId,
                student_id: user.id,
                started_at: nowIso,
                last_heartbeat_at: nowIso,
                status: 'in_progress',
                stream_status: 'STREAM_NOT_STARTED',
                answers: {},
                score: 0,
                submitted_at: null,
                completed_at: null
              })
              .select()
              .single();

            if (freshErr) throw freshErr;

            _activeAttemptId = freshAttempt.id;
            currentAttemptIdRef.current = freshAttempt.id;
            setExamAttemptId(freshAttempt.id);
            attemptStartTime = Date.now();
            expiresAtRef.current = attemptStartTime + (durationSeconds * 1000);
            setTimeLeft(durationSeconds);
            setAnswers({});
          }
          isInitializingAttempt.current = false;
        } else {
          // Double-check to prevent concurrent insertion race in Strict Mode
          const { data: doubleCheckAttempt } = await supabase
            .from('exam_attempts')
            .select('id, answers, created_at, started_at, status')
            .eq('exam_id', examId)
            .eq('student_id', user.id)
            .is('submitted_at', null)
            .maybeSingle();

          if (doubleCheckAttempt) {
            const startTime = new Date(doubleCheckAttempt.started_at || doubleCheckAttempt.created_at).getTime();
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
            const remainingSeconds = durationSeconds - elapsedSeconds;

            if (remainingSeconds > 0 && doubleCheckAttempt.status === 'in_progress') {
              console.log('Race condition prevented, resuming verified attempt:', doubleCheckAttempt.id);
              _activeAttemptId = doubleCheckAttempt.id;
              currentAttemptIdRef.current = doubleCheckAttempt.id;
              setExamAttemptId(doubleCheckAttempt.id);
              attemptStartTime = startTime;
              expiresAtRef.current = startTime + (durationSeconds * 1000);
              setTimeLeft(remainingSeconds);

              if (doubleCheckAttempt.answers) {
                loadedAnswers = doubleCheckAttempt.answers;
                setAnswers(doubleCheckAttempt.answers);
              }
            } else {
              await supabase
                .from('exam_attempts')
                .update({ status: 'expired' })
                .eq('id', doubleCheckAttempt.id);

              const nowIso = new Date().toISOString();
              const { data: freshAttempt, error: freshErr } = await supabase
                .from('exam_attempts')
                .insert({
                  exam_id: examId,
                  student_id: user.id,
                  started_at: nowIso,
                  last_heartbeat_at: nowIso,
                  status: 'in_progress',
                  stream_status: 'STREAM_NOT_STARTED',
                  answers: {},
                  score: 0,
                  submitted_at: null,
                  completed_at: null
                })
                .select()
                .single();

              if (freshErr) throw freshErr;

              _activeAttemptId = freshAttempt.id;
              currentAttemptIdRef.current = freshAttempt.id;
              setExamAttemptId(freshAttempt.id);
              attemptStartTime = Date.now();
              expiresAtRef.current = attemptStartTime + (durationSeconds * 1000);
              setTimeLeft(durationSeconds);
              setAnswers({});
            }
          } else {
            // Insert a new attempt record with submitted_at = null
            const nowIso = new Date().toISOString();
            const { data: newAttempt, error: insertError } = await supabase
              .from('exam_attempts')
              .insert({
                exam_id: examId,
                student_id: user.id,
                started_at: nowIso,
                last_heartbeat_at: nowIso,
                status: 'in_progress',
                stream_status: 'STREAM_NOT_STARTED',
                answers: {},
                score: 0,
                submitted_at: null,
                completed_at: null
              })
              .select()
              .single();

            if (insertError) {
              // Backward-compatibility fallback if started_at/status columns are not yet applied to DB
              console.warn('Initial insert with extended schema failed, retrying with core columns:', insertError.message);
              const { data: fallbackAttempt, error: fallbackError } = await supabase
                .from('exam_attempts')
                .insert({
                  exam_id: examId,
                  student_id: user.id,
                  answers: {},
                  score: 0,
                  submitted_at: null,
                  completed_at: null
                })
                .select()
                .single();

              if (fallbackError) {
                console.error('Error starting exam attempt in DB:', fallbackError);
                isInitializingAttempt.current = false;
                throw new Error('Could not initialize exam session on the server. Please try again.');
              }
              _activeAttemptId = fallbackAttempt.id;
              currentAttemptIdRef.current = fallbackAttempt.id;
              setExamAttemptId(fallbackAttempt.id);
              attemptStartTime = new Date(fallbackAttempt.created_at).getTime();
              expiresAtRef.current = attemptStartTime + (durationSeconds * 1000);
              setTimeLeft(durationSeconds);
            } else {
              console.log('Created new exam attempt in DB:', newAttempt.id);
              _activeAttemptId = newAttempt.id;
              currentAttemptIdRef.current = newAttempt.id;
              setExamAttemptId(newAttempt.id);
              attemptStartTime = new Date(newAttempt.started_at || newAttempt.created_at).getTime();
              expiresAtRef.current = attemptStartTime + (durationSeconds * 1000);
              setTimeLeft(durationSeconds);
            }
          }
          isInitializingAttempt.current = false;
        }

        // 5. Fetch sanitized exam configuration via secure RPC
        // (Active attempt is verified in DB, so get_student_exam_questions_v1 will return questions)
        const examData = await fetchExamDetails(examId);
        setExam(examData);

        if (!examData || !examData.questions || !Array.isArray(examData.questions) || examData.questions.length === 0) {
          isInitializingAttempt.current = false;
          setError('No questions found in this exam.');
          return false;
        }

        // Format and set questions
        const formattedQuestions = examData.questions.map((q, index) => ({
          id: q.id || `q-${index}`,
          question_text: q.question || q.question_text || '',
          options: q.type === 'mcq' ? [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) : (q.options || []),
          marks: q.marks || 1,
          type: q.type || 'mcq',
        }));
        setQuestions(formattedQuestions);
        
        // Re-initialize answers if not loaded from active attempt
        const initialAnswers = {};
        formattedQuestions.forEach(q => {
          initialAnswers[q.id] = loadedAnswers[q.id] !== undefined ? loadedAnswers[q.id] : '';
        });
        setAnswers(initialAnswers);

        setIsExamLoaded(true);
        isInitializingAttempt.current = false;
        return true;
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load exam.');
        isInitializingAttempt.current = false;
        return false;
      } finally {
        setIsLoading(false);
      }
    };

    // Sequential startup: setup webcam -> load exam & attempt -> connect LiveKit & recorder
    const startAssessment = async () => {
      try {
        isDisposedRef.current = false;
        await setupWebcamStream();
        const attemptReady = await loadExam();
        if (attemptReady) {
          await setupPeerConnection();
          console.log('Starting screen recording via react-media-recorder...');
          startRecording();
        }
      } catch (err) {
        console.error('Assessment startup error:', err);
      }
    };

    startAssessment();
    
    // Set up periodic status updates
    const statusInterval = setInterval(() => {
      if (roomRef.current && roomRef.current.state === 'connected') {
        setConnectionStatus(prev => {
          if (!prev.includes('Connected')) {
            return 'Connected to admin';
          }
          return prev;
        });
      }
    }, 10000);

    return () => {
      // Clean up resources
      cleanupResources();
      clearInterval(statusInterval);
      
      // Stop screen recording if active
      if (status === 'recording') {
        stopRecording();
      }
      // Clean up peer connection
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Authoritative Exam Countdown Timer
  useEffect(() => {
    if (!isExamLoaded || !examAttemptId) return;

    if (timeLeft <= 0) {
      toast.info("Exam time has expired. Submitting your assessment...");
      handleSubmit(null, { isAutoSubmit: true });
      return;
    }
    const timer = setInterval(() => {
      if (expiresAtRef.current) {
        const remaining = Math.max(0, Math.floor((expiresAtRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      } else {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, examAttemptId, isExamLoaded]);

  // 15-second heartbeat ping for session vitality
  useEffect(() => {
    if (!examAttemptId) return;

    const pingHeartbeat = async () => {
      try {
        const streamState = (roomRef.current && roomRef.current.state === 'connected')
          ? 'STREAM_CONNECTED'
          : (roomRef.current && roomRef.current.state === 'reconnecting')
            ? 'STREAM_RECONNECTING'
            : 'STREAM_DISCONNECTED';

        await sendStudentHeartbeat(examAttemptId, streamState);
      } catch (err) {
        console.warn('[Heartbeat] Ping notice (non-fatal):', err);
      }
    };

    pingHeartbeat();
    const interval = setInterval(pingHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [examAttemptId]);

  const handleOptionChange = async (questionId, selectedOption) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionId]: selectedOption };
      
      // Auto-save via examService (RPC or validated answers update)
      if (examAttemptId) {
        autoSaveAnswers(examAttemptId, updated);
      }
      return updated;
    });
  }

  const handleNextQuestion = () => {
    if (!questions || questions.length === 0) return;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmit();
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1)
  }

  const [_logs, setLogs] = useState([]);

  // Log event locally and to Supabase with valid attempt reference
  const logEvent = async (eventType, eventDetails = {}) => {
    setLogs(prev => [...prev, { eventType, eventDetails, timestamp: new Date().toISOString() }]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const targetAttemptId = currentAttemptIdRef.current || examAttemptId || null;
      await supabase.from('exam_logs').insert([
        {
          exam_attempt_id: targetAttemptId,
          student_id: userData?.user?.id || studentId,
          event_type: eventType,
          event_details: { ...eventDetails, exam_id: examId },
        }
      ]);
    } catch (err) {
      console.warn('Log error (non-fatal):', err);
    }
  };

  // Log exam event with valid attempt reference
  const logExamEvent = async (targetExamId, targetStudentId, eventType, eventDetails = {}) => {
    const timestamp = new Date().toISOString();
    const targetAttemptId = currentAttemptIdRef.current || examAttemptId || null;
    const logData = {
      timestamp,
      exam_id: targetExamId || examId,
      student_id: targetStudentId || studentId,
      exam_attempt_id: targetAttemptId,
      event_type: eventType,
      ...eventDetails
    };
    
    // Log to console for debugging
    console.log(`[Exam Monitor] ${eventType}`, logData);
    
    try {
      const { error } = await supabase
        .from('exam_logs')
        .insert([
          { 
            exam_attempt_id: targetAttemptId,
            student_id: targetStudentId || studentId,
            event_type: eventType,
            event_details: { ...eventDetails, exam_id: targetExamId || examId }
          }
        ]);

      if (error) {
        console.warn('[Exam Monitor] Notice logging to Supabase (non-fatal):', error);
      } else {
        console.log(`[Exam Monitor] Successfully logged ${eventType} to Supabase`);
      }
    } catch (error) {
      console.warn('[Exam Monitor] Error in logExamEvent (non-fatal):', error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examAttemptId]);

  // Function to calculate score
  const calculateScore = (answers, questions) => {
    if (!answers || !questions || !questions.length) return 0;
    let correct = 0;
    questions.forEach((q) => {
      if (q.correct_answer === answers[q.id]) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  // Function to upload blob to Cloudinary
  const uploadBlob = async (blob, userId, onProgress) => {
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
      const uploadResult = await uploadToCloudinary(file, userId, `examlytic/recordings/${examId}/${userId}`, onProgress);
      
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
        
        // If we have a valid attempt reference, update the record
        const targetAttemptId = currentAttemptIdRef.current || examAttemptId;
        if (targetAttemptId) {
          console.log('Updating exam attempt with recording URL, attempt ID:', targetAttemptId);
          const { error: updateError } = await supabase
            .from('exam_attempts')
            .update({ 
              recording_url: uploadResult.url,
              cloudinary_public_id: uploadResult.public_id,
              recording_duration: uploadResult.duration
            })
            .eq('id', targetAttemptId);
            
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
  const handleSubmit = async (e, options = {}) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const isAutoSubmit = options?.isAutoSubmit || false;
    if (!isAutoSubmit) {
      if (!window.confirm("Are you sure you want to submit the exam? You cannot change your answers after submission.")) return;
    }
    
    setIsSubmitting(true);
    setError(null);

    let user = null;
    let currentAttemptId = examAttemptId; // Store the current attempt ID

    try {
      // Get the current authenticated user
      const userResult = await supabase.auth.getUser();
      user = userResult?.data?.user;
      if (!user || userResult.error) {
        throw new Error('User not authenticated');
      }

      // Stop recording if it's active and wait for the blob
      let blobToUpload = recordingBlob;
      
      if (status === 'recording') {
        console.log('Stopping recording before submission...');
        
        const stopPromise = new Promise((resolve) => {
          onStopResolver.current = resolve;
          // Safety timeout in case onStop event is delayed
          setTimeout(() => {
            if (onStopResolver.current) {
              console.warn('stopRecording timeout elapsed (5s), proceeding with existing recordingBlob');
              resolve(recordingBlob);
              onStopResolver.current = null;
            }
          }, 5000);
        });
        
        stopRecording();
        
        // Wait for the onStop callback of useReactMediaRecorder to fire and resolve
        blobToUpload = await stopPromise;
        console.log('Received recording blob from stopped recorder:', blobToUpload);
      }

      // 1. Submit answers to server for authoritative scoring & completion
      let submitResult = null;
      if (currentAttemptId) {
        try {
          submitResult = await submitExamAttempt(currentAttemptId, answers, questions);
          console.log('Authoritative exam submission result:', submitResult);
        } catch (subErr) {
          console.warn('submitExamAttempt RPC notice, using fallback submission:', subErr);
        }
      }

      const finalScore = submitResult?.score !== undefined 
        ? submitResult.score 
        : calculateScore(answers, questions);
      const isExpired = submitResult?.status === 'expired' || 
        ((expiresAtRef.current && Date.now() > expiresAtRef.current) || timeLeft <= 0);

      // If no attempt existed, initialize submission attempt
      if (!currentAttemptId) {
        const nowIso = new Date().toISOString();
        const insertFields = {
          exam_id: examId,
          student_id: user.id,
          answers: answers,
          submitted_at: nowIso,
          completed_at: nowIso,
          status: isExpired ? 'expired' : 'completed',
          score: finalScore,
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

        currentAttemptId = inserted.id;
      }

      // 2. Upload video recording to Cloudinary with real-time feedback
      let uploadWarningMsg = null;
      if (blobToUpload && currentAttemptId) {
        const savedAttemptId = currentAttemptId;
        const savedUserId = user.id;
        console.log('Uploading proctoring recording for attempt:', savedAttemptId);
        setIsUploading(true);
        setUploadProgress(0);

        try {
          const uploadPromise = uploadBlob(blobToUpload, savedUserId, (percent) => {
            setUploadProgress(percent);
          });

          // Timeout safety: 45 seconds max
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Recording upload timed out after 45 seconds')), 45000)
          );

          const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

          if (uploadResult?.url) {
            console.log('Recording uploaded successfully to Cloudinary:', uploadResult.url);
            setRecordingUrl(uploadResult.url);
            await supabase
              .from('exam_attempts')
              .update({
                recording_url: uploadResult.url,
                cloudinary_public_id: uploadResult.public_id,
                recording_duration: uploadResult.duration || 0
              })
              .eq('id', savedAttemptId);
            console.log('Exam attempt successfully updated with recording URL');
          }
        } catch (uploadErr) {
          console.warn('Recording upload notice (non-fatal):', uploadErr);
          uploadWarningMsg = 'Screen recording upload could not complete due to network limits, but your answers were submitted successfully.';
          setUploadWarning(uploadWarningMsg);
        } finally {
          setIsUploading(false);
        }
      }

      // 3. Log completion event
      logExamEvent(examId, user.id, isExpired ? 'EXAM_EXPIRED' : 'EXAM_SUBMITTED', {
        score: finalScore,
        totalQuestions: questions.length
      });

      // 4. Mark older unsubmitted duplicate attempts as abandoned (never delete records)
      if (currentAttemptId) {
        supabase
          .from('exam_attempts')
          .update({ status: 'abandoned' })
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .is('submitted_at', null)
          .neq('id', currentAttemptId)
          .then(({ error }) => {
            if (error) console.warn('Mark older attempts notice:', error.message);
          });
      }

      // 5. Navigate to the done page with the current state
      navigate(`/exam/${examId}/done`, {
        state: {
          examId,
          answers,
          questions: questions, // Use the questions from state
          score: finalScore,
          totalQuestions: questions.length,
          warning: uploadWarningMsg || uploadWarning,
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
  if (isSubmitting) {
    return (
      <Loader 
        fullPage 
        message={isUploading 
          ? `Uploading your proctor recording... ${uploadProgress}%` 
          : "Submitting your exam responses securely..."
        } 
      />
    );
  }
  if (error) {
    return (
      <div className="login-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#DC2626', marginBottom: '12px' }}>
            Unable to Load Exam
          </h2>
          <p style={{ color: '#4B5563', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
            {error}
          </p>
          <button 
            className="next-question-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/examcode')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
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
          padding: 14px 36px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-logo-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
        }
        .brand-info-stack {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .brand-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-name {
          font-size: 19px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.4px;
        }
        .proctor-live-tag {
          font-size: 10px;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 2px 7px;
          border-radius: 100px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .brand-divider {
          width: 1px;
          height: 24px;
          background: #e2e8f0;
        }
        .exam-meta-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .exam-title-display {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
          max-width: 380px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .exam-subject-badge {
          font-size: 11px;
          font-weight: 600;
          color: #4f46e5;
          background: #eef2ff;
          padding: 3px 8px;
          border-radius: 6px;
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
          background: #ffffff;
          color: #1e293b;
          padding: 8px 18px;
          border-radius: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 16px;
          font-weight: 700;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: all 0.25s ease;
        }
        .timer-warning {
          background: #fffbeb;
          color: #b45309;
          border-color: #fde68a;
        }
        .timer-critical {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
          animation: timerPulse 1s infinite alternate;
        }
        @keyframes timerPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          100% { transform: scale(1.02); box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }
        .finish-exam-btn {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 10px 22px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
        }
        .finish-exam-btn:hover {
          background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          transform: translateY(-1px);
        }
        .finish-exam-btn:active {
          transform: translateY(0);
        }
        .finish-exam-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .exam-grid-new {
          display: grid;
          grid-template-columns: 290px 1fr 290px;
          gap: 24px;
          padding: 24px 36px;
          max-width: 1520px;
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
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .sidebar-card-title {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .palette-stats-badge {
          font-size: 11px;
          color: #4f46e5;
          background: #eef2ff;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 700;
        }
        .webcam-card-new {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          background: #0f172a;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .webcam-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .webcam-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 5;
          transform: scaleX(-1);
        }
        .webcam-live-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.75);
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 9px;
          border-radius: 100px;
          backdrop-filter: blur(6px);
          letter-spacing: 0.4px;
          z-index: 10;
        }
        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35);
          animation: pulseGreen 1.6s infinite;
        }
        @keyframes pulseGreen {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .webcam-timestamp {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(15, 23, 42, 0.75);
          color: #ffffff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 6px;
          backdrop-filter: blur(6px);
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
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .q-num-btn:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          transform: translateY(-1px);
        }
        .q-num-btn.active {
          border-color: #4f46e5;
          background: #eef2ff;
          color: #4f46e5;
          border-width: 2px;
          font-weight: 700;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
        }
        .q-num-btn.answered {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #ffffff;
        }
        .q-num-btn.flagged {
          background: #fdf4ff;
          border-color: #d8b4fe;
          color: #9333ea;
        }
        .q-num-btn.answered.flagged {
          background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
          border-color: #9333ea;
          color: #ffffff;
        }
        .completion-container {
          border-top: 1px solid #f1f5f9;
          padding-top: 16px;
        }
        .completion-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
        }
        .completion-bar-bg {
          width: 100%;
          height: 7px;
          background: #f1f5f9;
          border-radius: 10px;
          overflow: hidden;
        }
        .completion-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
          border-radius: 10px;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .integrity-card-new {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 14px;
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
          line-height: 1.45;
          color: #15803d;
        }
        .question-workspace-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 32px 36px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          min-height: 520px;
        }
        .workspace-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }
        .question-index-pill {
          background: #eef2ff;
          color: #4338ca;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid #e0e7ff;
          letter-spacing: 0.3px;
        }
        .flag-review-toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .flag-review-toggle:hover {
          color: #334155;
          background: #f1f5f9;
        }
        .flag-review-toggle.flagged {
          background: #fdf4ff;
          border-color: #d8b4fe;
          color: #9333ea;
        }
        .question-body-text {
          font-size: 18px;
          font-weight: 650;
          line-height: 1.55;
          color: #0f172a;
          margin-bottom: 26px;
        }
        .options-stack {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-bottom: 32px;
          flex: 1;
        }
        .custom-option-card {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-option-card:hover {
          border-color: #a5b4fc;
          background: #faf5ff;
          transform: translateY(-1px);
        }
        .custom-option-card.selected {
          background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
          border-color: #6366f1;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
        }
        .option-letter-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .custom-option-card.selected .option-letter-badge {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #ffffff;
        }
        .option-text-display {
          font-size: 15px;
          font-weight: 500;
          color: #334155;
          flex: 1;
          line-height: 1.45;
        }
        .custom-option-card.selected .option-text-display {
          color: #0f172a;
          font-weight: 600;
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
          border-color: #4f46e5;
        }
        .custom-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #4f46e5;
        }
        .custom-textarea-answer {
          width: 100%;
          min-height: 160px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          font-size: 15px;
          padding: 16px;
          box-sizing: border-box;
          resize: vertical;
          transition: all 0.2s ease;
          margin-bottom: 30px;
          flex: 1;
          font-family: inherit;
        }
        .custom-textarea-answer:focus {
          border-color: #6366f1;
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .navigation-bar-new {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 22px;
          border-top: 1px solid #f1f5f9;
        }
        .nav-text-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
          padding: 9px 18px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .nav-text-btn:hover:not(:disabled) {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #0f172a;
        }
        .nav-text-btn:disabled {
          color: #cbd5e1;
          border-color: #f1f5f9;
          cursor: not-allowed;
          background: #f8fafc;
        }
        .next-question-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 10px 22px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
        }
        .next-question-btn:hover {
          background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          transform: translateY(-1px);
        }
        .tool-box-inner {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
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
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          color: #2563eb;
          background: #eff6ff;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #dbeafe;
          overflow-x: auto;
          white-space: nowrap;
        }
        .scratchpad-area {
          width: 100%;
          height: 100px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
          font-size: 12px;
          box-sizing: border-box;
          resize: vertical;
          font-family: inherit;
          color: #334155;
        }
        .scratchpad-area:focus {
          border-color: #6366f1;
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
        .stat-dot.purple { background: #9333ea; }
        .stat-dot.blue { background: #4f46e5; }
        .stat-count-value {
          font-weight: 700;
          color: #0f172a;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 12px;
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
          border-radius: 10px;
          display: flex;
          align-items: center;
          background: #fffbeb;
          color: #92400e;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border: 1px solid #fef3c7;
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
        @media (max-width: 1080px) {
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
          <div className="brand-logo-badge">
            <FaLock size={16} />
          </div>
          <div className="brand-info-stack">
            <div className="brand-name-row">
              <span className="brand-name">Examlytic</span>
              <span className="proctor-live-tag">Active Proctor</span>
            </div>
          </div>
          <div className="brand-divider" />
          <div className="exam-meta-wrap">
            <span className="exam-title-display">
              {exam?.title || 'Midterm Assessment'}
            </span>
            {exam?.subject && <span className="exam-subject-badge">{exam.subject}</span>}
          </div>
        </div>
        <div className="header-controls">
          <div className={`timer-pill ${timeLeft < 60 ? 'timer-critical' : timeLeft < 300 ? 'timer-warning' : ''}`}>
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
            <canvas ref={canvasRef} className="webcam-canvas" />
            <div className="webcam-live-badge">
              <span className="pulse-dot" />
              <span>LIVE PROCTOR FEED</span>
            </div>
            <div className="webcam-timestamp">
              {formatDateTime(currentDateTime)}
            </div>
          </div>

          {/* Exam Progress Card */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <span>Question Palette</span>
              <span className="palette-stats-badge">
                {questions.filter(q => answers[q.id]).length}/{questions.length} Answered
              </span>
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
                <span>Overall Completion</span>
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
              Real-time video, screen activity, and audio compliance monitoring are strictly enabled.
            </div>
          </div>
        </section>

        {/* Center Main Workspace */}
        <section className="question-workspace-card">
          <div className="workspace-header">
            <div className="question-index-pill">
              QUESTION {currentQuestionIndex + 1} OF {questions.length}
            </div>
            <button 
              className={`flag-review-toggle ${flaggedQuestions[currentQuestion.id] ? 'flagged' : ''}`}
              onClick={() => setFlaggedQuestions(prev => ({ 
                ...prev, 
                [currentQuestion.id]: !prev[currentQuestion.id] 
              }))}
            >
              {flaggedQuestions[currentQuestion.id] ? <FaFlag /> : <FaRegFlag />}
              <span>{flaggedQuestions[currentQuestion.id] ? 'Flagged for Review' : 'Flag for Review'}</span>
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
                    <div className="option-letter-badge">{letter}</div>
                    <span className="option-text-display">{opt}</span>
                    <div className="custom-radio-circle">
                      {selected && <div className="custom-radio-inner" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <textarea
              className="custom-textarea-answer"
              placeholder="Type your notes or response details here..."
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
              <span>{flaggedQuestions[currentQuestion.id] ? 'Unflag Question' : 'Review Later'}</span>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaCalculator />
                <span>Reference Tools</span>
              </span>
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
                placeholder="Type your scratch notes here..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Navigation Card */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <span>Exam Summary</span>
            </div>
            <div className="stats-list-new">
              <div className="stat-row-new">
                <div className="stat-label-with-dot">
                  <div className="stat-dot blue" />
                  <span>Attempted</span>
                </div>
                <span className="stat-count-value">
                  {questions.filter(q => answers[q.id]).length}
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
                  <div className="stat-dot red" />
                  <span>Unanswered</span>
                </div>
                <span className="stat-count-value">
                  {questions.filter(q => !answers[q.id]).length}
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