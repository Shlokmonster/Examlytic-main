import { useNavigate } from 'react-router-dom';
import { FaLock, FaThLarge, FaInfoCircle } from 'react-icons/fa';
import '../ExamBlocked.css';
import Navbar from '../Components/common/Navbar';

function ExamBlocked() {
  const navigate = useNavigate();

  const handleReturn = () => {
    // Navigate back to the exam code entry page
    navigate('/');
  };

  return (
    <div className="exam-blocked-page">
      {/* Top Navbar matching ExamIntro */}
      <Navbar />

      {/* Content Container */}
      <div className="blocked-main-wrapper">
        {/* Left Column - Information */}
        <div className="blocked-info-col">
          <div className="restriction-badge">
            <span className="badge-dot"></span>
            <span>SYSTEM RESTRICTION</span>
          </div>
          
          <h1>Exam Session Locked</h1>
          
          <p className="restriction-description">
            Your administrator has temporarily suspended access to this examination session. 
            This may be due to a scheduled maintenance window, an institutional hold, or a proctoring update.
          </p>
          
          <button className="btn-return-code" onClick={handleReturn}>
            <FaThLarge className="btn-grid-icon" />
            <span>Return to Examcode Page</span>
          </button>
          
          <div className="refresh-hint">
            <FaInfoCircle className="hint-info-icon" />
            <span>Session will automatically refresh when unlocked by proctor.</span>
          </div>
        </div>

        {/* Right Column - Locked Graphic */}
        <div className="blocked-graphic-col">
          <div className="lock-outer-circle">
            <div className="lock-inner-circle">
              <FaLock className="lock-center-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamBlocked;
