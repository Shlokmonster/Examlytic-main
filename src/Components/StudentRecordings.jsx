import { useState, useEffect, useRef } from 'react';
import supabase from '../SupabaseClient';
import { FaPlay, FaPause, FaDownload, FaSpinner, FaVideo } from 'react-icons/fa';
import './StudentRecordings.css';

const StudentRecordings = ({ examId, studentId, onError }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const videoRef = useRef(null);
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => {
          console.error('Error playing video:', e);
          setError('Error playing video. The file might be corrupted or in an unsupported format.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle video end
  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  // Fetch student info from users table
  const fetchStudentInfo = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      // Return data with email as both email and name
      return {
        email: data?.email || '',
        full_name: data?.email?.split('@')[0] || 'Student'
      };
    } catch (error) {
      console.error('Error fetching student info:', error);
      return {
        email: '',
        full_name: 'Unknown Student'
      };
    }
  };

  // Fetch recordings
  useEffect(() => {
    const fetchRecordings = async () => {
      if (!examId || !studentId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get student info
        const studentData = await fetchStudentInfo(studentId);
        setStudentInfo(studentData);
        
        // Get the recording URLs from exam_attempts
        const { data: attempts, error } = await supabase
          .from('exam_attempts')
          .select(`
            id, 
            recording_url, 
            cloudinary_public_id, 
            submitted_at, 
            recording_duration,
            answers,
            score
          `)
          .eq('exam_id', examId)
          .eq('student_id', studentId)
          .not('recording_url', 'is', null)
          .order('submitted_at', { ascending: false });

        if (error) throw error;

        if (!attempts || attempts.length === 0) {
          setError('No recordings found for this student.');
          if (onError) onError('No recordings found for this student.');
          return;
        }

        const formattedRecordings = attempts.map(attempt => ({
          id: attempt.id,
          url: attempt.recording_url,
          publicId: attempt.cloudinary_public_id,
          submittedAt: attempt.submitted_at,
          duration: attempt.recording_duration || 0,
          score: attempt.score,
          answers: attempt.answers || {}
        }));

        setRecordings(formattedRecordings);
        if (onError) onError(null);
        setSelectedRecording(formattedRecordings[0]);
        
      } catch (err) {
        console.error('Error fetching recordings:', err);
        const errorMessage = 'Failed to load recordings. Please try again later.';
        setError(errorMessage);
        if (onError) onError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [examId, studentId, onError]);

  if (loading) return (
    <div className="loading-container" style={{ textAlign: 'center', padding: '20px' }}>
      <div className="spinner"></div>
      <p>Loading recordings...</p>
    </div>
  );
  
  if (error) {
    return (
      <div className="error-message" style={{ 
        padding: '20px', 
        background: '#ffebee', 
        borderRadius: '4px',
        color: '#c62828',
        textAlign: 'center'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="student-recordings-container">
      {studentInfo && (
        <div className="student-header">
          <h2>{studentInfo.full_name || 'Student'}'s Recordings</h2>
          {studentInfo.email && <p className="student-email">{studentInfo.email}</p>}
        </div>
      )}
      
      <div className="recordings-grid">
        {/* Recordings List */}
        <div className="recordings-list">
          <h3>Available Recordings</h3>
          {recordings.length > 0 ? (
            recordings.map((recording) => (
              <div 
                key={recording.id} 
                className={`recording-card ${selectedRecording?.id === recording.id ? 'active' : ''}`}
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="recording-card-header">
                  <span className="recording-date">
                    {formatDate(recording.submittedAt)}
                  </span>
                  {recording.score !== undefined && (
                    <span className="recording-score">
                    </span>
                  )}
                </div>
                <div className="recording-duration">
                  <FaVideo className="video-icon" />
                  <span>{formatDuration(recording.duration)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-recordings">
              <p>No recordings available</p>
            </div>
          )}
        </div>

        {/* Recording Player */}
        <div className="recording-player">
          {selectedRecording ? (
            <>
              <div className="video-container">
                <video 
                  ref={videoRef}
                  src={selectedRecording.url} 
                  className="recording-video"
                  onClick={togglePlayPause}
                  onEnded={handleVideoEnd}
                  controls={false}
                />
                <div className="video-controls">
                  <button 
                    className="control-button" 
                    onClick={togglePlayPause}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <FaPause /> : <FaPlay />}
                  </button>
                  <button 
                    className="control-button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setIsPlaying(false);
                      }
                    }}
                    aria-label="Restart"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
                    </svg>
                  </button>
                  <a 
                    href={selectedRecording.url} 
                    download={`recording-${selectedRecording.id}.mp4`}
                    className="control-button"
                    aria-label="Download"
                  >
                    <FaDownload />
                  </a>
                </div>
              </div>
              
              <div className="recording-meta">
                <div className="meta-item">
                  <span className="meta-label">Duration:</span>
                  <span>{formatDuration(selectedRecording.duration)}</span>
                </div>
                {selectedRecording.score !== undefined && (
                  <div className="meta-item">
                    <span className="meta-label">Score:</span>
                    <span className={`score ${selectedRecording.score >= 50 ? 'pass' : 'fail'}`}>
                      {selectedRecording.score}%
                    </span>
                  </div>
                )}
              </div>
              
              <div className="recording-actions">
                <a
                  href={selectedRecording.url}
                  download={`recording_${selectedRecording.id}_${new Date(selectedRecording.submittedAt).toISOString().split('T')[0]}.mp4`}
                  className="download-btn"
                >
                  <FaDownload /> Download Recording
                </a>
              </div>
            </>
          ) : (
            <div className="no-recording-selected">
              <p>Select a recording to play</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentRecordings;