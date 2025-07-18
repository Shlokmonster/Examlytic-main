import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useState } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import Navbar from "../Components/common/Navbar";
import Footer from "../Components/common/Footer";
import mathAnim from "../assets/math.json";
import csAnim from "../assets/cs.json";
import physicsAnim from "../assets/physics.json";
import defaultAnim from "../assets/default.json";
import launchAnim from "../assets/launch.json";
import "../ExamIntro.css";



export default function ExamIntro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exam } = useOutletContext() || {};
  const [hovering, setHovering] = useState(false);
  const [startingExam, setStartingExam] = useState(false);

  const handleStart = () => {
    setStartingExam(true);
    setTimeout(() => {
      if (id) navigate(`/exam/${id}/attempt`);
    }, 2000); // delay to show Lottie before navigating
  };

  const subjectLotties = {
    Math: mathAnim,
    CS: csAnim,
    ComputerScience: csAnim,
    Physics: physicsAnim,
  };

  const lottieToShow = subjectLotties[exam?.subject] || defaultAnim;

  if (!exam) {
    return (
      <div className="exam-page">
        <Navbar />
        <div className="exam-loading">Loading exam details...</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="exam-page">
      <Navbar />
      <div className="exam-container">
        {/* Left Sidebar */}
        <div className="exam-sidebar">
          <div className="lottie-box">
            <Player autoplay loop src={lottieToShow} />
          </div>
          <div className="support-box">
            <div className="support-title">Need Help?</div>
            <div className="support-contact">
              Reach out to:<br />
              <strong>{exam.support_email || "exam.support@itm.edu"}</strong>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="exam-details">
          <div>
            <div className="exam-title">{exam.title}</div>
            <div className="exam-subtext">Subject: {exam.subject || "General"}</div>
          </div>

          <hr className="divider" />

          <div className="exam-meta">
            <div className="meta-box">
              <span className="meta-label">Duration</span>
              <span className="meta-value">{exam.duration_minutes} min</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">Questions</span>
              <span className="meta-value">{exam.questions?.length || 0}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">Type</span>
              <span className="meta-value">MCQ</span>
            </div>
          </div>

          <div className="instructions">
            <h2>Instructions</h2>
            <ul className="instructions-list">
              {(exam.instructions || "No instructions provided.")
                .split("\n")
                .map((line, index) => (
                  <li key={index}>{line.trim()}</li>
                ))}
            </ul>
            <p className="exam-note">This test requires webcam and microphone access.</p>
          </div>

          <div style={{ textAlign: "center" }}>
            {startingExam ? (
              <Player autoplay src={launchAnim} style={{ height: 80, width: 80 }} />
            ) : (
              <button
                className="start-button"
                onClick={handleStart}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                {hovering ? (
                  <Player autoplay src={launchAnim} style={{ height: 24, width: 24 }} />
                ) : (
                  "Start Exam Now"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
