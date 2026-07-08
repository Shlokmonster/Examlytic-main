import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import { 
  FaGraduationCap, 
  FaUser, 
  FaClock, 
  FaClipboardList, 
  FaVideo, 
  FaVolumeMute, 
  FaExpand, 
  FaBan, 
  FaInfoCircle, 
  FaCheckCircle,
  FaSpinner,
  FaArrowRight
} from "react-icons/fa";
import supabase from "../SupabaseClient";
import mathAnim from "../assets/math.json";
import csAnim from "../assets/cs.json";
import physicsAnim from "../assets/physics.json";
import defaultAnim from "../assets/default.json";
import launchAnim from "../assets/launch.json";
import "../ExamIntro.css";
import Loader from "../Components/common/Loader";
import Navbar from "../Components/common/Navbar";

export default function ExamIntro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exam } = useOutletContext() || {};
  const [startingExam, setStartingExam] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showTechModal, setShowTechModal] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          setUserProfile(userData || {
            user_name: user.email.split('@')[0],
            email: user.email
          });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };
    fetchUserProfile();
  }, []);

  const handleStart = () => {
    setStartingExam(true);
    setTimeout(() => {
      if (id) navigate(`/exam/${id}/attempt`);
    }, 2000); // delay to show launch anim
  };

  const subjectLotties = {
    Math: mathAnim,
    CS: csAnim,
    ComputerScience: csAnim,
    Physics: physicsAnim,
  };

  const lottieToShow = subjectLotties[exam?.subject] || defaultAnim;

  if (!exam) {
    return <Loader fullPage message="Loading assessment details..." />;
  }

  const instructorName = exam.instructor_name || 'Dr. Aris Thorne';
  const totalQuestions = exam.questions?.length || 40;

  return (
    <div className="exam-page">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="exam-main-content">
        {/* Breadcrumbs */}
        <div className="breadcrumbs">
          <span>Institutions</span>
          <span className="breadcrumb-divider">&gt;</span>
          <span>{exam.subject || 'Computer Science'}</span>
          <span className="breadcrumb-divider">&gt;</span>
          <span className="breadcrumb-active">{exam.id ? exam.id.slice(0, 5).toUpperCase() : 'CS402'}</span>
        </div>

        {/* Title Section */}
        <div className="exam-header-wrapper">
          <div className="exam-header-titles">
            <h1>{exam.title || 'Advanced Neural Networks —'}</h1>
            <h1 className="blue-title-accent">Midterm Assessment</h1>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="exam-dashboard-grid">
          {/* Column 1: Subject Details */}
          <div className="grid-col-1">
            <div className="details-card">
              <h3 className="card-section-label">SUBJECT DETAILS</h3>
              <div className="detail-item">
                <div className="detail-icon-wrapper"><FaGraduationCap /></div>
                <div className="detail-texts">
                  <div className="detail-label">Course</div>
                  <div className="detail-value">{exam.subject || 'Neural Architectures'}</div>
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-icon-wrapper"><FaClock /></div>
                <div className="detail-texts">
                  <div className="detail-label">Duration</div>
                  <div className="detail-value">{exam.duration_minutes || 120} Minutes</div>
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-icon-wrapper"><FaClipboardList /></div>
                <div className="detail-texts">
                  <div className="detail-label">Format</div>
                  <div className="detail-value">{totalQuestions} MCQs</div>
                </div>
              </div>
            </div>

            {/* Lottie Card */}
            <div className="session-lottie-card">
              <div className="lottie-header-bar">
                <span>Examlytic Exam Introduction</span>
              </div>
              <div className="lottie-box-wrapper">
                <Player autoplay loop src={lottieToShow} style={{ height: 180, width: 180 }} />
              </div>
            </div>
          </div>

          {/* Column 2: Assessment Overview & Quotes */}
          <div className="grid-col-2">
            <div className="overview-card">
              <h2>Assessment Overview</h2>
              <div className="overview-text-content">
                {exam.instructions ? (
                  exam.instructions.split('\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))
                ) : (
                  <>
                    <p>
                      This midterm examination evaluates your grasp of foundational and advanced deep learning architectures. 
                      Candidates are expected to demonstrate proficiency in identifying spatial hierarchies within <strong>Convolutional Neural Networks (CNNs)</strong> and 
                      managing sequential dependencies in <strong>Recurrent Neural Networks (RNNs)</strong>.
                    </p>
                    <p>
                      Specific emphasis will be placed on the mathematical derivation of <strong>Gradient Descent</strong> and the mitigation of 
                      vanishing/exploding gradients through normalization techniques.
                    </p>
                  </>
                )}
              </div>

              <div className="quote-block">
                <div className="quote-border-line"></div>
                <div className="quote-content">
                  <p className="quote-text">
                    "The beauty of a neural network lies not in its complexity, but in its ability to discover structure 
                    within chaos. Approach each problem as a layer of learning."
                  </p>
                  <span className="quote-author">— {instructorName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Security Policy */}
          <div className="grid-col-3">
            <div className="security-card">
              <div className="security-card-header">
                <h2>Security Policy</h2>
                <span className="security-badge">High Security</span>
              </div>

              <div className="security-policies-list">
                <div className="policy-item">
                  <div className="policy-icon-box"><FaVideo /></div>
                  <div className="policy-details">
                    <h4>Active Monitoring</h4>
                    <p>Webcam and microphone must remain on at all times.</p>
                  </div>
                </div>

                <div className="policy-item">
                  <div className="policy-icon-box"><FaVolumeMute /></div>
                  <div className="policy-details">
                    <h4>Quiet Environment</h4>
                    <p>Ensure no secondary noise or human presence is detected.</p>
                  </div>
                </div>

                <div className="policy-item">
                  <div className="policy-icon-box"><FaExpand /></div>
                  <div className="policy-details">
                    <h4>Tab Lockdown</h4>
                    <p>Switching tabs or windows will trigger an automatic flag.</p>
                  </div>
                </div>

                <div className="policy-item">
                  <div className="policy-icon-box"><FaBan /></div>
                  <div className="policy-details">
                    <h4>Restricted Materials</h4>
                    <p>No physical notes, secondary devices, or AI tools allowed.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Action Footer Bar */}
      <footer className="exam-action-footer">
        <div className="footer-left-warning">
          <FaInfoCircle className="info-icon" />
          <span>
            Ensure your <strong>system hardware acceleration</strong> is enabled and you have a stable 5Mbps connection.
          </span>
        </div>
        <div className="footer-right-buttons">
          <button className="btn-view-tech" onClick={() => setShowTechModal(true)}>
            View Technical Requirements
          </button>
          
          {startingExam ? (
            <button className="btn-enter-room active loading-btn" disabled>
              <FaSpinner className="spin mr-2" />
              Entering Room...
            </button>
          ) : (
            <button className="btn-enter-room active" onClick={handleStart}>
              Enter Exam Room
              <FaArrowRight className="arrow-icon" />
            </button>
          )}
        </div>
      </footer>

      {/* Technical Requirements Modal */}
      {showTechModal && (
        <div className="tech-modal-overlay" onClick={() => setShowTechModal(false)}>
          <div className="tech-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tech-modal-header">
              <h3>Technical Requirements</h3>
              <button className="close-modal-btn" onClick={() => setShowTechModal(false)}>&times;</button>
            </div>
            <div className="tech-modal-body">
              <div className="req-section">
                <h4>System Hardware Requirements</h4>
                <ul>
                  <li><strong>Webcam:</strong> Built-in or external camera (minimum 720p resolution) with permissions enabled.</li>
                  <li><strong>Microphone:</strong> Functional audio recording device with permissions enabled.</li>
                  <li><strong>Monitor:</strong> Minimum screen resolution of 1024x768. Multiple monitors are strictly prohibited.</li>
                </ul>
              </div>
              <div className="req-section">
                <h4>Software & Browser Compatibility</h4>
                <ul>
                  <li><strong>Browser:</strong> Latest version of Google Chrome, Mozilla Firefox, or Microsoft Edge.</li>
                  <li><strong>Permissions:</strong> Display Capture and entire screen sharing permission must be active.</li>
                  <li><strong>Hardware Acceleration:</strong> Must be enabled in browser advanced settings for stability.</li>
                </ul>
              </div>
              <div className="req-section">
                <h4>Network & Testing Environment</h4>
                <ul>
                  <li><strong>Internet Speed:</strong> Minimum 5 Mbps upload/download connection. Wired or close Wi-Fi recommended.</li>
                  <li><strong>Testing Environment:</strong> Private, well-lit room. Muted background with no other occupants.</li>
                  <li><strong>Prohibited Materials:</strong> No secondary monitors, notebooks, mobile devices, or AI tools.</li>
                </ul>
              </div>
            </div>
            <div className="tech-modal-footer">
              <button className="btn-close-modal-footer" onClick={() => setShowTechModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
