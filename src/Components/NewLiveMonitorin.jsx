import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { useParams } from 'react-router-dom';
import { FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaUser } from 'react-icons/fa';

const LiveMonitoring = () => {
  const { examId } = useParams();
  const [students, setStudents] = useState([]);
  const [isMuted, setIsMuted] = useState({});
  const [fullscreen, setFullscreen] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const peerRef = useRef(null);
  const connections = useRef({});
  const videoRefs = useRef({});
  const activeConnectionIds = useRef(new Set());
  
  // Cleanup function for peer connections
  const cleanupPeer = useCallback((fullCleanup = true) => {
    if (peerRef.current) {
      const peer = peerRef.current;
      if (!peer.destroyed) {
        peer.off('error');
        peer.off('open');
        peer.off('disconnected');
        peer.off('close');
        peer.off('connection');
        peer.off('call');
        
        if (fullCleanup) {
          peer.destroy();
        } else {
          peer.disconnect();
        }
      }
    }
    
    // Close all connections
    Object.entries(connections.current).forEach(([peerId, conn]) => {
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
    
    // Stop all video streams
    Object.values(videoRefs.current).forEach(video => {
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    });
    
    if (fullCleanup) {
      connections.current = {};
      videoRefs.current = {};
      activeConnectionIds.current.clear();
    }
  }, []);

  // Clean up old connections
  const cleanupOldConnection = useCallback((peerId) => {
    if (connections.current[peerId]) {
      try {
        connections.current[peerId].close();
      } catch (e) {
        console.error('Error closing old connection:', e);
      }
      delete connections.current[peerId];
      activeConnectionIds.current.delete(peerId);
      
      setStudents(prev => prev.filter(s => s.id !== peerId));
    }
  }, []);
  
  // Initialize PeerJS
  useEffect(() => {
    console.log('Initializing PeerJS...');
    
    const adminId = 'admin-dashboard';
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    let reconnectTimeout = null;
    let isMounted = true;
    
    const peerOptions = {
      debug: 3,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    };

    const serverOptions = [
      { host: '0.peerjs.com', port: 443, path: '/' },
      { host: '1.peerjs.com', port: 443, path: '/' }
    ];

    let currentServerIndex = 0;
    let peer;

    const tryNextServer = () => {
      if (!isMounted) return;
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      if (currentServerIndex >= serverOptions.length) {
        currentServerIndex = 0;
        reconnectAttempts++;
        
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.error('Failed to connect to PeerJS servers');
          return;
        }
        
        console.log(`Retrying servers (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      }

      const server = serverOptions[currentServerIndex++];
      console.log(`Connecting to PeerJS server: ${server.host}`);
      
      cleanupPeer(false);
      
      peer = new Peer(adminId, {
        ...peerOptions,
        ...server
      });
      
      peerRef.current = peer;
      setupPeerEventHandlers(peer);
    };

    const handleIncomingConnection = (conn) => {
      console.log('New connection from student:', conn.peer);
      
      conn.on('data', (data) => {
        if (data.type === 'student-info') {
          setStudents(prev => {
            const exists = prev.some(s => s.id === data.studentId);
            if (!exists) {
              return [...prev, {
                id: data.studentId,
                name: data.studentName || 'Student',
                connected: true,
                stream: null
              }];
            }
            return prev;
          });
          
          // Call the student to get their webcam stream
          const call = peer.call(conn.peer, null, {
            metadata: { type: 'webcam-call' }
          });
          
          call.on('stream', (remoteStream) => {
            setStudentsState(prev => prev.map(student => 
              student.id === conn.peer 
                ? { ...student, stream: remoteStream } 
                : student
            ));
          });
          
          call.on('close', () => {
            setStudentsState(prev => prev.map(student => 
              student.id === conn.peer 
                ? { ...student, connected: false, stream: null } 
                : student
            ));
          });
        }
      });
      
      conn.on('close', () => {
        setStudentsState(prev => prev.map(student => 
          student.id === conn.peer 
            ? { ...student, connected: false, stream: null } 
            : student
        ));
      });
      
      conn.on('error', (err) => {
        console.error('Connection error:', err);
      });
    };
    
    const setupPeerEventHandlers = (peerInstance) => {
      if (!isMounted) return;
      
      // Handle incoming connections from students
      peerInstance.on('connection', handleIncomingConnection);
      
      const handleError = (err) => {
        if (!isMounted) return;
        console.error('PeerJS Error:', err);
        
        // Handle ID conflict by generating a new one
        if (err.type === 'unavailable-id' || err.message?.includes('is taken')) {
          console.log('ID conflict detected, generating new ID...');
          reconnectAttempts = 0;
          adminId = generateUniqueId();
          reconnectTimeout = setTimeout(tryNextServer, 500);
          return;
        }
        
        // Handle network errors or server issues
        if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-disconnected') {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Connection error, retrying (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            reconnectTimeout = setTimeout(tryNextServer, 1000 * Math.min(reconnectAttempts, 5)); // Cap backoff at 5s
          } else {
            console.error('Max reconnection attempts reached. Please refresh the page.');
          }
        }
      };

      const handleDisconnected = () => {
        if (!isMounted) return;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Connection lost. Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          try {
            peerInstance.reconnect();
          } catch (e) {
            console.error('Error during reconnect:', e);
            reconnectTimeout = setTimeout(tryNextServer, 1000 * Math.min(reconnectAttempts, 5));
          }
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
        }
      };

      const handleClose = () => {
        if (!isMounted) return;
        console.log('Peer connection closed.');
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Reinitializing connection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectTimeout = setTimeout(tryNextServer, 1000 * Math.min(reconnectAttempts, 5));
        }
      };
      
      const handleOpen = () => {
        if (!isMounted) return;
        console.log('Successfully connected with ID:', adminId);
        reconnectAttempts = 0;
        currentServerIndex = 0; // Reset server index on successful connection
        peerInstance.currentId = adminId;
      };
      
      // Set up event listeners
      peerInstance.on('error', handleError);
      peerInstance.on('disconnected', handleDisconnected);
      peerInstance.on('close', handleClose);
      peerInstance.on('open', handleOpen);
      peerInstance.on('connection', handleIncomingConnection);
      
      // Store cleanup function
      peerInstance.cleanup = () => {
        peerInstance.off('error', handleError);
        peerInstance.off('disconnected', handleDisconnected);
        peerInstance.off('close', handleClose);
        peerInstance.off('open', handleOpen);
        peerInstance.off('connection', handleIncomingConnection);
      };
    };

    // Start with the first server
    peer = new Peer(adminId, {
      ...peerOptions,
      ...serverOptions[0]
    });
    
    peerRef.current = peer;
    setupPeerEventHandlers(peer);
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (peer && peer.cleanup) {
        peer.cleanup();
      }
      cleanupPeer();
    };

    const handlePeerOpen = (id) => {
      console.log('Admin peer ID:', id);
      fetchActiveSessions();
    };

    // Handle incoming connections from students
    const handleConnection = (conn) => {
      const peerId = conn.peer;
      console.log('New connection from:', peerId);
      
      // Clean up any existing connection from this peer
      if (connections.current[peerId]) {
        console.log('Replacing existing connection for peer:', peerId);
        cleanupOldConnection(peerId);
      }
      
      // Store the new connection
      connections.current[peerId] = conn;
      activeConnectionIds.current.add(peerId);
      
      // Handle incoming data (alerts, etc.)
      conn.on('data', (data) => {
        console.log('Received data from', peerId, ':', data);
        
        if (data.type === 'handshake') {
          // Update student info
          setStudents(prev => {
            // Remove any existing entries with this ID first
            const filtered = prev.filter(s => s.id !== peerId);
            return [...filtered, {
              id: peerId,
              name: data.userId || `Student-${peerId.slice(0, 6)}`,
              status: 'connected',
              connectedAt: new Date().toISOString(),
              lastActive: new Date().toISOString()
            }];
          });
        } else if (data.type === 'alert') {
          const alert = { 
            ...data, 
            id: Date.now(),
            studentId: conn.peer,
            timestamp: new Date().toISOString()
          };
          
          setAlerts(prev => [alert, ...prev].slice(0, 50));
          setActiveAlert(alert);
          
          // Auto-dismiss alert after 10 seconds
          setTimeout(() => {
            setActiveAlert(prev => prev === alert ? null : prev);
          }, 10000);
        }
      });

      conn.on('close', () => {
        console.log('Connection closed:', conn.peer);
        removeStudent(conn.peer);
      });
      
      conn.on('error', (err) => {
        console.error('Connection error:', err);
      });
    };

    peer.on('open', handlePeerOpen);
    peer.on('connection', handleConnection);
    peer.on('error', (err) => {
      console.error('Peer error:', err);
      
      // Try to reconnect on error
      if (err.type === 'peer-unavailable' || err.type === 'unavailable-id') {
        console.log('Attempting to reconnect...');
        cleanupPeer();
        setTimeout(() => {
        student.id === studentId 
          ? { ...student, stream, connected: true } 
          : student
      )
    );
    
    if (connections[studentId]) {
      connections[studentId].stream = stream;
    }
    
    if (videoRefs[studentId]) {
      const video = videoRefs[studentId];
      if (video) {
        video.srcObject = stream;
        video.play().catch(e => console.error('Error playing video:', e));
      }
    }
    
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.log('Track ended:', track.kind);
        // cleanupOldConnection(studentId);
      };
    });
    
    if (connections[studentId]) {
      connections[studentId].on('close', () => {
        console.log('Connection closed for student:', studentId);
        // cleanupOldConnection(studentId);
      });
      
      connections[studentId].on('error', (err) => {
        console.error('Connection error:', studentId, err);
        // cleanupOldConnection(studentId);
      });
    }
  }, [connections, videoRefs]);

  const toggleMute = useCallback((studentId) => {
    setIsMuted(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));  
  }, []);

  const toggleFullscreen = useCallback((studentId) => {
    const videoElement = videoRefs[studentId];
    if (!videoElement) return;

    if (fullscreen === studentId) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setFullscreen(null);
    } else {
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      } else if (videoElement.webkitRequestFullscreen) {
        videoElement.webkitRequestFullscreen();
      } else if (videoElement.msRequestFullscreen) {
        videoElement.msRequestFullscreen();
      }
      setFullscreen(studentId);
    }
  }, [fullscreen, videoRefs]);

  const renderStudentVideo = (student) => {
    return (
      <div key={student.id} style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        backgroundColor: '#fff',
        maxWidth: '400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {student.stream ? (
          <video
            ref={el => {
              if (el && student.stream) {
                el.srcObject = student.stream;
                setVideoRefs(prev => ({ ...prev, [student.id]: el }));
              }
            }}
            autoPlay
            playsInline
            muted={isMuted[student.id]}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              backgroundColor: '#000',
              aspectRatio: '16/9'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666'
          }}>
            <span>No video available</span>
          </div>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #eee'
        }}>
          <span style={{ fontWeight: '500' }}>{student.name}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMute(student.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isMuted[student.id] ? '#f44336' : '#4CAF50',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isMuted[student.id] ? 'Unmute' : 'Mute'}
            >
              {isMuted[student.id] ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen(student.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: fullscreen === student.id ? '#4CAF50' : '#2196F3',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={fullscreen === student.id ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen === student.id ? <FaCompress /> : <FaExpand />}
            </button>
                      .map(alert => (
                        <li key={alert.id} className="alert-item">
                          <div className="alert-header">
                            <span className="alert-time">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="alert-type">{alert.type}</span>
                          </div>
                          <div className="alert-message">{alert.message}</div>
                          {alert.details && (
                            <pre className="alert-details">
                              {JSON.stringify(alert.details, null, 2)}
                            </pre>
                          )}
                        </li>
                      ))
                    }
                  </ul>
                )}
              </div>
            </div>
          )}
          
                      🛑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="alerts-panel">
          <h3>Alerts</h3>
          {alerts.length === 0 ? (
            <p>No alerts yet</p>
          ) : (
            <ul className="alerts-list">
              {alerts.map(alert => (
                <li key={alert.id} className="alert-item">
                  <div className="alert-header">
                    <span className="alert-time">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="alert-type">{alert.type}</span>
                  </div>
                  <div className="alert-message">{alert.message}</div>
                  {alert.details && (
                    <pre className="alert-details">
                      {JSON.stringify(alert.details, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .monitoring-grid {
            grid-template-columns: 1fr;
          }
        }
        }
        
        .monitoring-layout {
          display: grid;
          grid-template-columns: 300px 1fr 300px;
          gap: 20px;
          margin-top: 20px;
        }
        
        .main-content {
          grid-column: 2 / 3;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .selected-student-view {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .selected-student-view .video-container {
          max-width: 800px;
          margin: 0 auto 20px;
        }
        
        .student-alerts {
          margin-top: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
        }
        
        .students-list {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }
        
        .student-item {
          background: white;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .student-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .status-badge {
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 10px;
          background: #e9ecef;
        }
        
        .status-badge.streaming {
          background: #d1fae5;
          color: #065f46;
        }
        
        .student-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        
        button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        
        .btn-warn {
          background: #fef3c7;
          color: #92400e;
        }
        
        .btn-danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        
        .video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          align-content: flex-start;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
          padding: 10px;
        }
        
        .video-container {
          position: relative;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16/9;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .video-container.selected {
          box-shadow: 0 0 0 3px #4f46e5;
        }
        
        .video-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .student-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.6);
          color: white;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .video-controls {
          display: flex;
          gap: 8px;
        }
        
        .video-controls button {
          background: rgba(255,255,255,0.2);
          color: white;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        
        .video-controls button.danger {
          background: rgba(220, 38, 38, 0.8);
        }
        
        .alerts-panel {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }
        
        .alerts-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .alert-item {
          background: white;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .alert-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 13px;
          color: #6b7280;
        }
        
        .alert-type {
          text-transform: capitalize;
          font-weight: 600;
        }
        
        .alert-message {
          margin: 8px 0;
          font-weight: 500;
        }
        
        .alert-details {
          font-size: 12px;
          background: #f3f4f6;
          padding: 8px;
          border-radius: 4px;
          overflow-x: auto;
          margin: 8px 0 0;
        }
      `}</style>
    </div>
  );
};

export default LiveMonitoring;
