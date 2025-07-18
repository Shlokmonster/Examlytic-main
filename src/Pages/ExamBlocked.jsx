import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import supabase from '../SupabaseClient';
import { FaLock, FaArrowLeft, FaCalendarAlt, FaClock, FaBook } from 'react-icons/fa';

function ExamBlocked() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Exam not found');
        
        setExam(data);
      } catch (error) {
        console.error('Error fetching exam details:', error);
        toast.error(error.message || 'Error loading exam details');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchExamDetails();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading exam details...</p>
      </div>
    );
  }

  return (
    <div className="exam-blocked-container">
      <div className="blocked-content">
        <div className="blocked-icon">
          <FaLock size={48} />
        </div>
        <h2>Exam Locked</h2>
        
        {exam ? (
          <div className="exam-details">
            <h3>{exam.title}</h3>
            <div className="detail-item">
              <FaBook className="detail-icon" />
              <span>{exam.subject || 'General'}</span>
            </div>
            <div className="detail-item">
              <FaClock className="detail-icon" />
              <span>{exam.duration_minutes} minutes</span>
            </div>
            <div className="detail-item">
              <FaCalendarAlt className="detail-icon" />
              <span>Created on {new Date(exam.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ) : (
          <p>Exam details not available.</p>
        )}
        
        <div className="blocked-message">
          <p>This exam is currently locked and cannot be accessed at this time.</p>
          <p>Please contact your instructor or administrator if you believe this is an error.</p>
        </div>
        
        <div className="action-buttons">
          <button onClick={handleGoBack} className="btn btn-outline">
            <FaArrowLeft /> Go Back
          </button>
          <Link to="/" className="btn btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ExamBlocked;
