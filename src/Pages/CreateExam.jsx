import { useState, useEffect } from "react"
import supabase from "../SupabaseClient"
import { useNavigate } from "react-router-dom"
import Navbar from "../Components/common/Navbar"

import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { generateExamQuestions } from "../utils/geminiService"

// Sample JSON structure for reference
const SAMPLE_QUESTIONS = [
  {
    "question": "What is the capital of France?",
    "type": "mcq",
    "optionA": "London",
    "optionB": "Paris",
    "optionC": "Berlin",
    "optionD": "Madrid",
    "correct_answer": "B"
  },
  {
    "question": "Explain the concept of React hooks",
    "type": "answerable",
    "correct_answer": "React Hooks are functions that let you use state and other React features without writing classes."
  }
]

const styles = `
  .create-exam-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 30px 20px;
    background: #f8f9fa;
    min-height: 100vh;
  
  }
  
  .exam-header {
    text-align: center;
    margin-bottom: 40px;
    padding: 30px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(64, 122, 191, 0.1);
    border-top: 4px solid #407ABF;
  }
  
  .exam-header h1 {
    color: #407ABF;
    font-size: 2.5rem;
    margin-bottom: 10px;
    font-weight: 700;
  }
  
  .subtitle {
    color: #666;
    font-size: 1.1rem;
    margin-bottom: 0;
  }
  
  .ai-generator-section {
    margin: 30px 0;
    padding: 25px;
    background: linear-gradient(135deg, #407ABF 0%, #5a8bc7 100%);
    border-radius: 12px;
    color: white;
    box-shadow: 0 4px 15px rgba(64, 122, 191, 0.2);
  }
  
  .ai-generator-section h3 {
    margin-bottom: 20px;
    font-size: 1.3rem;
    font-weight: 600;
  }
  
  .ai-input-group {
    display: flex;
    gap: 12px;
    margin-bottom: 15px;
    flex-wrap: wrap;
  }
  
  .ai-input-group input {
    flex: 1;
    min-width: 250px;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    color: #333;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  
  .ai-input-group select {
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    background: white;
    color: #333;
    font-size: 14px;
    min-width: 120px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  
  .ai-generate-btn {
    padding: 12px 24px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    min-width: 140px;
  }
  
  .ai-generate-btn:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  }
  
  .ai-generate-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
  
  .ai-hint {
    font-size: 14px;
    opacity: 0.9;
    margin-top: 10px;
  }
  
  .import-export-section {
    margin: 30px 0;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(64, 122, 191, 0.1);
  }
  
  .import-header {
    background: #407ABF;
    color: white;
    padding: 20px 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .import-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .toggle-import-btn {
    background: white;
    color: #407ABF;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  
  .toggle-import-btn:hover {
    background: #f0f8ff;
  }
  
  .json-import-container {
    padding: 25px;
    background: white;
  }
  
  .json-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  
  .json-textarea {
    width: 100%;
    padding: 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    resize: vertical;
    min-height: 200px;
    background: #f9f9f9;
    transition: border-color 0.3s ease;
  }
  
  .json-textarea:focus {
    outline: none;
    border-color: #407ABF;
    background: white;
  }
  
  .json-format-hint {
    margin-top: 20px;
    background: #f0f8ff;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid #407ABF;
  }
  
  .json-format-hint h4 {
    color: #407ABF;
    margin-bottom: 15px;
    font-size: 1.1rem;
  }
  
  .json-format-hint pre {
    background: white;
    padding: 15px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 13px;
    border: 1px solid #e0e0e0;
  }
  
  .exam-form {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 2px 10px rgba(64, 122, 191, 0.1);
  }
  
  .form-section {
    margin-bottom: 40px;
  }
  
  .form-section h3 {
    color: #407ABF;
    font-size: 1.4rem;
    margin-bottom: 25px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    
    .ai-input-group {
      flex-direction: column;
    }
    
    .ai-input-group input {
      min-width: auto;
    }
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }
  
  .required {
    color: #e74c3c;
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.3s ease;
    background: white;
  }
  
  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #407ABF;
    box-shadow: 0 0 0 3px rgba(64, 122, 191, 0.1);
  }
  
  .questions-section {
    margin-top: 40px;
  }
  
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #407ABF;
  }
  
  .section-header h3 {
    color: #407ABF;
    font-size: 1.4rem;
    margin: 0;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .question-count {
    background: #407ABF;
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .question-card {
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 25px;
    margin-bottom: 25px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }
  
  .question-card:hover {
    border-color: #407ABF;
    box-shadow: 0 4px 15px rgba(64, 122, 191, 0.1);
  }
  
  .question-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  
  .question-header h4 {
    color: #407ABF;
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
  }
  
  .question-type-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    background: #f8f9fa;
    padding: 4px;
    border-radius: 8px;
  }
  
  .toggle-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    background: transparent;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .toggle-btn.active {
    background: #407ABF;
    color: white;
    box-shadow: 0 2px 5px rgba(64, 122, 191, 0.3);
  }
  
  .toggle-btn:hover:not(.active) {
    background: white;
    color: #407ABF;
  }
  
  .mcq-options {
    margin-top: 20px;
  }
  
  .mcq-options label {
    font-weight: 600;
    margin-bottom: 15px;
    display: block;
    color: #333;
  }
  
  .option-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .option-radio {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .option-radio input[type="radio"] {
    width: 18px;
    height: 18px;
    accent-color: #4CAF50;
  }
  
  .option-letter {
    font-weight: 600;
    color: #407ABF;
    min-width: 25px;
  }
  
  .option-input {
    flex: 1;
    padding: 10px 14px;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.3s ease;
  }
  
  .option-input:focus {
    outline: none;
    border-color: #407ABF;
  }
  
  .answerable-field {
    margin-top: 20px;
  }
  
  .answerable-field label {
    font-weight: 600;
    margin-bottom: 8px;
    display: block;
    color: #333;
  }
  
  .add-question-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
  }
  
  .question-stats {
    display: flex;
    gap: 20px;
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #666;
    font-size: 14px;
  }
  
  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 40px;
    padding-top: 25px;
    border-top: 2px solid #e0e0e0;
  }
  
  .action-buttons {
    display: flex;
    gap: 12px;
  }
  
  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }
  
  .btn-primary {
    background: #4CAF50;
    color: white;
    box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3);
  }
  
  .btn-primary:hover {
    background: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(76, 175, 80, 0.4);
  }
  
  .btn-outline {
    background: white;
    color: #407ABF;
    border: 2px solid #407ABF;
  }
  
  .btn-outline:hover {
    background: #407ABF;
    color: white;
  }
  
  .btn-text {
    background: transparent;
    color: #666;
    border: none;
  }
  
  .btn-text:hover {
    color: #407ABF;
  }
  
  .btn-delete {
    background: #fff5f5;
    color: #e74c3c;
    border: 1px solid #e74c3c;
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .btn-delete:hover {
    background: #e74c3c;
    color: white;
  }
  
  .btn-secondary {
    background: #f8f9fa;
    color: #407ABF;
    border: 1px solid #407ABF;
  }
  
  .btn-secondary:hover {
    background: #407ABF;
    color: white;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
  }
  
  .empty-state i {
    font-size: 3rem;
    color: #ccc;
    margin-bottom: 20px;
  }
  
  /* Toast customization */
  .Toastify__toast--success {
    background: #4CAF50;
  }
  
  .Toastify__toast--error {
    background: #e74c3c;
  }
  
  .Toastify__toast--info {
    background: #407ABF;
  }
  
  /* Loading states */
  .loading {
    opacity: 0.7;
    pointer-events: none;
  }
  
  .loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid #ccc;
    border-top: 2px solid #407ABF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Responsive improvements */
  @media (max-width: 768px) {
    .create-exam-container {
      padding: 20px 15px;
    }
    
    .exam-header {
      padding: 20px;
    }
    
    .exam-header h1 {
      font-size: 2rem;
    }
    
    .exam-form {
      padding: 20px;
    }
    
    .form-actions {
      flex-direction: column;
      gap: 15px;
    }
    
    .action-buttons {
      width: 100%;
      justify-content: center;
    }
    
    .add-question-actions {
      flex-direction: column;
      gap: 15px;
    }
    
    .question-stats {
      justify-content: center;
    }
  }
`

