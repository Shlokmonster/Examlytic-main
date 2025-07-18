import { useEffect, useState } from 'react';
import { useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import supabase from '../SupabaseClient';

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid && uuid.match(uuidRegex);
};

function ExamStatusCheck() {
  const { id } = useParams();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkExamStatus = async () => {
      // Skip if no ID or invalid UUID format
      if (!id || !isValidUUID(id)) {
        setError('Invalid exam ID');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) {
          setError('Exam not found');
          return;
        }
        
        setExam(data);
        setIsActive(data.is_active);
      } catch (err) {
        console.error('Error checking exam status:', err);
        setError(err.message || 'Error checking exam status');
      } finally {
        setIsLoading(false);
      }
    };

    checkExamStatus();
  }, [id]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading exam...</p>
      </div>
    );
  }

  // Handle errors
  if (error) {
    // Don't show error toast if we're already on the intro page
    if (!location.pathname.includes('/exam/intro')) {
      toast.error('Invalid or expired exam link');
      return <Navigate to="/exam/intro" replace state={{ from: location }} />;
    }
    return null;
  }

  // If exam is not active, redirect to blocked page
  if (exam && !isActive) {
    // Only redirect if we're not already on the blocked page
    if (!location.pathname.includes('/blocked')) {
      return <Navigate to={`/exam/${id}/blocked`} replace />;
    }
    // If we're already on the blocked page, just render the children
    return <Outlet context={{ exam }} />;
  }

  // If we have an exam and it's active, render the child routes with exam data
  if (exam && isActive) {
    return <Outlet context={{ exam }} />;
  }

  // Fallback - redirect to intro if something unexpected happens
  return <Navigate to="/exam/intro" replace />;
}

export default ExamStatusCheck;
