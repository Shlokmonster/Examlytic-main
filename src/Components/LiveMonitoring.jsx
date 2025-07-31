import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaUser } from 'react-icons/fa';

const LiveMonitoring = () => {
  const [students, setStudents] = useState([]);
  const [isMuted, setIsMuted] = useState({});
  const [fullscreen, setFullscreen] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordedStreams, setRecordedStreams] = useState({});
  const mediaRecorders = useRef({});
  
  const peerRef = useRef(null);
  const connections = useRef({});
  const videoRefs = useRef({});
  const mediaStreams = useRef({});

  // Function to save stream data to localStorage with exam and student info
  const saveStreamToLocalStorage = useCallback((studentId, blob, metadata = {}) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        const recordings = JSON.parse(localStorage.getItem('studentRecordings') || '{}');
        const recordingKey = `${metadata.examId}_${studentId}`;
        
        recordings[recordingKey] = recordings[recordingKey] || {
          examId: metadata.examId,
          studentId: studentId,
          studentName: metadata.studentName || 'Unknown Student',
          examName: metadata.examName || 'Unknown Exam',
          recordings: []
        };
        
        recordings[recordingKey].recordings.push({
          timestamp: new Date().toISOString(),
          data: base64data
        });
        
        // Keep only the last 100 recordings per student per exam
        if (recordings[recordingKey].recordings.length > 100) {
          recordings[recordingKey].recordings = recordings[recordingKey].recordings.slice(-100);
        }
        
        localStorage.setItem('studentRecordings', JSON.stringify(recordings));
        setRecordedStreams(recordings);
      };
    } catch (err) {
      console.error('Error saving stream to localStorage:', err);
    }
  }, []);

  // Function to start recording a stream
  const startRecordingStream = useCallback((stream, studentId, metadata = {}) => {
    try {
      // Stop any existing recorder for this student
      if (mediaRecorders.current[studentId]) {
        mediaRecorders.current[studentId].stop();
      }

      // Create a MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5Mbps
      });

      const recordedChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
          saveStreamToLocalStorage(studentId, event.data, {
            examId: metadata.examId || 'unknown_exam',
            studentName: metadata.studentName || 'Unknown Student',
            examName: metadata.examName || 'Unknown Exam'
          });
        }
      };

      mediaRecorder.onstop = () => {
        // Cleanup
        delete mediaRecorders.current[studentId];
      };

      // Start recording, and save a chunk every 5 seconds
      mediaRecorder.start(5000);
      mediaRecorders.current[studentId] = mediaRecorder;

    } catch (err) {
      console.error('Error starting stream recording:', err);
    }
  }, [saveStreamToLocalStorage]);

  // Function to get all recordings for a student
  const getStudentRecordings = useCallback((studentId) => {
    try {
      const recordings = JSON.parse(localStorage.getItem('studentRecordings') || '{}');
      return recordings[studentId] || [];
    } catch (err) {
      console.error('Error getting student recordings:', err);
      return [];
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');
    
    // Stop all media recorders first
    Object.entries(mediaRecorders.current).forEach(([id, recorder]) => {
      try {
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
    });
    mediaRecorders.current = {};
    
    // Close all peer connections
    Object.entries(connections.current).forEach(([id, conn]) => {
      try {
        if (conn && typeof conn.close === 'function') {
          conn.off('stream');
          conn.off('close');
          conn.off('error');
          conn.close();
        }
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    });
    connections.current = {};

    // Stop all media recorders
    Object.entries(mediaRecorders.current).forEach(([id, recorder]) => {
      try {
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (e) {
        console.error('Error stopping recorder:', e);
      }
    });
    mediaRecorders.current = {};

    // Stop all media tracks
    Object.entries(mediaStreams.current).forEach(([id, stream]) => {
      if (stream && stream.getTracks) {
        console.log('Stopping tracks for stream:', id);
        stream.getTracks().forEach(track => {
          track.stop();
          track.onended = null;
        });
      }
    });
    mediaStreams.current = {};

    // Clear video elements
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (video && video.srcObject) {
        video.srcObject = null;
      }
    });
    videoRefs.current = {};

    // Destroy peer
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
  }, []);

  // Handle incoming streams
  const handleIncomingStream = useCallback((studentId, stream) => {
    console.log('Received stream for student:', studentId, stream);
    
    if (!stream || !stream.getTracks || stream.getTracks().length === 0) {
      console.error('Invalid stream received for student:', studentId);
      return;
    }

    // Store the stream
    mediaStreams.current[studentId] = stream;

    // Update student state
    setStudents(prev => 
      prev.map(s => s.id === studentId ? { ...s, stream, connected: true } : s)
    );

    // Set up video element
    const setupVideo = () => {
      const video = videoRefs.current[studentId];
      if (video && stream) {
        video.srcObject = stream;
        video.muted = true; // Mute by default
        video.play()
          .then(() => console.log('Video playing for student:', studentId))
          .catch(err => console.error('Error playing video:', err));
      }
    };

    // If video ref exists, set it up, otherwise wait for it
    if (videoRefs.current[studentId]) {
      setupVideo();
    } else {
      const checkVideoRef = setInterval(() => {
        if (videoRefs.current[studentId]) {
          clearInterval(checkVideoRef);
          setupVideo();
        }
      }, 100);
    }

    // Handle track ended
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.log('Track ended for student:', studentId);
        cleanupOldConnection(studentId);
      };
    });
  }, []);

  // Clean up old connection
  const cleanupOldConnection = useCallback((studentId) => {
    console.log('Cleaning up connection for student:', studentId);
    
    // Close connection
    if (connections.current[studentId]) {
      try {
        const conn = connections.current[studentId];
        conn.off('stream');
        conn.off('close');
        conn.off('error');
        conn.close();
        delete connections.current[studentId];
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }

    // Stop media stream
    if (mediaStreams.current[studentId]) {
      mediaStreams.current[studentId].getTracks().forEach(track => {
        track.stop();
        track.onended = null;
      });
      delete mediaStreams.current[studentId];
    }

    // Clear video element
    if (videoRefs.current[studentId]) {
      const video = videoRefs.current[studentId];
      if (video.srcObject) {
        video.srcObject = null;
      }
      delete videoRefs.current[studentId];
    }

    // Update state
    setStudents(prev => prev.filter(s => s.id !== studentId));
  }, []);

  // Initialize PeerJS
  useEffect(() => {
    // Use a fixed admin ID with a random suffix to avoid conflicts
    const adminId = 'admin-dashboard';
    console.log('Initializing PeerJS with ID:', adminId);
    
    // Clean up any existing peer
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    const peer = new Peer(adminId, {
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

    peerRef.current = peer;
    let reconnectTimer;

    // Peer event handlers
    peer.on('open', (id) => {
      console.log('PeerJS connected with ID:', id);
      setIsLoading(false);
      setError(null);
      
      // Clear any reconnect timer on successful connection
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      setError(`Connection error: ${err.message}`);
      
      // Try to reconnect on error
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          console.log('Attempting to reconnect...');
          cleanup();
          peerRef.current = null;
          const newPeer = new Peer(adminId, {
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
          peerRef.current = newPeer;
        }, 2000);
      }
    });

    // Handle incoming connections from students
    const handleIncomingConnection = (conn) => {
      console.log('New connection from student:', conn.peer);
      
      // Store the connection
      connections.current[conn.peer] = conn;
      
      conn.on('open', () => {
        console.log('Connection opened with student:', conn.peer);
      });

      conn.on('data', (data) => {
        console.log('Received data from student:', data);
        
        if (data.type === 'student-info') {
          setStudents(prev => {
            const exists = prev.some(s => s.id === data.studentId);
            return exists ? prev : [
              ...prev, 
              { 
                id: data.studentId, 
                name: data.studentName || 'Student', 
                connected: true 
              }
            ];
          });
          
          // Call the student to get their screen stream
          console.log('Calling student for screen sharing:', conn.peer);
          // REMOVE or COMMENT OUT this block:
          // const call = peer.call(conn.peer, null, {
          //   metadata: { type: 'screen-share' }
          // });
          // call.on('stream', ...);
          // call.on('error', ...);
          // connections.current[conn.peer] = call;
        }
      });

      conn.on('close', () => {
        console.log('Connection closed for student:', conn.peer);
        cleanupOldConnection(conn.peer);
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        cleanupOldConnection(conn.peer);
      });
    };

    // Set up connection handler
    peer.on('connection', handleIncomingConnection);
    
    // Handle incoming calls
    peer.on('call', (call) => {
      console.log('Incoming call from:', call.peer);
      call.answer(); // Answer the call with no media stream
      
      call.on('stream', (remoteStream) => {
        console.log('Received stream from student:', call.peer, remoteStream);
        handleIncomingStream(call.peer, remoteStream);
        
        // Get exam and student info from the call metadata or connection data
        const examId = call.metadata?.examId || 'unknown_exam';
        const studentName = call.metadata?.studentName || 'Unknown Student';
        const examName = call.metadata?.examName || 'Unknown Exam';
        
        startRecordingStream(remoteStream, call.peer, {
          examId,
          studentName,
          examName
        });
      });
      
      call.on('close', () => {
        console.log('Call ended with student:', call.peer);
        cleanupOldConnection(call.peer);
        
        // Stop the recorder for this student
        if (mediaRecorders.current[call.peer]) {
          mediaRecorders.current[call.peer].stop();
          delete mediaRecorders.current[call.peer];
        }
      });
      
      call.on('error', (err) => {
        console.error('Call error:', err);
        cleanupOldConnection(call.peer);
      });
    });

    // Clean up on unmount
    return () => {
      console.log('Cleaning up PeerJS...');
      cleanup();
    };
  }, [cleanup, cleanupOldConnection, handleIncomingStream]);

  // Toggle mute for a student's stream
  const toggleMute = useCallback((studentId) => {
    setIsMuted(prev => {
      const newMuted = {
        ...prev,
        [studentId]: !prev[studentId]
      };
      
      // Update video element
      const video = videoRefs.current[studentId];
      if (video) {
        video.muted = newMuted[studentId];
      }
      
      return newMuted;
    });
  }, []);

  // Toggle fullscreen for a student's video
  const toggleFullscreen = useCallback((studentId) => {
    const video = videoRefs.current[studentId];
    if (!video) return;

    if (fullscreen === studentId) {
      if (document.exitFullscreen) document.exitFullscreen();
      setFullscreen(null);
    } else {
      if (video.requestFullscreen) video.requestFullscreen();
      setFullscreen(studentId);
    }
  }, [fullscreen]);

  // Render student video
  const renderStudentVideo = (student) => (
    <div key={student.id} className="student-video-container">
      <video
        ref={el => {
          if (el) {
            videoRefs.current[student.id] = el;
            // If we have the stream but the video isn't playing yet
            if (student.stream && !el.srcObject) {
              el.srcObject = student.stream;
              el.play().catch(err => console.error('Error playing video:', err));
            }
          }
        }}
        autoPlay
        playsInline
        muted={isMuted[student.id] !== false} // Muted by default
        className="student-video"
      />
      <div className="student-info">
        <span>{student.name}</span>
        <div className="controls">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(student.id);
            }}
            className="control-button"
          >
            {isMuted[student.id] ? <FaVolumeMute /> : <FaVolumeUp />}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen(student.id);
            }}
            className="control-button"
          >
            {fullscreen === student.id ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="live-monitoring">
      <h2>Live Exam Monitoring</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      
      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Connecting to monitoring service...</p>
        </div>
      ) : (
        <div className="students-grid">
          {students.length > 0 ? (
            students.map(renderStudentVideo)
          ) : (
            <div className="no-students">
              <FaUser size={48} />
              <p>No students connected yet</p>
              <p>Waiting for students to join...</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .live-monitoring {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .error-message button {
          background: #c62828;
          color: white;
          border: none;
          padding: 5px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #09f;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .students-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 10px;
        }
        
        .student-video-container {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
          position: relative;
          padding-top: 56.25%; /* 16:9 Aspect Ratio */
          transition: transform 0.2s;
        }
        
        .student-video-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .student-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
        }
        
        .student-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
          color: white;
          padding: 12px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s;
        }
        
        .student-video-container:hover .student-info {
          background: rgba(0, 0, 0, 0.8);
        }
        
        .student-info span {
          font-weight: 500;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .controls {
          display: flex;
          gap: 8px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        .student-video-container:hover .controls {
          opacity: 1;
        }
        
        .control-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(5px);
        }
        
        .control-button:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
        
        .no-students {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #666;
          background: #f9f9f9;
          border-radius: 8px;
          margin-top: 20px;
          border: 2px dashed #ddd;
        }
        
        .no-students p {
          margin: 10px 0 0;
          color: #888;
        }
        
        .no-students p:first-of-type {
          font-size: 1.2em;
          font-weight: 500;
          margin-top: 15px;
          color: #555;
        }
      `}</style>
    </div>
  );
};

export default LiveMonitoring;