// Add styles to the document
const styleElement = document.createElement('style')
styleElement.textContent = styles
document.head.appendChild(styleElement)

export default function CreateExam() {
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [duration, setDuration] = useState(60)
  const [email, setEmail] = useState("")
  const [instructions, setInstructions] = useState("")
  const [questions, setQuestions] = useState([
    { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" },
  ])

  const navigate = useNavigate()
  const [showJsonInput, setShowJsonInput] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [numQuestions, setNumQuestions] = useState(5)

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", type: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" },
    ])
  }

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      showToast('Please enter a topic for question generation', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const generatedQuestions = await generateExamQuestions(aiTopic, numQuestions)
      setQuestions(generatedQuestions)
      showToast(`Successfully generated ${generatedQuestions.length} questions`, 'success')
      setAiTopic('')
    } catch (error) {
      console.error('Error generating questions:', error)
      showToast(error.message || 'Failed to generate questions', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleJsonImport = () => {
    try {
      if (!jsonInput.trim()) {
        showToast('Please enter JSON data', 'error')
        return
      }
      
      const parsedQuestions = JSON.parse(jsonInput)
      if (!Array.isArray(parsedQuestions)) {
        throw new Error('JSON should be an array of questions')
      }

      // Validate each question
      const validatedQuestions = parsedQuestions.map((q, index) => {
        if (!q.question) {
          throw new Error(`Question at index ${index} is missing 'question' field`)
        }
        if (!q.type || !['mcq', 'answerable'].includes(q.type)) {
          throw new Error(`Question at index ${index} has invalid type. Must be 'mcq' or 'answerable'`)
        }
        if (q.type === 'mcq') {
          if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) {
            throw new Error(`MCQ question at index ${index} is missing options`)
          }
          if (!q.correct_answer || !['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
            throw new Error(`MCQ question at index ${index} has invalid correct answer`)
          }
        } else {
          if (!q.correct_answer) {
            throw new Error(`Answerable question at index ${index} is missing correct_answer`)
          }
        }
        return q
      })

      setQuestions(validatedQuestions)
      setShowJsonInput(false)
      setJsonInput('')
      showToast(`Successfully imported ${validatedQuestions.length} questions`, 'success')
    } catch (error) {
      console.error('Error parsing JSON:', error)
      showToast(`Invalid JSON: ${error.message}`, 'error')
    }
  }

  const handleQuestionChange = (i, field, value) => {
    const updated = [...questions]
    updated[i][field] = value
    setQuestions(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title.trim()) {
      showToast('Please enter an exam title', 'error')
      return
    }

    if (questions.some(q => !q.question.trim())) {
      showToast('Please fill in all question fields', 'error')
      return
    }

    const user = await supabase.auth.getUser()
    const userId = user.data?.user?.id

    const { error } = await supabase.from("exams").insert([
      {
        title,
        subject,
        duration_minutes: duration,
        support_email: email,
        instructions,
        questions,
        created_by: userId,
      },
    ])

    if (error) {
      showToast("Error: " + error.message, 'error')
    } else {
      showToast("Exam created successfully!", 'success')
      navigate("/admin/dashboard")
    }
  }

  // Toast notification configuration
  const showToast = (message, type = 'info') => {
    switch(type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
  }

  return (
    <>
    <Navbar/>
    <div className="page-container">
      <div className="create-exam-container">
        <div className="exam-header">
          <h1>Create New Exam</h1>
          <p className="subtitle">Design and build your exam with advanced tools and AI assistance</p>
        </div>
        
        {/* AI Question Generator Section */}
        <div className="ai-generator-section">
          <h3> AI Question Generator</h3>
          <div className="ai-input-group">
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Enter topic for AI to generate questions (e.g., JavaScript fundamentals, World History)"
            />
            <select 
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                <option key={num} value={num}>{num} questions</option>
              ))}
            </select>
            <button 
              onClick={handleAiGenerate} 
              disabled={isGenerating}
              className="ai-generate-btn"
            >
              {isGenerating ? ' Generating...' : ' Generate Questions'}
            </button>
          </div>
          <p className="ai-hint">
             The AI will generate {numQuestions} high-quality questions about "{aiTopic || 'your topic'}"
          </p>
        </div>

        {/* Import/Export Section */}
        <div className="import-export-section">
          <div className="import-header">
            <h3>Import Questions</h3>
            <button 
              onClick={() => setShowJsonInput(!showJsonInput)}
              className="toggle-import-btn"
            >
              {showJsonInput ? 'Hide Import' : 'Show Import'}
            </button>
          </div>
          
          {showJsonInput && (
            <div className="json-import-container">
              <div className="json-actions">
                <button 
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_QUESTIONS, null, 2))}
                  className="btn btn-secondary"
                >
                  Load Sample
                </button>
                <button 
                  onClick={handleJsonImport}
                  className="btn btn-primary"
                >
                  Import Questions
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your questions in JSON format here..."
                className="json-textarea"
                rows={10}
              />
              <div className="json-format-hint">
                <h4> JSON Format Guide</h4>
                <pre>
{`[
  {
    "question": "Your question here",
    "type": "mcq", // or "answerable"
    "optionA": "Option A",  // For MCQ only
    "optionB": "Option B",  // For MCQ only
    "optionC": "Option C",  // For MCQ only
    "optionD": "Option D",  // For MCQ only
    "correct_answer": "A"   // For MCQ: A/B/C/D, For answerable: string
  },
  // ... more questions
]`}
                </pre>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="exam-form">
          <div className="form-section">
            <h3> Exam Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Exam Title <span className="required">*</span></label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g., Midterm Exam - Computer Science 101"
                  required 
                />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g., Computer Science"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Duration (minutes) <span className="required">*</span></label>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(e.target.value)} 
                  min="1" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Invite by Email (optional)</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="student@example.com"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Exam Instructions (optional)</label>
              <textarea 
                value={instructions} 
                onChange={(e) => setInstructions(e.target.value)} 
                placeholder="Enter any special instructions for the exam..."
                rows="4"
              />
            </div>
          </div>
          
          <div className="questions-section">
            <div className="section-header">
              <h3>Questions</h3>
              <span className="question-count">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="questions-list">
              {questions.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-inbox"></i>
                  <p>No questions added yet. Add your first question to get started.</p>
                </div>
              ) : (
                questions.map((q, i) => (
                  <div key={i} className="question-card">
                    <div className="question-header">
                      <h4>Question {i + 1}</h4>
                      {questions.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeQuestion(i)} 
                          className="btn-delete"
                        >
                           Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="question-type-toggle">
                      <button 
                        type="button" 
                        className={`toggle-btn ${q.type === 'mcq' ? 'active' : ''}`}
                        onClick={() => handleQuestionChange(i, 'type', 'mcq')}
                      >
                         Multiple Choice
                      </button>
                      <button 
                        type="button" 
                        className={`toggle-btn ${q.type === 'answerable' ? 'active' : ''}`}
                        onClick={() => handleQuestionChange(i, 'type', 'answerable')}
                      >
                        Written Answer
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Question Text <span className="required">*</span></label>
                      <textarea
                        value={q.question}
                        onChange={(e) => handleQuestionChange(i, 'question', e.target.value)}
                        placeholder="Enter your question here..."
                        required
                        rows="3"
                      />
                    </div>

                    {q.type === 'mcq' ? (
                      <div className="mcq-options">
                        <label>Options <span className="required">*</span></label>
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <div key={opt} className="option-row">
                            <div className="option-radio">
                              <input
                                type="radio"
                                id={`q${i}-${opt}`}
                                name={`correct-${i}`}
                                checked={q.correct_answer === opt}
                                onChange={() => handleQuestionChange(i, 'correct_answer', opt)}
                              />
                              <span className="option-letter">{opt}.</span>
                            </div>
                            <input
                              type="text"
                              value={q[`option${opt}`] || ''}
                              onChange={(e) => handleQuestionChange(i, `option${opt}`, e.target.value)}
                              placeholder={`Option ${opt}`}
                              className="option-input"
                              required
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="answerable-field">
                        <label>Expected Answer <span className="required">*</span></label>
                        <textarea
                          value={q.correct_answer}
                          onChange={(e) => handleQuestionChange(i, 'correct_answer', e.target.value)}
                          placeholder="Enter the expected answer or key points..."
                          required
                          rows="4"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              <div className="add-question-actions">
                <button 
                  type="button" 
                  onClick={addQuestion} 
                  className="btn btn-outline"
                >
                   Add Question
                </button>
                
                {questions.length > 0 && (
                  <div className="question-stats">
                    <span className="stat">
                      {questions.filter(q => q.type === 'mcq').length} Multiple Choice
                    </span>
                    <span className="stat">
                       {questions.filter(q => q.type === 'answerable').length} Written
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={() => window.history.back()} className="btn btn-text">
              ← Back
            </button>
            <div className="action-buttons">
              <button type="button" onClick={() => {
                showToast('Draft saved successfully', 'info');
              }} className="btn btn-outline">
                 Save as Draft
              </button>
              <button type="submit" className="btn btn-primary">
                Create Exam
              </button>
            </div>
          </div>
        </form>
        
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </div>
    </>
  );
}