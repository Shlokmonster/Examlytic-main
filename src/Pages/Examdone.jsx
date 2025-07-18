import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Navbar from "../Components/common/Navbar";
import supabase from "../SupabaseClient";
import { FaCheckCircle, FaTimesCircle, FaDownload, FaArrowLeft } from 'react-icons/fa';
import "../ExamDone.css";

function ExamDone() {
  const location = useLocation();
  const navigate = useNavigate();
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [percentage, setPercentage] = useState(0);

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

  // Additional info for submission confirmation UI
  const { examId } = location.state || {};
  const formattedDate = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleRaiseIssue = () => {
    const subject = encodeURIComponent(`Issue with Exam ${examId || ''}`);
    const body = encodeURIComponent('Please describe your issue here.\n\nExam ID: ' + (examId || ''));
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  useEffect(() => {

    const fetchExamData = async () => {
      if (!examId) {
        setError('No exam id found.');
        setLoading(false);
        return;
      }

      try {
        console.log('Starting fetchExamData with examId:', examId);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Auth error:', userError || 'No user found');
          throw new Error('Please login again.');
        }
        console.log('User authenticated:', user.id);

        // 1. Fetch the full exam data including questions with options
        console.log('Fetching exam data...');
        const { data: examData, error: examErr } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle();
        
        if (examErr) {
          console.error('Error fetching exam:', examErr);
          throw examErr;
        }
        
        if (!examData) {
          console.error('No exam data found for ID:', examId);
          throw new Error('Exam not found.');
        }
        
        console.log('Raw exam data from DB:', examData);
        
        // Process questions to handle the specific format with optionA, optionB, etc.
        const questions = [];
        if (Array.isArray(examData.questions)) {
          examData.questions.forEach((q, i) => {
            try {
              const question = typeof q === 'string' ? JSON.parse(q) : q;
              const questionId = `q-${i}`; // Match the ID format used in answers
              
              // Extract options from optionA, optionB, etc.
              const options = [];
              const optionLetters = ['A', 'B', 'C', 'D'];
              optionLetters.forEach(letter => {
                const optionKey = `option${letter}`;
                if (question[optionKey]) {
                  options.push({
                    letter,
                    text: question[optionKey],
                    value: letter // Use the letter (A, B, C, D) as the value
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

        console.log('Processed questions:', JSON.stringify(questions, null, 2));

        // 2. Fetch latest attempt for this user & exam with all fields
        console.log('Fetching attempt data...');
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
        
        if (!attemptRow) {
          console.error('No attempt found for user:', user.id, 'exam:', examId);
          throw new Error('No attempt found for this exam.');
        }

        console.log('Raw attempt data:', attemptRow);

        // Parse answers from the attempt
        let answers = [];
        if (attemptRow.answers) {
          try {
            // Handle both string and object answers
            const rawAnswers = typeof attemptRow.answers === 'string' 
              ? JSON.parse(attemptRow.answers) 
              : attemptRow.answers;

            // Convert to array of {questionId, answer} pairs
            if (Array.isArray(rawAnswers)) {
              answers = rawAnswers;
            } else if (typeof rawAnswers === 'object') {
              answers = Object.entries(rawAnswers).map(([questionId, answer]) => ({
                questionId,
                answer
              }));
            }
          } catch (e) {
            console.error('Error parsing answers:', e, 'Raw answers:', attemptRow.answers);
            answers = [];
          }
        }
        
        console.log('Processed answers:', JSON.stringify(answers, null, 2));

        // calculate score if not provided
        let correctAnswersCnt = 0;
        questions.forEach((q, idx) => {
          const ans = getAnswerFromData(answers, q, idx);
          if (q.correctAnswer === ans) correctAnswersCnt++;
        });
        const examScore = (correctAnswersCnt / questions.length) * 100;

        setExamData({ questions, answers });
        setScore(correctAnswersCnt);
        setTotalQuestions(questions.length);
        setPercentage(examScore);
        setLoading(false);
      } catch (err) {
        console.error('Error processing exam results:', err);
        setError(err.message || 'Failed to fetch exam data');
        setLoading(false);
      }
      try {
        // Get data from location state
        const { examId, answers, questions } = location.state || {};
        
        if (!examId || !answers || !questions) {
          throw new Error('Missing exam data. Please complete the exam again.');
        }

        // Calculate score
        let correctAnswers = 0;
        questions.forEach((q, index) => {
          if (q.correctAnswer === answers[index]) {
            correctAnswers++;
          }
        });

        const examScore = (correctAnswers / questions.length) * 100;

        setExamData({ questions, answers });
        setScore(correctAnswers);
        setTotalQuestions(questions.length);
        setPercentage(examScore);
        setLoading(false);
      } catch (err) {
        console.error('Error processing exam results:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchExamData();
  }, [location.state]);

  const generatePDF = async () => {
    if (!examData || !examData.questions) {
      setError('There is no exam data to generate the PDF.');
      return;
    }
    try {
      // 1. Fetch answers from Supabase if not already in state
      let answersArray = [];
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get answers from examData first
      if (examData.answers) {
        if (Array.isArray(examData.answers)) {
          answersArray = examData.answers;
        } else if (typeof examData.answers === 'object') {
          // Convert object to array of {questionId, answer} pairs
          answersArray = Object.entries(examData.answers).map(([questionId, answer]) => ({
            questionId,
            answer
          }));
        }
      }
      
      // If no answers in examData, try to fetch from the database
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
            // Convert object to array of {questionId, answer} pairs
            answersArray = Object.entries(rawAnswers).map(([questionId, answer]) => ({
              questionId,
              answer
            }));
          }
        }
      }

      // 2. Calculate simple score for header
      const totalQs = examData.questions.length;
      const correctCount = examData.questions.reduce((acc, q, idx) => {
        const answerObj = answersArray.find(a => 
          a.questionId === q.id || a.questionId === `q-${idx}`
        );
        const userAnswer = answerObj ? answerObj.answer : undefined;
        return userAnswer === q.correctAnswer ? acc + 1 : acc;
      }, 0);
      const percent = totalQs > 0 ? (correctCount / totalQs) * 100 : 0;

      // 3. Build a temporary container for html2canvas
      const pdfContent = document.createElement('div');
      pdfContent.style.padding = '20px';
      pdfContent.style.maxWidth = '800px';
      pdfContent.style.margin = '0 auto';

      const header = document.createElement('div');
      header.innerHTML = `
        <h1 style="text-align: center; color: #1a365d; margin-bottom: 20px;">Exam Results</h1>
        <div style="text-align: center; margin-bottom: 30px;">
          <p>Exam completed on: ${formattedDate}</p>
          <p>Your score: ${correctCount} out of ${totalQs} (${Math.round(percent)}%)</p>
        </div>
      `;
      pdfContent.appendChild(header);

      // Answers list
      const answersSection = document.createElement('div');
      answersSection.innerHTML = '<h2 style="color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Your Answers</h2>';

      examData.questions.forEach((question, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.style.marginBottom = '15px';
        answerDiv.style.padding = '10px';
        answerDiv.style.borderLeft = '4px solid #4299e1';
        answerDiv.style.backgroundColor = '#f8fafc';
        // Get the answer for this question
        const answerObj = answersArray.find(a => a.questionId === question.id || a.questionId === `q-${index}`);
        const ansVal = answerObj ? answerObj.answer : undefined;
        let ansText = 'Not answered';

        console.log('Answer data:', {
          questionId: question.id,
          questionText: question.text,
          ansVal,
          questionOptions: question.options,
          questionType: question.options && question.options[0] ? typeof question.options[0] : 'none'
        });

        // If we have an answer value
        if (ansVal !== undefined && ansVal !== null) {
          // If we have options, try to find the matching one
          if (question.options && question.options.length > 0) {
            // Find the option that matches the answer value (A, B, C, D, etc.)
            const option = question.options.find(opt => 
              opt.letter === ansVal || 
              opt.value === ansVal ||
              opt.text === ansVal
            );
            
            if (option) {
              ansText = option.text || option.value || option.letter || ansVal;
            } else {
              // If no matching option found, try to handle it as an index
              const optionIndex = parseInt(ansVal, 10);
              if (!isNaN(optionIndex) && question.options[optionIndex]) {
                ansText = question.options[optionIndex].text || question.options[optionIndex].value || question.options[optionIndex];
              } else {
                // Last resort: show the raw value
                ansText = ansVal;
              }
            }
          } else {
            // No options available, just show the raw answer
            ansText = ansVal;
          }
        }

        answerDiv.innerHTML = `
          <p style="font-weight: 500; margin: 0 0 8px 0; color: #2d3748;">Q${index + 1}: ${question.text || question.question || question.question_text || 'Question'}</p>
          <p style="margin: 0; color: #4a5568;"><strong>Your answer:</strong> ${ansText}</p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">
            ${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}
          </p>
        `;

        answersSection.appendChild(answerDiv);
      });
      pdfContent.appendChild(answersSection);

      // Render hidden then capture
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'absolute';
      hiddenContainer.style.left = '-9999px';
      hiddenContainer.appendChild(pdfContent);
      document.body.appendChild(hiddenContainer);

      // Capture and build PDF
      const canvas = await html2canvas(pdfContent, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);

      // Pagination footer
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(`Page ${i} of ${pageCount}`, pdf.internal.pageSize.getWidth() - 20, pdf.internal.pageSize.getHeight() - 10);
      }

      pdf.save(`exam-answers-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    }
  };
  
/* DUPLICATE BLOCK START
    const pdfContent = document.createElement('div');
    pdfContent.style.padding = '20px';
    pdfContent.style.maxWidth = '800px';
    pdfContent.style.margin = '0 auto';
    
    // Add header
    const header = document.createElement('div');
    header.innerHTML = `
      <h1 style="text-align: center; color: #1a365d; margin-bottom: 20px;">Exam Results</h1>
      <div style="text-align: center; margin-bottom: 30px;">
        <p>Exam completed on: ${new Date().toLocaleDateString()}</p>
        <p>Your score: ${score} out of ${totalQuestions} (${Math.round(percentage)}%)</p>
      </div>
    `;
    pdfContent.appendChild(header);
    
    // Add questions and user answers
    const answersSection = document.createElement('div');
    answersSection.innerHTML = '<h2 style="color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Your Answers</h2>';
    
    examData.questions.forEach((question, index) => {
      const answerDiv = document.createElement('div');
      answerDiv.style.marginBottom = '15px';
      answerDiv.style.padding = '10px';
      answerDiv.style.borderLeft = '4px solid #4299e1';
      answerDiv.style.backgroundColor = '#f8fafc';
      
      answerDiv.innerHTML = `
        <p style="font-weight: 500; margin: 0 0 8px 0; color: #2d3748;">
          Q${index + 1}: ${question.text || question.question || question.question_text || 'Question'}
        </p>
        <p style="margin: 0; color: #4a5568;">
          <strong>Your answer:</strong> ${examData.answers[index] || 'Not answered'}
        </p>
      `;
      
      answersSection.appendChild(answerDiv);
    });
    
    pdfContent.appendChild(answersSection);
    
    // Add to hidden container for rendering
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.appendChild(pdfContent);
    document.body.appendChild(hiddenContainer);
    
    try {
      // Generate PDF
      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20; // Add margins
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Add content with margins
      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
      
      // Add page numbers
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pdf.internal.pageSize.getWidth() - 20,
          pdf.internal.pageSize.getHeight() - 10
        );
      }
      
      pdf.save(`exam-answers-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    }
  };
*/

  if (loading) {
    return (
      <div className="exam-done-container">
        <Navbar />
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Processing your exam results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-done-container">
        <Navbar />
        <div className="container">
          <div className="error-alert">
            <strong>Error: </strong>
            <span>{error}</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="back-button"
          >
            <FaArrowLeft className="icon" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-done-container">
      <Navbar />
      <div className="container">
        <div className="content-wrapper" style={{ textAlign: 'center' }}>
          <h1 className="title">Test Submitted Successfully</h1>
          <p className="subtitle">
            Your test has been submitted successfully on {formattedDate}. {examId && `Your Submission ID is #${examId}.`} You will
            receive an email notification once your results are available.
          </p>

          {/* Action Buttons */}
          <div className="action-buttons" style={{ maxWidth: 400, margin: '32px auto 0' }}>
            <button onClick={generatePDF} className="secondary-button" style={{ width: '100%' }}>
              Download my answers
            </button>
            <button onClick={handleRaiseIssue} className="primary-button" style={{ width: '100%' }}>
              Raise an issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamDone;