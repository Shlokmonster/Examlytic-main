import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Navbar from "../Components/common/Navbar";
import supabase from "../SupabaseClient";
import { FaDownload, FaUser, FaBook, FaCheck, FaThLarge, FaArrowLeft } from 'react-icons/fa';
import "../ExamDone.css";
import Loader from "../Components/common/Loader";

function ExamDone() {
  const location = useLocation();
  const navigate = useNavigate();
  const { examId: routeExamId } = useParams();
  
  // Resolve exam ID from route params or location state
  const { examId: stateExamId } = location.state || {};
  const examId = routeExamId || stateExamId;

  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [percentage, setPercentage] = useState(0);
  
  const [userProfile, setUserProfile] = useState(null);
  const [examInfo, setExamInfo] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);

  // Helper to retrieve answer regardless of storage shape
  const getAnswerFromData = (answersData, question, index) => {
    if (!answersData) return undefined;
    if (Array.isArray(answersData)) {
      if (typeof answersData[index] === 'string' || typeof answersData[index] === 'number') return answersData[index];
      const obj = answersData.find(a => a.questionId === question.id);
      return obj ? obj.answer : undefined;
    }
    if (typeof answersData === 'object') {
      return answersData[question.id];
    }
    return undefined;
  };

  // Helper to format submission timestamp in UTC matching the mockup
  const formatSubmissionDate = (date) => {
    const d = date ? new Date(date) : new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    
    const pad = (num) => String(num).padStart(2, '0');
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    const seconds = pad(d.getUTCSeconds());
    
    return `Submitted on ${month} ${day}, ${year} at ${hours}:${minutes}:${seconds} UTC`;
  };

  useEffect(() => {
    const fetchExamAndUserData = async () => {
      if (!examId) {
        setError('No exam code found.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching data for examId:', examId);
        
        // 1. Authenticate user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Auth error:', userError || 'No user found');
          throw new Error('Please login again.');
        }

        // 2. Fetch student info from the 'users' table
        const { data: userData, error: userDbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        setUserProfile(userData || {
          user_name: user.email.split('@')[0],
          email: user.email,
          id: user.id
        });

        // 3. Fetch exam data from the 'exams' table
        const { data: dbExamData, error: examErr } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle();
        
        if (examErr) {
          console.error('Error fetching exam details:', examErr);
          throw examErr;
        }
        
        if (!dbExamData) {
          console.error('No exam details found for ID:', examId);
          throw new Error('Exam not found.');
        }
        
        setExamInfo(dbExamData);

        // Process questions to handle different options format
        const questions = [];
        if (Array.isArray(dbExamData.questions)) {
          dbExamData.questions.forEach((q, i) => {
            try {
              const question = typeof q === 'string' ? JSON.parse(q) : q;
              const questionId = `q-${i}`;
              
              const options = [];
              const optionLetters = ['A', 'B', 'C', 'D'];
              optionLetters.forEach(letter => {
                const optionKey = `option${letter}`;
                if (question[optionKey]) {
                  options.push({
                    letter,
                    text: question[optionKey],
                    value: letter
                  });
                }
              });

              questions.push({
                id: questionId,
                text: question.text || question.question || `Question ${i + 1}`,
                options,
                correctAnswer: question.correct_answer || question.correctAnswer,
                ...question
              });
            } catch (e) {
              console.error(`Error parsing question ${i}:`, e);
              questions.push({
                id: `q-${i}`,
                text: `Question ${i + 1}`,
                options: []
              });
            }
          });
        }

        // 4. Fetch attempt data from 'exam_attempts'
        const { data: attemptRow, error: attErr } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (attErr) {
          console.error('Error fetching attempt:', attErr);
          throw attErr;
        }

        let answers = [];
        let submissionTime = new Date();

        if (attemptRow) {
          if (attemptRow.submitted_at) {
            submissionTime = new Date(attemptRow.submitted_at);
          }
          setSubmittedAt(submissionTime);

          if (attemptRow.answers) {
            try {
              const rawAnswers = typeof attemptRow.answers === 'string' 
                ? JSON.parse(attemptRow.answers) 
                : attemptRow.answers;

              if (Array.isArray(rawAnswers)) {
                answers = rawAnswers;
              } else if (typeof rawAnswers === 'object') {
                answers = Object.entries(rawAnswers).map(([questionId, answer]) => ({
                  questionId,
                  answer
                }));
              }
            } catch (e) {
              console.error('Error parsing answers:', e);
            }
          }
        } else {
          // Fallback to location state answers if attempt not written to DB yet
          const { answers: stateAnswers } = location.state || {};
          if (stateAnswers) {
            if (Array.isArray(stateAnswers)) {
              answers = stateAnswers;
            } else if (typeof stateAnswers === 'object') {
              answers = Object.entries(stateAnswers).map(([questionId, answer]) => ({
                questionId,
                answer
              }));
            }
          }
          setSubmittedAt(new Date());
        }

        // Calculate score
        let correctAnswersCnt = 0;
        questions.forEach((q, idx) => {
          const ans = getAnswerFromData(answers, q, idx);
          if (q.correctAnswer === ans) correctAnswersCnt++;
        });
        const examScore = questions.length > 0 ? (correctAnswersCnt / questions.length) * 100 : 0;

        setExamData({ questions, answers });
        setScore(correctAnswersCnt);
        setTotalQuestions(questions.length);
        setPercentage(examScore);
        setLoading(false);
      } catch (err) {
        console.error('Error processing exam results from DB:', err);
        
        // Try fallback to location.state details
        try {
          const { answers: stateAnswers, questions: stateQuestions, score: stateScore, totalQuestions: stateTotal } = location.state || {};
          if (stateAnswers && stateQuestions) {
            setExamData({ questions: stateQuestions, answers: stateAnswers });
            setScore(stateScore || 0);
            setTotalQuestions(stateTotal || stateQuestions.length);
            setPercentage(stateQuestions.length > 0 ? ((stateScore || 0) / stateQuestions.length) * 100 : 0);
            setSubmittedAt(new Date());
            setLoading(false);
            return;
          }
        } catch (innerErr) {
          console.error('Fallback failed:', innerErr);
        }

        setError(err.message || 'Failed to fetch exam data');
        setLoading(false);
      }
    };

    fetchExamAndUserData();
  }, [examId, location.state]);

  const generatePDF = async () => {
    if (!examData || !examData.questions) {
      setError('There is no exam data to generate the PDF.');
      return;
    }
    try {
      let answersArray = [];
      const { data: { user } } = await supabase.auth.getUser();
      
      if (examData.answers) {
        if (Array.isArray(examData.answers)) {
          answersArray = examData.answers;
        } else if (typeof examData.answers === 'object') {
          answersArray = Object.entries(examData.answers).map(([questionId, answer]) => ({
            questionId,
            answer
          }));
        }
      }
      
      if (answersArray.length === 0 && user && examId) {
        const { data, error } = await supabase
          .from('exam_attempts')
          .select('answers')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (!error && data?.answers) {
          const rawAnswers = typeof data.answers === 'string' ? JSON.parse(data.answers) : data.answers;
          if (Array.isArray(rawAnswers)) {
            answersArray = rawAnswers;
          } else if (typeof rawAnswers === 'object') {
            answersArray = Object.entries(rawAnswers).map(([questionId, answer]) => ({
              questionId,
              answer
            }));
          }
        }
      }

      const totalQs = examData.questions.length;
      const correctCount = examData.questions.reduce((acc, q, idx) => {
        const answerObj = answersArray.find(a => 
          a.questionId === q.id || a.questionId === `q-${idx}`
        );
        const userAnswer = answerObj ? answerObj.answer : undefined;
        return userAnswer === q.correctAnswer ? acc + 1 : acc;
      }, 0);
      const percent = totalQs > 0 ? (correctCount / totalQs) * 100 : 0;

      // Initialize jsPDF (A4 page: 210mm x 297mm)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (2 * margin); // 180mm
      
      let y = 20; // Current Y position in mm
      let currentPage = 1;

      const drawHeaderBranding = () => {
        // Draw top line header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(5, 150, 105); // Examlytic Green (#059669)
        pdf.text("Examlytic", margin, y);
        
        pdf.setFont("helvetica", "light");
        pdf.setFontSize(18);
        pdf.setTextColor(209, 213, 219); // Light Divider
        pdf.text("|", margin + 31, y - 0.5);
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(75, 85, 99); // Dark grey text
        pdf.text("PROCTORED WORKSPACE", margin + 35, y - 1);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175); // Light grey text
        pdf.text("OFFICIAL REPORT", pageWidth - margin - 30, y - 1);
        
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y + 4, pageWidth - margin, y + 4);
        
        y += 12;
      };

      // Helper to add a new page if we exceed vertical limit
      const checkPageBreak = (neededHeight) => {
        if (y + neededHeight > 270) {
          pdf.addPage();
          currentPage++;
          y = 20;
          drawHeaderBranding();
        }
      };

      // Draw initial page header
      drawHeaderBranding();

      // Draw Candidate Info Box
      checkPageBreak(50);
      
      // Draw background rect
      pdf.setFillColor(248, 250, 252); // #F8FAFC
      pdf.setDrawColor(229, 231, 235); // #E5E7EB
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, y, contentWidth, 36, 3, 3, "FD");

      // Column 1: Candidate Name & Email
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CANDIDATE NAME", margin + 6, y + 8);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(17, 24, 39);
      pdf.text(userProfile?.user_name || userProfile?.email?.split('@')[0] || 'Candidate', margin + 6, y + 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CANDIDATE EMAIL", margin + 6, y + 23);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      pdf.text(userProfile?.email || 'N/A', margin + 6, y + 29);

      // Column 2: Assessment Title & Date
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("ASSESSMENT TITLE", margin + 96, y + 8);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(17, 24, 39);
      const titleLines = pdf.splitTextToSize(examInfo?.title || 'Exam', 78);
      pdf.text(titleLines, margin + 96, y + 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("DATE COMPLETED", margin + 96, y + 23);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      pdf.text(formatSubmissionDate(submittedAt), margin + 96, y + 29);

      y += 42;

      // Draw Performance Score Band
      checkPageBreak(22);
      pdf.setFillColor(230, 244, 234); // Light Green #E6F4EA
      pdf.setDrawColor(167, 243, 208); // Green border #A7F3D0
      pdf.roundedRect(margin, y, contentWidth, 14, 3, 3, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(4, 120, 87); // Dark Green #047857
      pdf.text("Performance Result", margin + 6, y + 9);

      const scoreText = `${correctCount} / ${totalQs} (${Math.round(percent)}%)`;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(scoreText, pageWidth - margin - 6, y + 9, { align: "right" });

      y += 22;

      // Response Summary Header
      checkPageBreak(15);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(17, 24, 39);
      pdf.text("Response Summary", margin, y);
      
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, y + 3, pageWidth - margin, y + 3);
      y += 10;

      // Questions List
      examData.questions.forEach((question, index) => {
        const answerObj = answersArray.find(a => a.questionId === question.id || a.questionId === `q-${index}`);
        const ansVal = answerObj ? answerObj.answer : undefined;
        const isCorrect = (question.correctAnswer === ansVal);

        const qTitle = question.text || question.question || question.question_text || `Question ${index + 1}`;
        const cleanQTitle = `Question ${index + 1}: ${qTitle}`;
        const questionLines = pdf.splitTextToSize(cleanQTitle, contentWidth - 12);
        const questionHeight = questionLines.length * 4.5;

        // Calculate card height dynamically
        let optionsHeight = 0;
        const formattedOpts = [];

        if (question.options && question.options.length > 0) {
          question.options.forEach(opt => {
            const isUserChoice = (ansVal === opt.letter || ansVal === opt.value || ansVal === opt.text);
            const isCorrectChoice = (question.correctAnswer === opt.letter || question.correctAnswer === opt.value || question.correctAnswer === opt.text);
            
            let statusText = '';
            if (isUserChoice) {
              statusText = isCorrect ? ' [Your Answer - Correct]' : ' [Your Answer - Incorrect]';
            } else if (isCorrectChoice) {
              statusText = ' [Correct Answer]';
            }

            const optLine = `Option ${opt.letter || opt.value}: ${opt.text}${statusText}`;
            const optLines = pdf.splitTextToSize(optLine, contentWidth - 16);
            formattedOpts.push({ optLines, isUserChoice, isCorrectChoice, isCorrect });
            optionsHeight += optLines.length * 4.5 + 2; // line height + padding
          });
        } else {
          const respText = `Your Response: ${ansVal || 'Not answered'} ${isCorrect ? '(Correct)' : `(Incorrect, Correct: ${question.correctAnswer || 'N/A'})`}`;
          const respLines = pdf.splitTextToSize(respText, contentWidth - 16);
          formattedOpts.push({ optLines: respLines, isUserChoice: false, isCorrectChoice: false, isCorrect });
          optionsHeight += respLines.length * 4.5 + 4;
        }

        const totalCardHeight = 10 + questionHeight + optionsHeight + 12; // Header + Q + Options + Footer
        checkPageBreak(totalCardHeight);

        // Draw Card Box
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(margin, y, contentWidth, totalCardHeight, 2, 2, "FD");

        // Question Title (Inside box)
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin + 0.1, y + 0.1, contentWidth - 0.2, 8, 2, 2, "F"); // top part bg
        pdf.rect(margin + 0.1, y + 4, contentWidth - 0.2, 4 + questionHeight, "F"); // fill main area
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(5, 150, 105); // Green accent for Question Number
        pdf.text(`Question ${index + 1}`, margin + 6, y + 6);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(17, 24, 39);
        pdf.text(questionLines, margin + 6, y + 13);

        let currentOptionY = y + 13 + questionHeight + 4;

        // Draw Options
        formattedOpts.forEach(o => {
          const h = o.optLines.length * 4.5 + 1.5;
          if (o.isUserChoice) {
            pdf.setFillColor(o.isCorrect ? 240 : 254, o.isCorrect ? 253 : 242, o.isCorrect ? 244 : 242);
            pdf.setDrawColor(o.isCorrect ? 134 : 252, o.isCorrect ? 239 : 165, o.isCorrect ? 172 : 165);
            pdf.roundedRect(margin + 4, currentOptionY, contentWidth - 8, h, 1.5, 1.5, "FD");
            pdf.setTextColor(o.isCorrect ? 21 : 185, o.isCorrect ? 128 : 28, o.isCorrect ? 61 : 28);
            pdf.setFont("helvetica", "bold");
          } else if (o.isCorrectChoice) {
            pdf.setFillColor(240, 253, 244);
            pdf.setDrawColor(134, 239, 172);
            pdf.roundedRect(margin + 4, currentOptionY, contentWidth - 8, h, 1.5, 1.5, "FD");
            pdf.setTextColor(21, 128, 61);
            pdf.setFont("helvetica", "bold");
          } else {
            pdf.setTextColor(75, 85, 99);
            pdf.setFont("helvetica", "normal");
          }
          pdf.setFontSize(9);
          pdf.text(o.optLines, margin + 8, currentOptionY + 4);
          currentOptionY += h + 2;
        });

        // Draw Footer area inside card
        pdf.setFillColor(isCorrect ? 236 : 254, isCorrect ? 253 : 242, isCorrect ? 245 : 242);
        pdf.setDrawColor(isCorrect ? 167 : 252, isCorrect ? 243 : 165, isCorrect ? 208 : 165);
        pdf.rect(margin + 0.1, y + totalCardHeight - 8.1, contentWidth - 0.2, 8, "F");
        pdf.line(margin, y + totalCardHeight - 8, margin + contentWidth, y + totalCardHeight - 8);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(isCorrect ? 6 : 153, isCorrect ? 95 : 27, isCorrect ? 70 : 27);
        pdf.text(isCorrect ? "✓ Correct Response" : "✗ Incorrect Response", margin + 6, y + totalCardHeight - 3);

        pdf.setTextColor(75, 85, 99);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Points: ${isCorrect ? "1.0 / 1.0" : "0.0 / 1.0"}`, pageWidth - margin - 6, y + totalCardHeight - 3, { align: "right" });

        y += totalCardHeight + 10;
      });

      // Pagination numbering on all pages
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        pdf.text("Generated by Examlytic Workspace", margin, pageHeight - 8);
      }

      pdf.save(`exam-answers-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return <Loader fullPage message="Processing your exam results..." />;
  }

  if (error) {
    return (
      <div className="exam-done-page-wrapper">
        <Navbar />
        <div className="exam-done-main-content">
          <div className="exam-done-card-container">
            <div className="error-alert">
              <strong>Error: </strong>
              <span>{error}</span>
            </div>
            <button
              onClick={() => navigate('/examcode')}
              className="back-button"
            >
              <FaArrowLeft className="icon" /> Back to Exam Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-done-page-wrapper">
      <Navbar />
      <div className="exam-done-main-content">
        <div className="exam-done-card-container">
          
          {/* Top Success Badge */}
          <div className="success-badge-container">
            <div className="dashed-ring">
              <div className="purple-shield-circle">
                <svg className="shield-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M9 11L11 13L15 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Heading */}
          <h1 className="exam-done-title">Exam Completed</h1>
          <p className="exam-done-subtitle">
            Your assessment has been successfully captured and encrypted. Your session integrity was verified by our proctoring engine.
          </p>

          {/* Side-by-side Information Cards */}
          <div className="info-cards-grid">
            {/* Card 1: Student Identity */}
            <div className="info-card">
              <div className="info-card-left">
                <div className="icon-wrapper student-icon-bg">
                  <FaUser className="card-icon student-color" />
                </div>
              </div>
              <div className="info-card-right">
                <span className="info-card-label">STUDENT IDENTITY</span>
                <h2 className="info-card-value">
                  {userProfile?.user_name || userProfile?.email?.split('@')[0] || 'Student'}
                </h2>
                <div className="student-id-badge">
                  ID: {userProfile?.id ? userProfile.id.slice(0, 8).toUpperCase() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Card 2: Assessment Detail */}
            <div className="info-card">
              <div className="info-card-left">
                <div className="icon-wrapper exam-icon-bg">
                  <FaBook className="card-icon exam-color" />
                </div>
              </div>
              <div className="info-card-right">
                <span className="info-card-label">ASSESSMENT DETAIL</span>
                <h2 className="info-card-value">{examInfo?.title || 'Exam'}</h2>
                <span className="info-card-subvalue">
                  {examInfo?.subject || 'Midterm Assessment'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Row */}
          <div className="status-row-card">
            <div className="status-row-left">
              <div className="success-check-circle">
                <FaCheck className="status-check-icon" />
              </div>
              <div className="status-text-container">
                <span className="status-title-text">Status: Secured & Logged</span>
                <span className="status-subtitle-text">{formatSubmissionDate(submittedAt)}</span>
              </div>
            </div>
            <div className="status-row-right">
              <span className="latency-dot"></span>
              <span className="latency-text">System Latency: 12ms</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="exam-done-actions">
            <button onClick={generatePDF} className="btn-pdf-download">
              <FaDownload className="btn-icon-svg" /> Download Answers (PDF)
            </button>
            <button onClick={() => navigate('/examcode')} className="btn-done-return-code">
              <FaThLarge className="btn-icon-svg" /> Return to Exam Code
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ExamDone;