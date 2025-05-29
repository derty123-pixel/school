import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext provides user and isAuthenticated

// Placeholder for AuthContext if not fully implemented
// const useAuth = () => ({ user: null, isAuthenticated: false, isLoading: false }); 

const CourseDetailPage = () => {
  const { slug } = useParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth(); // Get user and auth status
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false); // Local state to track if current user is enrolled

  const fetchCourseDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/courses/published/${slug}`);
      setCourse(response.data);
      // After fetching course, check enrollment status if user is authenticated
      // This check is primarily for UI (e.g. to change "Enroll" to "Go to Course")
      // The backend will re-validate enrollment on actual enroll attempt or content access
    } catch (err) {
      console.error(`Failed to fetch course ${slug}:`, err);
      setError(err.response?.data?.message || 'Failed to load course details.');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  // Check enrollment status if user and course are loaded
  // This is a simplified check. A more robust way might be to fetch user's enrollments
  // or have a dedicated endpoint to check enrollment for a specific course.
  useEffect(() => {
    if (isAuthenticated && course && user) {
        // For MVP, let's assume if /my-courses page has this course, they are enrolled.
        // A proper check would be:
        // const checkEnroll = async () => {
        //   try {
        //     const res = await apiClient.get(`/courses/enrolled/${course.id}/status`); // Fictional endpoint
        //     setIsEnrolled(res.data.isEnrolled);
        //   } catch (e) { console.error("Failed to check enrollment", e); }
        // }
        // checkEnroll();
        // For now, we don't have a direct check, so `isEnrolled` will remain false unless updated by enroll action.
        // A user might be enrolled but this page won't know until they try to enroll or go via "My Courses"
    }
  }, [isAuthenticated, course, user]);


  const handleEnroll = async () => {
    if (!isAuthenticated) {
      // Redirect to login, passing current page to return after login
      navigate('/login', { state: { from: `/courses/${slug}` } });
      return;
    }
    if (!course || !course.id) {
        setEnrollError("Course details not available for enrollment.");
        return;
    }

    setIsEnrolling(true);
    setEnrollError(null);
    try {
      await apiClient.post(`/courses/${course.id}/enroll`);
      alert('Successfully enrolled! You can now access the course content.');
      setIsEnrolled(true); // Update local state
      // Navigate to the learning view for the course or My Courses page
      navigate(`/learn/${course.id}`); // Or to a specific first lesson
    } catch (err) {
      console.error("Enrollment failed:", err);
      setEnrollError(err.response?.data?.message || 'Enrollment failed. You might already be enrolled or an error occurred.');
    } finally {
      setIsEnrolling(false);
    }
  };
  
  // Basic styling
  const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    title: { fontSize: '2em', margin: '0 0 10px 0' },
    meta: { fontSize: '0.9em', color: '#555', marginBottom: '10px' },
    description: { lineHeight: '1.6', marginBottom: '30px' },
    coverImage: { width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '20px'},
    module: { marginBottom: '20px', padding: '15px', border: '1px solid #f0f0f0', borderRadius: '5px' },
    moduleTitle: { fontSize: '1.4em', marginBottom: '10px' },
    lessonList: { listStyle: 'none', paddingLeft: 0 },
    lessonItem: { padding: '8px 0', borderBottom: '1px dotted #eee', display: 'flex', justifyContent: 'space-between' },
    lessonPreview: { fontSize: '0.8em', color: 'green' },
    enrollButton: { padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'block', margin: '20px auto' },
    enrolledButton: { padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'block', margin: '20px auto', textDecoration: 'none' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', margin: '10px 0', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em' },
  };

  if (isLoading || authLoading) {
    return <div style={styles.loading}>Loading course details...</div>;
  }
  if (error) {
    return <div style={styles.error}>Error: {error} <Link to="/courses">Back to courses</Link></div>;
  }
  if (!course) {
    return <div style={styles.loading}>Course not found. <Link to="/courses">Back to courses</Link></div>;
  }

  const displayPrice = course.course_price !== undefined && course.course_price !== null 
    ? `$${parseFloat(course.course_price).toFixed(2)}` 
    : 'Free';

  return (
    <div style={styles.container}>
      {course.cover_image_url && <img src={course.cover_image_url} alt={course.title} style={styles.coverImage} />}
      <div style={styles.header}>
        <h1 style={styles.title}>{course.title}</h1>
        <p style={styles.meta}>
          Instructor: {course.instructor_name || 'N/A'} | 
          Category: {course.category_name || 'N/A'} | 
          Level: {course.level || 'N/A'} |
          Duration: {course.duration_estimate || 'N/A'} |
          Price: {displayPrice}
        </p>
      </div>
      
      <div style={styles.description} dangerouslySetInnerHTML={{ __html: course.description || '<p>No detailed description available.</p>' }} />

      {enrollError && <div style={styles.error}>{enrollError}</div>}

      {isEnrolled ? (
         <Link to={`/learn/${course.id}`} style={styles.enrolledButton}>Go to Course</Link>
      ) : (
        <button onClick={handleEnroll} disabled={isEnrolling} style={styles.enrollButton}>
          {isEnrolling ? 'Enrolling...' : (course.product_id ? `Enroll Now (${displayPrice})` : 'Enroll for Free')}
        </button>
      )}
      
      <h2 style={{marginTop: '40px'}}>Course Content</h2>
      {course.modules && course.modules.length > 0 ? course.modules.map(module => (
        <div key={module.id} style={styles.module}>
          <h3 style={styles.moduleTitle}>{module.module_order}. {module.title}</h3>
          {module.description && <p style={{fontSize: '0.9em', color: '#666'}}>{module.description}</p>}
          <ul style={styles.lessonList}>
            {module.lessons && module.lessons.length > 0 ? module.lessons.map(lesson => (
              <li key={lesson.id} style={styles.lessonItem}>
                <span>{lesson.lesson_order}. {lesson.title} ({lesson.lesson_type}, {lesson.duration_minutes || 'N/A'} min)</span>
                {lesson.is_preview_allowed && <span style={styles.lessonPreview}> (Preview Available)</span>}
              </li>
            )) : <p>No lessons in this module yet.</p>}
          </ul>
        </div>
      )) : <p>Course content is not yet available.</p>}
    </div>
  );
};

export default CourseDetailPage;
