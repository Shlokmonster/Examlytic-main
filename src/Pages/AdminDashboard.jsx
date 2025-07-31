import { useEffect, useState, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import supabase from "../SupabaseClient"
import Navbar from "../Components/common/Navbar"
import LiveMonitoring from "../Components/LiveMonitoring"
import StudentRecordings from "../Components/StudentRecordings"

import { toast } from "react-toastify"
import { FaLock, FaUnlock, FaEye, FaTrash, FaEdit, FaLink, FaCopy, FaVideo, FaArrowLeft, FaHistory } from "react-icons/fa"

// Modal component for viewing/editing questions
const QuestionModal = ({ exam, onClose, onSave }) => {
  const [editedQuestions, setEditedQuestions] = useState([...exam.questions])
  const [isSaving, setIsSaving] = useState(false)
  
  // Create a new empty question
  const createNewQuestion = (type = 'mcq') => ({
    question: '',
    type: type,
    optionA: type === 'mcq' ? '' : undefined,
    optionB: type === 'mcq' ? '' : undefined,
    optionC: type === 'mcq' ? '' : undefined,
    optionD: type === 'mcq' ? '' : undefined,
    correct_answer: type === 'mcq' ? 'A' : ''
  })

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...editedQuestions]
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    }
    setEditedQuestions(updatedQuestions)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('exams')
        .update({ questions: editedQuestions })
        .eq('id', exam.id)
      
      if (error) throw error
      onSave(editedQuestions)
      onClose()
    } catch (error) {
      console.error('Error updating questions:', error)
      alert('Failed to update questions. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!exam) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit Questions: {exam.title}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="questions-container">
          {editedQuestions.map((q, index) => (
            <div key={index} className="question-card">
              {editedQuestions.length > 1 && (
                <button 
                  className="delete-question"
                  onClick={() => setEditedQuestions(editedQuestions.filter((_, i) => i !== index))}
                  title="Delete question"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              )}
              <div className="form-group">
                <label>Question {index + 1}</label>
                <div className="question-type-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${q.type === 'mcq' ? 'active' : ''}`}
                    onClick={() => handleQuestionChange(index, 'type', 'mcq')}
                  >
                    MCQ
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${q.type === 'answerable' ? 'active' : ''}`}
                    onClick={() => handleQuestionChange(index, 'type', 'answerable')}
                  >
                    Answerable
                  </button>
                </div>
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                  className="form-control"
                  placeholder="Enter your question here"
                />
              </div>

              {q.type === 'mcq' ? (
                <>
                  <div className="options-grid">
                    {['A', 'B', 'C', 'D'].map((opt) => (
                      <div key={opt} className="form-group">
                        <label>Option {opt}</label>
                        <input
                          type="text"
                          value={q[`option${opt}`] || ''}
                          onChange={(e) => handleQuestionChange(index, `option${opt}`, e.target.value)}
                          className={`form-control ${q.correct_answer === opt ? 'correct-answer' : ''}`}
                          placeholder={`Option ${opt}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Correct Answer</label>
                    <select
                      value={q.correct_answer || 'A'}
                      onChange={(e) => handleQuestionChange(index, 'correct_answer', e.target.value)}
                      className="form-control"
                    >
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <option key={opt} value={opt} disabled={!q[`option${opt}`]}>
                          {q[`option${opt}`] ? `Option ${opt}` : `Option ${opt} (empty)`}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Expected Answer</label>
                  <textarea
                    value={q.correct_answer || ''}
                    onChange={(e) => handleQuestionChange(index, 'correct_answer', e.target.value)}
                    className="form-control"
                    rows="3"
                    placeholder="Enter the expected answer here"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <div className="left-actions">
            <div className="add-question-container">
              <select 
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setEditedQuestions([...editedQuestions, createNewQuestion(e.target.value)]);
                    e.target.value = ''; // Reset the select
                  }
                }}
                className="btn btn-add"
                style={{ appearance: 'none', paddingRight: '30px' }}
              >
                <option value="" disabled>Add Question</option>
                <option value="mcq">MCQ Question</option>
                <option value="answerable">Answerable Question</option>
              </select>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ marginLeft: '-24px', pointerEvents: 'none' }}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
          </div>
          <div className="right-actions">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
        .questions-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
          justify-content: center;
        }
        .question-card {
          background: #f9f9f9;
          padding: 50px;
          border-radius: 6px;
          border-left: 4px solid #4CAF50;
          position: relative;
          margin-bottom: 20px;
          align-items: center;
          justify-content: center;
         width:1000px;
        }
        
        .delete-question {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #ffebee;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #c62828;
          padding: 0;
        }
        
        .delete-question:hover {
          background: #ffcdd2;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }
        .form-control {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .form-control:focus {
          outline: none;
          border-color: #4CAF50;
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
        }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin: 15px 0;
        }
        .correct-answer {
          border-color: #4CAF50;
          background-color: #f0f9f0;
        }
        .modal-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        
        .left-actions, .right-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .add-question-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .question-type-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .toggle-btn {
          flex: 1;
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: #f5f5f5;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .toggle-btn.active {
          background: #4CAF50;
          color: white;
          border-color: #45a049;
        }
        
        .btn-add {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .btn-add:hover {
          background: #1976D2;
        }
        
        .btn-add svg {
          width: 16px;
          height: 16px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #4CAF50;
          color: white;
          border: none;
        }
        .btn-primary:hover {
          background: #45a049;
        }
        .btn-primary:disabled {
          background: #a5d6a7;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #f0f0f0;
          border: 1px solid #ddd;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e0e0e0;
        }
      `}</style>
    </div>
  )
}

  // Add custom styles
  const styles = `
    .admin-dashboard {
      min-height: 100vh;
      background-color: #f5f7fa;
    }

    .admin-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .users-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      margin-top: 24px;
    }

    .user-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease;
      cursor: pointer;
      border: 1px solid #e5e7eb;
    }

    .user-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    .user-card:hover {
      transform: translateY(-5px);
    }

    .user-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .user-card h3 {
      margin: 0;
      font-size: 1.2em;
    }

    .user-email {
      color: #666;
      font-size: 0.9em;
    }

    .user-stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .stat-item span:first-child {
      color: #666;
      font-size: 0.9em;
    }

    .stat-item span:last-child {
      font-weight: bold;
      color: #333;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      padding: 20px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.5em;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }

    .exam-answers-container {
      padding: 20px;
      max-height: calc(90vh - 100px);
      overflow-y: auto;
    }

    .question-answer-card {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
      border: 1px solid #eee;
    }

    .question-header {
      margin-bottom: 10px;
    }

    .question-text {
      font-size: 14px;
      color: #333;
      margin-bottom: 10px;
    }

    .mcq-answers {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 10px;
    }

    .mcq-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 4px;
      background: white;
      border: 1px solid #ddd;
    }

    .mcq-option:hover {
      background: #f0f0f0;
    }

    .answerable-answer {
      margin-top: 10px;
    }

    .answerable-answer textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      min-height: 80px;
      background: white;
    }

    .user-exams-container {
      padding: 20px;
    }

    .exam-card {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
      transition: background-color 0.2s;
    }

    .exam-card:hover {
      background: #f0f0f0;
    }

    .exam-header {
      margin-bottom: 10px;
    }

    .exam-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: #666;
    }

    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .admin-title {
      font-size: 24px;
      font-weight: 600;
      color: #2d3748;
    }

    .exam-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 20px;
      padding: 20px;
      width: 100%;
    }

    .exam-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .exam-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .exam-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background-color: #4299e1;
      color: white;
    }

    .btn-info {
      background-color: #0bc5ea;
      color: white;
    }

    .btn-warning {
      background-color: #ecc94b;
      color: #1a202c;
    }
  
    .btn-danger {
      background-color: #f56565;
      color: white;
    }
  
    .btn-secondary {
      background-color: #e2e8f0;
      color: #4a5568;
    }
  
    .loading {
      text-align: center;
      padding: 40px;
      color: #718096;
    }
  
    .error {
      color: #e53e3e;
      background-color: #fff5f5;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
  
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
  
    .status-active {
      background-color: #c6f6d5;
      color: #22543d;
    }
  
    .status-inactive {
      background-color: #fed7d7;
      color: #822727;
    }
  `;

export default function AdminDashboard() {
  // All hooks must be called at the top level in the same order
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams', 'monitoring', or 'recordings'
  const [selectedExamForRecordings, setSelectedExamForRecordings] = useState(null);
  const [selectedStudentForRecordings, setSelectedStudentForRecordings] = useState(null);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'monitor', or 'users'
  const [examLogs, setExamLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [userAttempts, setUserAttempts] = useState([]);
  const [recordings, setRecordings] = useState([]);

// Fetch all exam attempts with recordings
const fetchAllRecordings = async () => {
  try {
    setRecordingsLoading(true);
    
    // First, get all exams that have been attempted
    const { data: examAttempts, error: attemptsError } = await supabase
      .from('exam_attempts')
      .select('exam_id, student_id, submitted_at, recording_url')
      .not('recording_url', 'is', null)
      .order('submitted_at', { ascending: false });

    if (attemptsError) throw attemptsError;

    // If no attempts found, set empty array and return
    if (!examAttempts || examAttempts.length === 0) {
      setRecordings([]);
      setRecordingsLoading(false);
      return;
    }

    // Get unique exam IDs and student IDs
    const examIds = [...new Set(examAttempts.map(attempt => attempt.exam_id))];
    const studentIds = [...new Set(examAttempts.map(attempt => attempt.student_id))];

    // Fetch exam details
    const { data: examsData, error: examsError } = await supabase
      .from('exams')
      .select('id, title, subject, duration_minutes')
      .in('id', examIds);

    if (examsError) throw examsError;

    // Fetch only the available columns from users table
    const { data: studentsData, error: studentsError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', studentIds);
      
    // Use email as the display name if name is not available
    const studentsWithFullName = studentsData?.map(student => ({
      ...student,
      full_name: student.email.split('@')[0] // Use the part before @ in email as name
    })) || [];

    if (studentsError) throw studentsError;

    // Create lookup objects
    const examsMap = examsData.reduce((acc, exam) => ({
      ...acc,
      [exam.id]: exam
    }), {});

    const studentsMap = studentsWithFullName.reduce((acc, student) => ({
      ...acc,
      [student.id]: student
    }), {});

    // Group attempts by exam
    const examsWithAttempts = examAttempts.reduce((acc, attempt) => {
      const exam = examsMap[attempt.exam_id];
      const student = studentsMap[attempt.student_id];
      
      if (!exam || !student) return acc;
      
      const examIndex = acc.findIndex(e => e.id === exam.id);
      
      if (examIndex === -1) {
        // New exam, add with this student
        acc.push({
          ...exam,
          participants: [{
            id: student.id,
            name: student.full_name || `Student ${student.id.substring(0, 6)}`,
            email: student.email,
            lastAttempt: attempt.submitted_at
          }],
          lastRecording: attempt.submitted_at
        });
      } else {
        // Existing exam, add student if not already present
        const existingParticipant = acc[examIndex].participants.find(p => p.id === student.id);
        if (!existingParticipant) {
          acc[examIndex].participants.push({
            id: student.id,
            name: student.full_name || `Student ${student.id.substring(0, 6)}`,
            email: student.email,
            lastAttempt: attempt.submitted_at
          });
        }
        // Update last recording timestamp if this one is newer
        if (new Date(attempt.submitted_at) > new Date(acc[examIndex].lastRecording || 0)) {
          acc[examIndex].lastRecording = attempt.submitted_at;
        }
      }
      return acc;
    }, []);

    // Update state with the processed data
    setExams(prevExams => {
      // Merge with existing exams to preserve other data
      const merged = [...prevExams];
      examsWithAttempts.forEach(exam => {
        const existingIndex = merged.findIndex(e => e.id === exam.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = { ...merged[existingIndex], ...exam };
        } else {
          merged.push(exam);
        }
      });
      return merged;
    });

    // Set the recordings from exam attempts
    setRecordings(examAttempts);
    setRecordingsLoading(false);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    // Set an empty array to prevent rendering errors
    setRecordings([]);
  }
};

useEffect(() => {
  fetchAllRecordings();
}, []);



  // Modal component for exam answers
  const ExamAnswersModal = () => (
    <div className="modal-overlay" style={{
      display: selectedExam ? 'flex' : 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        background: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        margin: '20px',
        position: 'relative'
      }}>
        <div className="modal-header" style={{
          padding: '20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}>Exam Answers for {selectedUser?.email}</h3>
          <button 
            onClick={() => {
              setSelectedUser(null);
              setSelectedExam(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            &times;
          </button>
        </div>
        <div className="exam-answers-container" style={{
          padding: '20px',
          maxHeight: 'calc(90vh - 100px)',
          overflowY: 'auto'
        }}>
          {selectedExam && selectedExam.answers ? (
            <div>
              {Object.entries(selectedExam.answers).map(([questionId, answer], index) => (
                <div key={questionId} style={{
                  background: '#f9f9f9',
                  padding: '15px',
                  margin: '15px 0',
                  borderRadius: '6px',
                  border: '1px solid #eee'
                }}>
                  <h4 style={{ margin: 0, marginBottom: '10px' }}>Question {index + 1}</h4>
                  <p style={{ marginBottom: '10px' }}>{selectedExam.questions?.[questionId]?.question || 'No question text'}</p>
                  {selectedExam.questions?.[questionId]?.type === 'mcq' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {['A', 'B', 'C', 'D'].map((option) => (
                        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name={`q${index}`}
                            value={option}
                            checked={answer === option}
                            disabled
                            style={{ width: '16px', height: '16px' }}
                          />
                          {selectedExam.questions?.[questionId][`option${option}`] || `Option ${option}`}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: '10px' }}>
                      <textarea
                        value={answer || ''}
                        disabled
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          resize: 'vertical',
                          minHeight: '80px'
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              {selectedExam ? 'No answers found for this exam.' : 'Please select an exam to view answers.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // All effects at the top level
  useEffect(() => {
    if (view === 'users') {
      fetchUsers();
    }
  }, [view]);

  // All other functions after hooks
  const copyToClipboard = (examId) => {
    const examLink = `${window.location.origin}/exam/${examId}`;
    navigator.clipboard.writeText(examLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Open share modal
  const openShareModal = (exam) => {
    setCurrentExam(exam);
    setShareModalOpen(true);
    setCopied(false);
  };

  // Close share modal
  const closeShareModal = () => {
    setShareModalOpen(false);
    setCurrentExam(null);
    setCopied(false);
  };
  
  // Start monitoring an exam
  const startMonitoring = (exam) => {
    setSelectedExam(exam);
    setView('monitor');
    navigate(`/admin/monitor/${exam.id}`);
  };
  
  // Go back to exam list
  const goBackToList = () => {
    setView('list');
    setSelectedExam(null);
    navigate('/admin');
  };

  // Debug: Log component mount and environment
  useEffect(() => {
    console.log('AdminDashboard mounted');
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Environment:', process.env.NODE_ENV);
    
    // Initial data fetch
    const loadData = async () => {
      try {
        await fetchExams();
        
        // If there's an examId in the URL, switch to monitoring view
        if (examId) {
          const exam = exams.find(e => e.id === examId);
          if (exam) {
            setSelectedExam(exam);
            setView('monitor');
          }
        }
      } catch (err) {
        console.error('Initial load error:', err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setInitialLoad(false);
      }
    };
    
    loadData();
  }, [examId]);

  const fetchExams = async () => {
    console.log('Fetching exams...');
    try {
      setLoading(true);
      setError(null);
      
      // First, verify we have a valid supabase client
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Get all exams with their questions
      console.log('Making supabase query...');
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });

      console.log('Supabase response:', { examsData, examsError });

      if (examsError) {
        console.error('Supabase error:', examsError);
        throw new Error(examsError.message || 'Failed to fetch exams');
      }

      if (!examsData) {
        console.warn('No data returned from exams query');
        setExams([]);
        return;
      }

      // Add question counts to each exam
      const examsWithCounts = examsData.map(exam => {
        const questions = Array.isArray(exam.questions) ? exam.questions : [];
        return {
          ...exam,
          questions: questions,
          questions_count: questions.length
        };
      });

      console.log('Processed exams:', examsWithCounts);
      setExams(examsWithCounts);
    } catch (err) {
      const errorMessage = err.message || 'Failed to load exams. Please try again.';
      console.error('Error in fetchExams:', err);
      setError(errorMessage);
      
      // Show more detailed error in development
      if (process.env.NODE_ENV === 'development') {
        setError(`${errorMessage} (${err.message || 'No error details'})`);
      }
    } finally {
      console.log('Fetch exams completed');
      setLoading(false);
    }
  };

  const toggleExamStatus = async (examId, currentStatus) => {
    try {
      setLoadingStates(prev => ({ ...prev, [examId]: true }));
      
      const { error } = await supabase
        .from('exams')
        .update({ is_active: !currentStatus })
        .eq('id', examId);

      if (error) throw error;

      setExams(exams.map(exam => 
        exam.id === examId ? { ...exam, is_active: !currentStatus } : exam
      ));

      toast.success(`Exam ${!currentStatus ? 'unlocked' : 'locked'} successfully`);
    } catch (error) {
      console.error('Error toggling exam status:', error);
      toast.error(error.message || 'Failed to update exam status');
    } finally {
      setLoadingStates(prev => ({ ...prev, [examId]: false }));
    }
  };

  const handleViewExam = (exam) => {
    setSelectedExam(exam);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExam(null);
  };

  const handleQuestionsUpdate = (updatedQuestions) => {
    setExams(prevExams => 
      prevExams.map(exam => 
        exam.id === selectedExam.id 
          ? { ...exam, questions: updatedQuestions, questions_count: updatedQuestions.length }
          : exam
      )
    );
  };

  const handleDeleteExam = async (id) => {
    if (window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      try {
        const { error } = await supabase
          .from("exams")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
        fetchExams();
      } catch (err) {
        setError("Failed to delete exam. Please try again.");
        console.error("Error deleting exam:", err);
      }
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // Add styles to the document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Show loading state
  if (initialLoad) {
    return (
      <div className="admin-dashboard">
        <Navbar />
        <div className="admin-container" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading">
            <h3>Loading Admin Dashboard...</h3>
            <p>Please wait while we load your data</p>
            <div className="spinner" style={{ margin: '20px auto', width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  // Fetch exam logs for a specific attempt
  const fetchExamLogs = async (examId, studentId) => {
    try {
      setLoadingLogs(true);
      // First, get the exam_attempt_id for this student and exam
      const { data: attempts, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('id')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .single();

      if (attemptError) throw attemptError;
      if (!attempts) return [];

      // Then get the logs for this exam attempt
      const { data, error } = await supabase
        .from('exam_logs')
        .select('*')
        .eq('exam_attempt_id', attempts.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setExamLogs(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching exam logs:', error);
      toast.error('Failed to load exam logs');
      return [];
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch users and their attempts
  const fetchUsers = async () => {
    try {
      // First, get all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, user_name, user_avatar')
        .order('id');

      if (usersError) throw usersError;

      // Fetch exams data
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('id, title')
        .order('id');

      if (examsError) {
        console.error('Error fetching exams:', examsError);
        setError('Failed to fetch exams. Please check if the exams table exists and has the correct fields.');
        return;
      }

      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select('id, student_id, exam_id, answers, submitted_at, completed_at')
        .order('submitted_at', { ascending: false });

      if (attemptsError) {
        console.error('Error fetching exam attempts:', attemptsError);
        setError('Failed to fetch exam attempts. Please check if the exam_attempts table exists and has the correct fields.');
        return;
      }

      // Map attempts to include user name/email/avatar
      const attemptsWithUser = attemptsData.map(attempt => {
        const user = usersData.find(u => u.id === attempt.student_id);
        return {
          ...attempt,
          user_name: user?.user_name,
          user_email: user?.email || 'N/A',
          user_avatar: user?.user_avatar
        };
      });

      // Set the data
      setUsers(usersData || []);
      setUserAttempts(attemptsWithUser || []);
      console.log('Users:', usersData);
      console.log('Attempts:', attemptsData);
      console.log('Exams:', examsData);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      setError('An unexpected error occurred while fetching user data. Please try again.');
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="admin-dashboard">
        <Navbar />
        <div className="admin-container" style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
          <div className="error" style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            borderLeft: '4px solid #c62828'
          }}>
            <h3 style={{ marginTop: 0 }}>Error Loading Dashboard</h3>
            <p>{error}</p>
            <p style={{ fontSize: '0.9em', color: '#666' }}>
              Please check your internet connection and try again.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={view === 'users' ? fetchUsers : fetchExams}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Retry Loading Data
          </button>
          <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
            <p>If the problem persists, please contact support with these details:</p>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              overflowX: 'auto',
              fontSize: '12px'
            }}>
              URL: {window.location.href}
              {error.message && `\nError: ${error.message}`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Render users view
  if (view === 'users') {
    return (
      <div className="admin-dashboard">
        <Navbar />
        <div className="admin-container" style={{ padding: '20px' }}>
          <button 
            onClick={() => {
              setView('list');
              setSelectedUser(null);
              setSelectedExam(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              background: 'none',
              border: 'none',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '8px 0'
            }}
          >
            <FaArrowLeft /> Back to Exams
          </button>
          <h1 style={{ marginBottom: '20px' }}>Users and Exam Attempts</h1>
          
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading users...</p>
            </div>
          ) : (
            <div className="users-grid">
              {users.map(user => (
                <div 
                  className="user-card" 
                  key={user.id}
                  onClick={() => {
                    console.log('Clicked user:', user);
                    // Get all exams for this user
                    const userExams = userAttempts.filter(attempt => attempt.student_id === user.id);
                    console.log('User exams:', userExams);
                    if (userExams.length > 0) {
                      setSelectedUser(user);
                      setSelectedExam(null); // Clear selected exam
                      console.log('Selected user:', user);
                    } else {
                      console.log('No exams found for this user');
                    }
                  }} 
                  style={{ cursor: 'pointer' }}
                >
                  <div className="user-card-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div className="user-avatar" style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      {user.user_avatar ? (
                        <img 
                          src={user.user_avatar} 
                          alt={`${user.user_name || user.email} avatar`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        <span style={{ 
                          fontSize: '18px', 
                          fontWeight: 'bold', 
                          color: '#9ca3af'
                        }}>
                          {user.user_name ? user.user_name[0].toUpperCase() : user.email[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '1.25rem', 
                        fontWeight: 600,
                        color: '#1f2937'
                      }}>
                        {user.user_name || user.email}
                      </h3>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.875rem', 
                        color: '#6b7280'
                      }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="user-actions" style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <button
                      onClick={() => {
                        const userExams = userAttempts.filter(attempt => attempt.student_id === user.id);
                        if (userExams.length > 0) {
                          setSelectedUser(user);
                          setSelectedExam(null);
                        } else {
                          setError('No exams found for this user');
                        }
                      }}
                      style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>Exams Attempted</span>
                      <span style={{
                        backgroundColor: '#e0e7ff',
                        color: '#3b82f6',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}>
                        {userAttempts.filter(attempt => attempt.student_id === user.id).length}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedUser && !selectedExam && (
        <div className="exam-selection-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="exam-selection-content" style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            position: 'relative'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Select Exam for {selectedUser.email}</h3>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {userAttempts
                .filter(attempt => attempt.student_id === selectedUser.id)
                .map((exam, index) => (
                  <div
                    key={exam.id}
                    style={{
                      padding: '15px',
                      background: index % 2 === 0 ? '#f9f9f9' : 'white',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      position: 'relative'
                    }}
                    onClick={async () => {
                      setSelectedExam(exam);
                      // Fetch exam logs when an exam is selected
                      await fetchExamLogs(exam.exam_id, selectedUser.id);
                      console.log('Selected exam:', exam);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <h4 style={{ margin: 0 }}>{exam.exam_title}</h4>
                          <span style={{ fontSize: '0.8em', color: '#666' }}>
                            {new Date(exam.submitted_at).toLocaleString()}
                          </span>
                        </div>
                        
                        {selectedExam?.id === exam.id && (
                          <div style={{
                            marginTop: '10px',
                            padding: '10px',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            borderLeft: '3px solid #3b82f6'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <strong>Activity Logs</strong>
                              {loadingLogs && <span style={{ fontSize: '0.8em', color: '#666' }}>Loading...</span>}
                            </div>
                            
                            {examLogs.length > 0 ? (
                              <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.85em' }}>
                                {examLogs.map((log, idx) => (
                                  <div key={log.id} style={{
                                    padding: '6px 0',
                                    borderBottom: idx < examLogs.length - 1 ? '1px solid #e2e8f0' : 'none',
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'flex-start'
                                  }}>
                                    <span style={{ color: '#3b82f6', whiteSpace: 'nowrap' }}>
                                      {new Date(log.createdat).toLocaleTimeString()}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                                        {log.eventtype.replace(/_/g, ' ')}
                                      </div>
                                      {log.eventdetails && (
                                        <div style={{
                                          color: '#64748b',
                                          fontSize: '0.8em',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}>
                                          {JSON.stringify(log.eventdetails)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : !loadingLogs && (
                              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9em' }}>
                                No activity logs found for this attempt.
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="exam-avatar" style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: '#f3f4f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid #e5e7eb',
                              flexShrink: 0
                            }}>
                              {exam.user_avatar ? (
                                <img 
                                  src={exam.user_avatar} 
                                  alt={`${exam.user_name || exam.user_email} avatar`} 
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af' }}>
                                  {exam.user_name ? exam.user_name[0].toUpperCase() : (exam.user_email?.[0]?.toUpperCase() || 'U')}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.85em', color: '#4b5563' }}>
                              {exam.user_name || exam.user_email || 'Unknown User'}
                            </span>
                          </div>
                          <div>
                            <p style={{ 
                              color: '#6b7280', 
                              margin: 0, 
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}>
                              By: {exam.user_name || exam.user_email}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: '#4a5568' }}>Questions: {Object.keys(exam.answers || {}).length}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
              }}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#4a5568',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {selectedExam && <ExamAnswersModal />}   
      </div>
    );
  }

  // Render monitoring view if in monitor mode
  if (view === 'monitor' && selectedExam) {
    return (
      <div className="admin-dashboard">
        <Navbar />
        <div className="admin-container" style={{ padding: '20px' }}>
          <button 
            onClick={goBackToList}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              background: 'none',
              border: 'none',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '8px 0'
            }}
          >
            <FaArrowLeft /> Back to Exams
          </button>
          <h1 style={{ marginBottom: '20px' }}>Live Monitoring: {selectedExam.title}</h1>
          <LiveMonitoring examId={selectedExam.id} />
        </div>
      </div>
    );
  }

  // Render recordings view
  if (view === 'recordings') {
    return (
      <div className="admin-dashboard">
        <Navbar />
        <div className="admin-container" style={{ padding: '20px' }}>
          <button 
            onClick={() => {
              if (selectedStudentForRecordings) {
                setSelectedStudentForRecordings(null);
              } else if (selectedExamForRecordings) {
                setSelectedExamForRecordings(null);
              } else {
                setView('list');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              background: 'none',
              border: 'none',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '8px 0'
            }}
          >
            <FaArrowLeft /> {selectedStudentForRecordings ? 'Back to Students' : selectedExamForRecordings ? 'Back to Exams' : 'Back to Dashboard'}
          </button>
          
          <h1 style={{ marginBottom: '20px' }}>
            {selectedStudentForRecordings 
              ? `Recordings for Student: ${selectedStudentForRecordings}` 
              : selectedExamForRecordings 
                ? `Students in ${selectedExamForRecordings.title}` 
                : 'Exam Recordings'}
          </h1>

          {!selectedExamForRecordings ? (
            <div className="exam-grid">
              {exams.filter(exam => exam.participants?.length > 0).length > 0 ? (
                exams
                  .filter(exam => exam.participants?.length > 0)
                  .sort((a, b) => new Date(b.lastRecording || 0) - new Date(a.lastRecording || 0))
                  .map((exam) => (
                    <div 
                      key={exam.id} 
                      className="exam-card"
                      onClick={() => setSelectedExamForRecordings(exam)}
                      style={{ 
                        cursor: 'pointer',
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div className="exam-card-header" style={{ 
                        padding: '16px',
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{exam.title}</h3>
                        <div className="exam-status" style={{
                          background: '#e6f7ff',
                          color: '#1890ff',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}>
                          {exam.participants?.length || 0} {exam.participants?.length === 1 ? 'Student' : 'Students'}
                        </div>
                      </div>
                      <div className="exam-details" style={{ padding: '16px' }}>
                        <div className="detail-item" style={{ marginBottom: '8px' }}>
                          <span className="detail-label" style={{
                            color: '#666',
                            marginRight: '8px',
                            fontSize: '0.9rem'
                          }}>Subject:</span>
                          <span className="detail-value" style={{ fontWeight: '500' }}>
                            {exam.subject || 'General'}
                          </span>
                        </div>
                        <div className="detail-item" style={{ marginBottom: '8px' }}>
                          <span className="detail-label" style={{
                            color: '#666',
                            marginRight: '8px',
                            fontSize: '0.9rem'
                          }}>Duration:</span>
                          <span className="detail-value">
                            {exam.duration_minutes} minutes
                          </span>
                        </div>
                        <div className="detail-item" style={{ 
                          marginTop: '12px',
                          fontSize: '0.85rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>Last recording:</span>
                          <span style={{ fontWeight: '500' }}>
                            {exam.lastRecording ? new Date(exam.lastRecording).toLocaleDateString() : 'No recordings'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666'
                }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No exam recordings found</p>
                  <p style={{ fontSize: '0.9rem' }}>Students' exam recordings will appear here once they complete their exams.</p>
                </div>
              )}
            </div>
          ) : !selectedStudentForRecordings ? (
            <div className="students-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
              width: '100%'
            }}>
              {selectedExamForRecordings.participants?.length > 0 ? (
                [...selectedExamForRecordings.participants]
                  .sort((a, b) => new Date(b.lastAttempt || 0) - new Date(a.lastAttempt || 0))
                  .map((student) => {
                    // Find all recordings for this student and exam
                    const studentRecordings = recordings.filter(
                      r => r.student_id === student.id && 
                           r.exam_id === selectedExamForRecordings.id
                    );
                    
                    return (
                      <div 
                        key={student.id}
                        className="student-card"
                        onClick={() => setSelectedStudentForRecordings(student.id)}
                        style={{
                          background: 'white',
                          borderRadius: '8px',
                          padding: '16px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          border: '1px solid #eee',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.12)'
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: '#1890ff',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            flexShrink: 0
                          }}>
                            {student.name ? student.name[0].toUpperCase() : 'S'}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <h4 style={{ 
                              margin: '0 0 4px 0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {student.name || `Student ${student.id.substring(0, 6)}`}
                            </h4>
                            <p style={{ 
                              margin: 0, 
                              color: '#666', 
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {student.email || 'No email'}
                            </p>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem',
                          color: '#666',
                          paddingTop: '10px',
                          borderTop: '1px solid #f0f0f0',
                          marginTop: '10px'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.8rem', marginBottom: '2px' }}>Recordings</div>
                            <div style={{ fontWeight: '500', color: '#1890ff' }}>
                              {studentRecordings.length}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '2px' }}>Last attempt</div>
                            <div style={{ fontWeight: '500' }}>
                              {student.lastAttempt ? new Date(student.lastAttempt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No students found</p>
                  <p style={{ fontSize: '0.9rem', color: '#888' }}>
                    {selectedExamForRecordings.participants?.length === 0 
                      ? 'No students have taken this exam yet.' 
                      : 'No matching students found.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="recordings-container">
              {recordingsError ? (
                <div className="error-message">
                  {recordingsError}
                  <button 
                    onClick={() => {
                      setRecordingsError(null);
                      setSelectedStudentForRecordings(null);
                    }}
                    className="btn btn-primary"
                    style={{ marginTop: '10px' }}
                  >
                    Back to Students
                  </button>
                </div>
              ) : (
                <>

                  <div className="recordings-container" style={{ marginTop: '20px' }}>
                    <StudentRecordings 
                      examId={selectedExamForRecordings.id}
                      studentId={selectedStudentForRecordings}
                      onError={(error) => setRecordingsError(error || null)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">

      <Navbar />
      <div className="admin-container">
        <div className="admin-header">
          <div className="admin-title">
            <h1>Exam Management</h1>
            <p>Manage and monitor your exams</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/create-exam" className="btn btn-primary">
              Create New Exam
            </Link>
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setView('users');
                setSelectedExam(null);
                setSelectedUser(null);
              }}
            >
              View Users
            </button>
            <button 
              className="btn btn-info"
              onClick={() => {
                setView('recordings');
                setSelectedExamForRecordings(null);
                setSelectedStudentForRecordings(null);
              }}
            >
              <FaHistory /> View Recordings
            </button>
          </div>
        </div>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading exams...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="no-exams">
            <div className="no-exams-icon">📝</div>
            <h3>No Exams Found</h3>
            <p>Get started by creating your first exam</p>
            <Link to="/create-exam" className="create-exam-btn">
              Create Your First Exam
            </Link>
          </div>
        ) : (
          <div className="exam-grid">
            {exams.map((exam) => (
              <div className="exam-card" key={exam.id}>
                <div className="exam-card-header">
                  <h3>{exam.title}</h3>
                  <div className={`exam-status ${exam.is_active ? 'active' : 'inactive'}`}>
                    {exam.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                
                <div className="exam-details">
                  <div className="detail-item">
                    <span className="detail-label">Subject:</span>
                    <span className="detail-value">{exam.subject || 'General'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{exam.duration_minutes} minutes</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Questions:</span>
                    <span className="detail-value">{exam.questions_count || 0}</span>
                  </div>
                </div>
                
                <div className="exam-actions">
                  <button 
                    onClick={() => {
                      console.log('View exam clicked:', exam);
                      handleViewExam(exam);
                    }}
                    className="action-btn view"
                    title="View/Edit Questions"
                  >
                    <FaEye />
                    <span>View</span>
                  </button>
                  <button 
                    className="btn btn-info"
                    onClick={() => openShareModal(exam)}
                    title="Share exam link"
                  >
                    <FaLink />
                    <span>Share</span>
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => startMonitoring(exam)}
                    title="Monitor exam"
                  >
                    <FaVideo />
                    <span>Monitor</span>
                  </button>
                  <button 
                    className={`btn ${exam.is_active ? 'btn-warning' : 'btn-primary'}`} 
                    onClick={() => toggleExamStatus(exam.id, exam.is_active)}
                    disabled={loadingStates[exam.id]}
                    title={exam.is_active ? 'Lock exam' : 'Unlock exam'}
                  >
                    {loadingStates[exam.id] ? (
                      'Loading...'
                    ) : (
                      <>
                        {exam.is_active ? <FaLock /> : <FaUnlock />}
                        {exam.is_active ? ' Lock' : ' Unlock'}
                      </>
                    )}
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleDeleteExam(exam.id)}
                    title="Delete exam"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exam Answers Modal */}
      <div className="modal-overlay" style={{
        display: selectedExam ? 'flex' : 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000
      }}>
        <div className="modal-content" style={{
          background: 'white',
          borderRadius: '8px',
          maxWidth: '800px',
          width: '90%',
          margin: '20px',
          position: 'relative'
        }}>
          <div className="modal-header" style={{
            padding: '20px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0 }}>Exam Answers for {selectedUser?.email}</h3>
            <button 
              onClick={() => {
                setSelectedUser(null);
                setSelectedExam(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              &times;
            </button>
          </div>
          <div className="exam-answers-container" style={{
            padding: '20px',
            maxHeight: 'calc(90vh - 100px)',
            overflowY: 'auto'
          }}>
            {selectedExam && selectedExam.answers ? (
              <div>
                {Object.entries(selectedExam.answers).map(([questionId, answer], index) => (
                  <div key={questionId} style={{
                    background: '#f9f9f9',
                    padding: '15px',
                    margin: '15px 0',
                    borderRadius: '6px',
                    border: '1px solid #eee'
                  }}>
                    <h4 style={{ margin: 0, marginBottom: '10px' }}>Question {index + 1}</h4>
                    <p style={{ marginBottom: '10px' }}>{selectedExam.questions?.[questionId]?.question || 'No question text'}</p>
                    {selectedExam.questions?.[questionId]?.type === 'mcq' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {['A', 'B', 'C', 'D'].map((option) => (
                          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="radio"
                              name={`q${index}`}
                              value={option}
                              checked={answer === option}
                              disabled
                              style={{ width: '16px', height: '16px' }}
                            />
                            {selectedExam.questions?.[questionId][`option${option}`] || `Option ${option}`}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: '10px' }}>
                        <textarea
                          value={answer || ''}
                          disabled
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            resize: 'vertical',
                            minHeight: '80px'
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                {selectedExam ? 'No answers found for this exam.' : 'Please select an exam to view answers.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && selectedExam && (
        <QuestionModal 
          exam={selectedExam} 
          onClose={handleCloseModal}
          onSave={handleQuestionsUpdate}
        />
      )}

      {/* Share Exam Modal */}
      {shareModalOpen && currentExam && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Share Exam Link</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Exam: {currentExam.title}</p>
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '10px'
              }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/exam/${currentExam.id}`}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={() => copyToClipboard(currentExam.id)}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: copied ? '#4CAF50' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <FaCopy />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '5px',
                fontStyle: 'italic'
              }}>
                Share this link with students to allow them to take the exam
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px',
              borderTop: '1px solid #eee',
              paddingTop: '15px'
            }}>
              <button
                onClick={closeShareModal}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
