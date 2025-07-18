import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid && uuid.match(uuidRegex);
};

export default function ExamRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id && isValidUUID(id)) {
      // Redirect to the exam intro page if we have a valid UUID
      navigate(`/exam/intro/${id}`, { replace: true });
    } else {
      // Redirect to intro page if the ID is invalid or missing
      navigate('/exam/intro', { 
        replace: true,
        state: { 
          error: 'Invalid exam link',
          message: 'The exam link you followed is invalid or has expired.'
        }
      });
    }
  }, [id, navigate]);

  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Redirecting to exam...</p>
    </div>
  );
}
