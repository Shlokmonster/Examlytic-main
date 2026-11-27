import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Room, RoomEvent } from 'livekit-client';
import { fetchLiveKitToken } from '../services/examService';
import { FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaUser, FaExclamationTriangle, FaInfoCircle, FaDesktop } from 'react-icons/fa';
import supabase from '../SupabaseClient';
import { useExamActivity } from '../context/ExamActivityProvider';

// Issue #4 Phase 1 — LiveKit identity is produced by ExamAttempt.jsx as
//   `student-<fullStudentUuid>-<epochMs>`
// The uuid itself contains hyphens, so the old `identity.split('-')[1]` only
// ever returned the first 8 hex characters (e.g. "fa544fd6") and Postgres
// rejected it with 22P02 (`invalid input syntax for type uuid`).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a real uuid (never for "unknown" / a truncated fragment). */
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

// Issue #4 UX — how close to the bottom still counts as "at the bottom".
const NEAR_BOTTOM_PX = 50;

const LiveMonitoring = ({ examId: propExamId, liveEvents: propLiveEvents, connectionStatus: propConnectionStatus }) => {
  const { examId: routeExamId } = useParams();
  const examId = propExamId || routeExamId;
  // Issue #4 — consume the SHARED admin activity channel. This component must
  // never open its own Supabase Realtime subscription; when rendered
  // standalone at /monitor/:examId it reads the same provider via context.
  const activity = useExamActivity();
  const liveEvents = useMemo(
    () => propLiveEvents ?? activity.events ?? [],
    [propLiveEvents, activity.events]
  );
  const connectionStatus = propConnectionStatus ?? activity.connectionStatus;
  const [students, setStudents] = useState([]);
  const [isMuted, setIsMuted] = useState({});
  const [fullscreen, setFullscreen] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Issue #4 UX — "↓ New activity" indicator + smart auto-scroll.
  const logsListRef = useRef(null);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const prevLogsCountRef = useRef(0);
  const prevStudentRef = useRef(null);
  const prevLogsOpenRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const roomRef = useRef(null);
  const connections = useRef({});
  const videoRefs = useRef({});
  const mediaStreams = useRef({});

  // Helper function to safely parse participant identity
  // Format: student___{attemptId}___{studentId}
  const parseParticipantIdentity = useCallback((identity) => {
    if (!identity) return { attemptId: null, studentId: 'unknown' };
    if (identity.includes('___')) {
      const parts = identity.split('___');
      return {
        attemptId: parts[1] || null,
        studentId: parts[2] || parts[1] || identity
      };
    }
    // Fallback for legacy format: student-{uuid}-{timestamp}
    const legacyMatch = identity.match(/^student-([0-9a-fA-F-]{36})(?:-\d+)?$/);
    if (legacyMatch) {
      return { attemptId: null, studentId: legacyMatch[1] };
    }
    return { attemptId: null, studentId: identity.replace(/^student-/, '') };
  }, []);

  // Fetch the selected student's recent logs (bounded, correctly scoped).
  // Phase 1 fix: `student_id` is a real uuid in Postgres, so a truncated
  // LiveKit fragment (e.g. "fa544fd6") or "unknown" must never reach
  // `.eq('student_id', ...)` — that returned 22P02 and broke this panel.
  const fetchExamLogs = useCallback(async (studentId) => {
    try {
      setIsLoadingLogs(true);
      setError(null); // Fix 3: Retry must clear the previous error state.

      // Fix 2 / Fix 4: refuse to send a non-uuid to PostgREST.
      if (!isUuid(studentId)) {
        setLogs([]);
        setError(
          studentId
            ? 'This student has no valid identifier yet, so their activity cannot be loaded.'
            : 'No student selected.'
        );
        return;
      }

      // Calculate timestamp for 3 minutes ago
      const threeMinutesAgo = new Date();
      threeMinutesAgo.setMinutes(threeMinutesAgo.getMinutes() - 3);

      const query = supabase
        .from('exam_logs')
        .select('*')
        .eq('student_id', studentId)
        .gte('created_at', threeMinutesAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to load recent activity logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // Handle student selection for logs
  const handleStudentSelect = (studentId) => {
    setSelectedStudent(studentId);
    setLogs([]); // never keep showing the previously selected student's rows
    setHasNewActivity(false);
    isNearBottomRef.current = true;
    fetchExamLogs(studentId);
    setIsLogsOpen(true);
  };

  // Live log feed: the initial bounded fetch + the shared realtime events for
  // the currently selected student, deduped by source:id.
  const displayedLogs = useMemo(() => {
    const keyOf = (row) => row.dedupeKey || `${row.source || 'exam_logs'}:${row.id}`;
    const map = new Map();
    (logs || []).forEach(row => { if (row) map.set(keyOf(row), row); });
    (liveEvents || []).forEach(ev => {
      if (!ev) return;
      const sid = ev.student_id ?? ev.studentId ?? ev.user_id;
      if (selectedStudent && String(sid) !== String(selectedStudent)) return;
      map.set(keyOf(ev), ev);
    });
    return [...map.values()].sort(
      (a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0)
    );
  }, [logs, liveEvents, selectedStudent]);

  // --- "↓ New activity" indicator -------------------------------------------
  // Only steal the viewport when the admin is already near the bottom. If they
  // scrolled up to read older logs we keep their position and surface a button
  // instead; clicking it smoothly jumps to the newest entry.
  const scrollLogsToBottom = useCallback(() => {
    const el = logsListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isNearBottomRef.current = true;
    setHasNewActivity(false);
  }, []);

  const handleLogsScroll = useCallback(() => {
    const el = logsListRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setHasNewActivity(false);
  }, []);

  useEffect(() => {
    const count = displayedLogs.length;
    const prevCount = prevLogsCountRef.current;
    const studentChanged = prevStudentRef.current !== selectedStudent;
    const justOpened = isLogsOpen && !prevLogsOpenRef.current;

    prevStudentRef.current = selectedStudent;
    prevLogsOpenRef.current = isLogsOpen;

    // New student selected: forget the previous student's scroll/indicator state.
    if (studentChanged) {
      prevLogsCountRef.current = count;
      isNearBottomRef.current = true;
      setHasNewActivity(false);
      return;
    }

    const grew = count > prevCount;
    prevLogsCountRef.current = count;

    if (!isLogsOpen || !logsListRef.current) return;

    if (grew) {
      if (isNearBottomRef.current) {
        scrollLogsToBottom();
      } else {
        setHasNewActivity(true);
      }
      return;
    }

    // Panel just (re)opened with existing rows: reveal the newest entry.
    if (justOpened && count > 0) {
      const el = logsListRef.current;
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
      setHasNewActivity(false);
    }
  }, [displayedLogs.length, isLogsOpen, selectedStudent, scrollLogsToBottom]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');
    
    // Close all peer connections
    Object.entries(connections.current).forEach(([, conn]) => {
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
    Object.entries(videoRefs.current).forEach(([, video]) => {
      if (video && video.srcObject) {
        video.srcObject = null;
      }
    });
    videoRefs.current = {};

    // Disconnect LiveKit room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
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

  // Handle incoming streams
  const handleIncomingStream = useCallback((studentId, stream, studentName = 'Student') => {
    console.log('Received stream for student:', studentId, stream);
    
    if (!stream || !stream.getTracks || stream.getTracks().length === 0) {
      console.error('Invalid stream received for student:', studentId);
      return;
    }

    // Store the stream
    mediaStreams.current[studentId] = stream;

    // Update student state
    setStudents(prev => {
      const exists = prev.some(s => s.id === studentId);
      if (exists) {
        return prev.map(s => s.id === studentId ? { ...s, stream, name: studentName, connected: true } : s);
      } else {
        return [
          ...prev,
          {
            id: studentId,
            name: studentName,
            stream,
            connected: true
          }
        ];
      }
    });

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
      let attempts = 0;
      const checkVideoRef = setInterval(() => {
        attempts++;
        if (videoRefs.current[studentId]) {
          clearInterval(checkVideoRef);
          setupVideo();
        } else if (attempts > 30) {
          clearInterval(checkVideoRef);
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
  }, [cleanupOldConnection]);

  // Initialize LiveKit connection
  useEffect(() => {
    let activeRoom = null;

    const setupLiveKit = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch LiveKit subscriber token via centralized exam service
        const { token, url } = await fetchLiveKitToken({
          roomName: `exam-${examId}`,
          participantName: `admin-${Date.now()}`,
          isPublisher: false,
        });

        const room = new Room();
        activeRoom = room;
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('Subscribed to track:', track.sid, 'from participant:', participant.identity);
          
          if (track.kind === 'video') {
            const mediaStream = new MediaStream([track.mediaStreamTrack]);
            
            // Extract student ID and details cleanly without UUID truncation
            const { studentId } = parseParticipantIdentity(participant.identity);
            const studentName = participant.name || 'Student';

            handleIncomingStream(studentId, mediaStream, studentName);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          const { studentId } = parseParticipantIdentity(participant.identity);
          cleanupOldConnection(studentId);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          const { studentId } = parseParticipantIdentity(participant.identity);
          cleanupOldConnection(studentId);
        });

        if (!url) {
          throw new Error('LiveKit streaming server URL is missing. Please verify server configuration.');
        }

        await room.connect(url, token);
        console.log('Admin connected to LiveKit room:', room.name);
        setIsLoading(false);

      } catch (err) {
        console.error('Error connecting to LiveKit room:', err);
        setError(`Failed to connect to monitoring service: ${err.message}`);
        setIsLoading(false);
      }
    };

    if (examId) {
      setupLiveKit();
    }

    return () => {
      console.log('Cleaning up LiveKit connection...');
      if (activeRoom) {
        activeRoom.disconnect();
      }
      cleanup();
    };
  }, [examId, cleanup, cleanupOldConnection, handleIncomingStream, parseParticipantIdentity]);

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

  // Format log messages with detailed information
  const formatLogMessage = (log) => {
    const details = log.event_details || log.payload || {};
    const eventType = String(log.event_type || log.eventType || log.type || '').toUpperCase();

    switch(eventType) {
      case 'TAB_SWITCH':
        return '⚠️ Tab switched';
      case 'WINDOW_BLUR':
        return '⚠️ Window lost focus';
      case 'WINDOW_FOCUS':
        return '✅ Window regained focus';
      case 'FULLSCREEN_EXIT':
        return '🖥️ Fullscreen mode exited';
      case 'SCREEN_SHARE_STOPPED':
        return '🖥️ Screen sharing stopped';
      case 'RIGHT_CLICK':
        return '🖱️ Right click detected';
      case 'COPY_CUT_PASTE':
        return '📋 Copy / cut / paste detected';
      case 'KEYBOARD_SHORTCUT':
        return '⌨️ Suspicious keyboard shortcut used';
      case 'EXAM_STARTED':
        return '▶️ Exam started';
      case 'EXAM_ENDED':
        return '⏹️ Exam ended';
    }

    switch(log.event_type) {
      case 'tab_change':
        return `🔄 Tab changed to: ${details.url || 'Unknown URL'}`;
      case 'window_blur':
        return '⚠️ Window lost focus';
      case 'window_focus':
        return '✅ Window regained focus';
      case 'copy':
        return '📋 Content was copied';
      case 'paste':
        return '📋 Content was pasted';
      case 'print':
        return '🖨️ Print attempt detected';
      case 'devtools':
        return '🔧 Developer tools were opened';
      case 'inactivity':
        return '⏱️ User inactive for too long';
      case 'multiple_faces':
        return '👥 Multiple faces detected';
      case 'face_not_visible':
        return '👤 Face not visible';
      case 'tab_switch':
        return '🔄 Browser tab switched';
      case 'fullscreen_exit':
        return '🖥️ Fullscreen mode exited';
      case 'keyboard_shortcut':
        return '⌨️ Suspicious keyboard shortcut used';
      case 'exam_submission':
        return '📝 Exam submitted';
      case 'page_visibility':
        return `👁️ Page visibility changed: ${details.isVisible ? 'Visible' : 'Hidden'}`;
      default:
        return `ℹ️ ${log.event_type || 'Activity detected'}: ${JSON.stringify(details)}`;
    }
  };

  return (
    <div className="live-monitoring">
      <div className="monitoring-header">
        <h2>Live Exam Monitoring</h2>
        <button 
          className="logs-toggle"
          onClick={() => setIsLogsOpen(!isLogsOpen)}
        >
          {isLogsOpen ? 'Hide Logs' : 'Show Activity Logs'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
          {selectedStudent && isUuid(selectedStudent) && (
            <button onClick={() => fetchExamLogs(selectedStudent)}>Retry</button>
          )}
        </div>
      )}
      
      <div className="monitoring-container">
        <div className={`students-section ${isLogsOpen ? 'with-logs' : ''}`}>
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Connecting to monitoring service...</p>
            </div>
          ) : (
            <div className="students-grid">
              {students.length > 0 ? (
                students.map(student => {
                  const canLoadLogs = isUuid(student.id);
                  return (
                    <div key={student.id}>
                      {renderStudentVideo(student)}
                      <button
                        className="view-logs-btn"
                        onClick={() => canLoadLogs && handleStudentSelect(student.id)}
                        disabled={!canLoadLogs}
                        title={canLoadLogs ? "View this student's recent activity" : "No valid student id for this participant yet"}
                      >
                        {canLoadLogs ? 'View Activity Logs' : 'Activity unavailable'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="no-students">
                  <FaUser size={48} />
                  <p>No students connected yet</p>
                  <p>Waiting for students to join...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isLogsOpen && (
          <div className="logs-section">
            <div className="logs-header">
              <h3>
                🔍 Activity Monitor {selectedStudent ? `(Student ${selectedStudent.substring(0, 8)})` : '(Last 3 mins)'}
                <span style={{ marginLeft: 10, fontSize: '0.72rem', fontWeight: 600, color: connectionStatus === 'SUBSCRIBED' ? '#10B981' : '#F59E0B' }}>
                  ● {connectionStatus === 'SUBSCRIBED' ? 'Live' : connectionStatus === 'DISABLED' ? 'Offline' : 'Reconnecting…'}
                </span>
              </h3>
              <button 
                className="close-logs"
                onClick={() => {
                  setIsLogsOpen(false);
                  setSelectedStudent(null);
                }}
                title="Close logs"
              >
                ×
              </button>
            </div>
            
            {isLoadingLogs ? (
              <div className="loading-logs">
                <div className="spinner"></div>
                <p>Loading activity logs...</p>
              </div>
            ) : displayedLogs.length > 0 ? (
              <div className="logs-list" ref={logsListRef} onScroll={handleLogsScroll}>
                {displayedLogs.map((log, index) => {
                  // Determine log severity
                  const logType = String(log.event_type || log.eventType || log.type || '').toUpperCase();
                  const isWarning = [
                    'TAB_CHANGE', 'WINDOW_BLUR', 'PRINT', 'DEVTOOLS',
                    'INACTIVITY', 'MULTIPLE_FACES', 'FACE_NOT_VISIBLE',
                    'TAB_SWITCH', 'FULLSCREEN_EXIT', 'KEYBOARD_SHORTCUT',
                    'SCREEN_SHARE_STOPPED', 'RIGHT_CLICK', 'COPY_CUT_PASTE'
                  ].includes(logType);
                  
                  return (
                    <div 
                      key={index} 
                      className={`log-item ${isWarning ? 'warning' : 'info'}`}
                      title={`Event type: ${log.event_type || log.eventType || log.type || 'activity'}`}
                    >
                      <div className="log-icon">
                        {isWarning ? (
                          <FaExclamationTriangle className="warning" />
                        ) : (
                          <FaInfoCircle className="info" />
                        )}
                      </div>
                      <div className="log-content">
                        <div className="log-message">
                          <span className="student-id">
                            {log.student_id || log.studentId
                            ? `Student ${String(log.student_id || log.studentId).substring(0, 8)}`
                            : 'System'}
                          </span>
                          {' - '}
                          {formatLogMessage(log)}
                        </div>
                        <div className="log-timestamp">
                          {new Date(log.created_at || log.createdAt || Date.now()).toLocaleTimeString()}
                          {(log.event_details || log.payload) && Object.keys(log.event_details || log.payload).length > 0 && (
                            <span className="log-details" title={JSON.stringify(log.event_details, null, 2)}>
                              [Details]
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-logs">
                <p>No recent activity detected</p>
              </div>
            )}

            {hasNewActivity && (
              <button
                type="button"
                className="new-activity-indicator"
                onClick={scrollLogsToBottom}
              >
                ↓ New activity
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .live-monitoring {
          padding: 20px;
          max-width: 1800px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .monitoring-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .monitoring-container {
          display: flex;
          gap: 20px;
        }
        
        .students-section {
          flex: 1;
          transition: all 0.3s ease;
        }
        
        .students-section.with-logs {
          width: 60%;
        }
        
        .logs-section {
          position: relative;
          width: 40%;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .logs-header {
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .logs-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #333;
        }
        
        .student-name {
          font-weight: 500;
          color: #555;
        }
        
        .close-logs {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
          padding: 0 5px;
          line-height: 1;
        }
        
        .close-logs:hover {
          color: #333;
        }
        
        .logs-list {
          flex: 1;
          overflow-y: auto;
          max-height: 70vh;
        }

        .new-activity-indicator {
          position: absolute;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          z-index: 2;
          animation: newActivityIn 0.25s ease;
        }

        .new-activity-indicator:hover {
          background: #1d4ed8;
        }

        @keyframes newActivityIn {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        
        .log-item {
          padding: 12px 20px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          transition: all 0.2s ease;
        }
        
        .log-item.warning {
          background-color: #fff8e6;
          border-left: 3px solid #ffc107;
        }
        
        .log-item.info {
          background-color: #f8f9fa;
          border-left: 3px solid #17a2b8;
        }
        
        .log-item:hover {
          background-color: #f1f1f1;
          transform: translateX(2px);
        }
        
        .student-id {
          font-weight: 600;
          color: #333;
        }
        
        .log-details {
          margin-left: 8px;
          font-size: 0.8em;
          color: #6c757d;
          cursor: help;
          text-decoration: underline;
          text-decoration-style: dotted;
        }
        
        .log-icon {
          font-size: 1rem;
          margin-top: 2px;
        }
        
        .log-icon .warning {
          color: #ff9800;
        }
        
        .log-icon .info {
          color: #2196f3;
        }
        
        .log-content {
          flex: 1;
        }
        
        .log-message {
          font-size: 0.9rem;
          color: #333;
          margin-bottom: 4px;
        }
        
        .log-timestamp {
          font-size: 0.75rem;
          color: #888;
        }
        
        .no-logs, .loading-logs {
          padding: 40px 20px;
          text-align: center;
          color: #666;
        }
        
        .logs-toggle, .view-logs-btn {
          background: #4a6cf7;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        
        .logs-toggle:hover, .view-logs-btn:hover {
          background: #3a5ce4;
        }
        
        .view-logs-btn {
          display: block;
          width: 100%;
          margin-top: 10px;
          background: #6c757d;
        }
        
        .view-logs-btn:hover {
          background: #5a6268;
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