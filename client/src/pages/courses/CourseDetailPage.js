import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext provides user and isAuthenticated

// Placeholder for AuthContext if not fully implemented (used in previous steps)
// const useAuth = () => {
//   // Replace with actual auth context logic
//   // return { user: { id: 'student-123' }, isAuthenticated: true, isLoading: false }; // Simulate logged-in student
//   // return { user: null, isAuthenticated: false, isLoading: false }; // Simulate logged-out user
//   const [mockUser, setMockUser] = React.useState(null); // or { id: 'student-123', roles: ['student'] }
//   const login = () => setMockUser({ id: 'student-123', roles: ['student'] });
//   const logout = () => setMockUser(null);
//   return { user: mockUser, isAuthenticated: !!mockUser, isLoading: false, login, logout };
// };


const CourseDetailPage = () => {
  const { slug } = useParams();
  const { user, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // For initial course data fetch
  const [error, setError] = useState(null);

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false); // Tracks if current user is enrolled

  const fetchCourseDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/courses/published/${slug}`);
      setCourse(response.data);
      // After fetching course, we need to check if the current user is enrolled.
      // This is a simplified check for MVP. A more robust check might involve:
      // 1. Having an AuthContext that stores all user's enrolled course IDs.
      // 2. Making a specific API call: GET /api/courses/enrolled/:courseId/status
      // For now, isEnrolled remains false unless user enrolls via this page, or if we had #1.
    } catch (err) {
      console.error(`Failed to fetch course ${slug}:`, err);
      setError(err.response?.data?.message || 'Failed to load course details. It might not exist or is not published.');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  // Placeholder: Check actual enrollment status if user is logged in and course data is available
  // This would typically involve checking against a list of enrolled courses from user state/context
  // or making a dedicated API call. For this MVP, we'll primarily update `isEnrolled` after a successful
  // enrollment action on this page. A user navigating here who is already enrolled might not see
  // "Go to Course" immediately unless that state is globally managed and checked.
  useEffect(() => {
    if (isAuthenticated && course && user) {
      // Conceptual: You might have a list of enrolled course IDs in your AuthContext or a UserContext
      // const isUserAlreadyEnrolled = checkEnrollmentInContext(user.enrolledCourses, course.id);
      // setIsEnrolled(isUserAlreadyEnrolled);
      // For now, this effect doesn't do much beyond demonstrating where such a check would go.
      // The `isEnrolled` state will be set to true upon successful enrollment via `handleEnroll`.
    }
  }, [isAuthenticated, course, user]);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/courses/${slug}` } });
      return;
    }
    if (!course || !course.id) {
      setEnrollmentError("Course details are not available for enrollment.");
      return;
    }

    setIsEnrolling(true);
    setEnrollmentError(null);
    try {
      // The backend /api/courses/:courseId/enroll handles user auth via `protect` middleware
      await apiClient.post(`/courses/${course.id}/enroll`);
      alert('Successfully enrolled! You can now access the course content.');
      setIsEnrolled(true); // Update UI to reflect enrollment
      // Optionally navigate to the course learning page or "My Courses"
      // For now, just update button and message. User can navigate from "Go to Course" button.
    } catch (err) {
      console.error("Enrollment failed:", err);
      setEnrollmentError(err.response?.data?.message || 'Enrollment failed. You might already be enrolled or an error occurred.');
    } finally {
      setIsEnrolling(false);
    }
  };
  
  const styles = { /* Styles from previous CourseListPage, slightly adapted */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '20px auto', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.05)' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    title: { fontSize: '2.2em', margin: '0 0 10px 0', color: '#333' },
    meta: { fontSize: '0.9em', color: '#555', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '15px' },
    metaItem: { backgroundColor: '#f0f0f0', padding: '5px 10px', borderRadius: '4px'},
    description: { lineHeight: '1.7', marginBottom: '30px', fontSize: '1.1em', color: '#444' },
    coverImage: { width: '100%', height: 'auto', maxHeight: '450px', objectFit: 'cover', borderRadius: '8px', marginBottom: '25px'},
    module: { marginBottom: '25px', padding: '15px', border: '1px solid #e9e9e9', borderRadius: '5px', backgroundColor: '#fdfdfd' },
    moduleTitle: { fontSize: '1.5em', marginBottom: '10px', color: '#0056b3' },
    lessonList: { listStyle: 'none', paddingLeft: 0 },
    lessonItem: { padding: '10px 0', borderBottom: '1px dotted #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    lessonTitle: { flexGrow: 1 },
    lessonInfo: { fontSize: '0.85em', color: '#666', marginLeft: '10px' },
    lessonPreviewLink: { fontSize: '0.85em', color: 'green', textDecoration: 'none', fontWeight: 'bold' },
    enrollButton: { padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'block', width: '100%', maxWidth: '300px', margin: '30px auto' },
    enrolledButton: { padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'block', width: '100%', maxWidth: '300px', margin: '30px auto', textDecoration: 'none' },
    disabledButton: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', margin: '15px 0', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em', color: '#6c757d' },
  };

  if (isLoading || authIsLoading) {
    return <div style={styles.loading}>Loading course details...</div>;
  }
  if (error) {
    return <div style={styles.container}><div style={styles.error}>Error: {error} <Link to="/courses">Back to courses</Link></div></div>;
  }
  if (!course) {
    return <div style={styles.container}><div style={styles.loading}>Course not found. <Link to="/courses">Back to courses</Link></div></div>;
  }

  const displayPrice = course.course_price !== undefined && course.course_price !== null 
    ? `$${parseFloat(course.course_price).toFixed(2)}` 
    : 'Free';

  // Determine first lesson ID for "Go to Course" link if enrolled
  let firstLessonLink = `/learn/${course.id}`; // Fallback to general learning page for the course
  if (course.modules && course.modules.length > 0 && course.modules[0].lessons && course.modules[0].lessons.length > 0) {
    firstLessonLink = `/learn/${course.id}/lessons/${course.modules[0].lessons[0].id}`;
  }


  return (
    <div style={styles.container}>
      {course.cover_image_url && <img src={course.cover_image_url} alt={course.title} style={styles.coverImage} />}
      
      <div style={styles.header}>
        <h1 style={styles.title}>{course.title}</h1>
        <div style={styles.meta}>
          <span style={styles.metaItem}>Instructor: {course.instructor_name || 'N/A'}</span>
          <span style={styles.metaItem}>Category: {course.category_name || 'N/A'}</span>
          <span style={styles.metaItem}>Level: {course.level || 'N/A'}</span>
          <span style={styles.metaItem}>Duration: {course.duration_estimate || 'N/A'}</span>
          <span style={styles.metaItem}>Price: <strong>{displayPrice}</strong></span>
        </div>
      </div>
      
      {/* Using dangerouslySetInnerHTML for description if it contains HTML from a rich text editor.
          Ensure content is sanitized backend-side if it's user-generated. */}
      <div style={styles.description} dangerouslySetInnerHTML={{ __html: course.description || '<p>No detailed description available.</p>' }} />

      {enrollmentError && <div style={styles.error}>{enrollmentError}</div>}

      {isAuthenticated && isEnrolled ? (
         <Link to={firstLessonLink} style={styles.enrolledButton}>Go to Course</Link>
      ) : (
        <button 
          onClick={handleEnroll} 
          disabled={isEnrolling || !course.is_published || (isAuthenticated && isEnrolled) } // Disable if not published or already enrolled (client-side check)
          style={isEnrolling || !course.is_published ? {...styles.enrollButton, ...styles.disabledButton} : styles.enrollButton}
        >
          {isEnrolling ? 'Enrolling...' : (course.product_id && displayPrice !== 'Free' ? `Enroll Now (${displayPrice})` : 'Enroll for Free')}
        </button>
      )}
      {!course.is_published && <p style={{textAlign: 'center', color: 'orange', fontWeight: 'bold'}}>This course is not currently available for enrollment.</p>}
      
      <h2 style={{marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px'}}>Course Content</h2>
      {course.modules && course.modules.length > 0 ? course.modules.map(module => (
        <div key={module.id} style={styles.module}>
          <h3 style={styles.moduleTitle}>{module.module_order}. {module.title}</h3>
          {module.description && <p style={{fontSize: '0.9em', color: '#666', marginBottom: '15px'}}>{module.description}</p>}
          <ul style={styles.lessonList}>
            {module.lessons && module.lessons.length > 0 ? module.lessons.map(lesson => (
              <li key={lesson.id} style={styles.lessonItem}>
                <span style={styles.lessonTitle}>{lesson.lesson_order}. {lesson.title}</span>
                <span style={styles.lessonInfo}>
                  ({lesson.lesson_type}, {lesson.duration_minutes || 'N/A'} min)
                  {lesson.is_preview_allowed && (
                    // For MVP, link to a conceptual lesson view with preview flag, or just indicate preview
                    // Actual lesson content for preview is limited by API response
                    <Link to={`/learn/${course.id}/lessons/${lesson.id}?preview=true`} style={styles.lessonPreviewLink}> (Preview)</Link>
                  )}
                </span>
              </li>
            )) : <p style={{fontSize: '0.9em', color: '#777'}}>No lessons in this module yet.</p>}
          </ul>
        </div>
      )) : <p>Course content is not yet available.</p>}
    </div>
  );
};

export default CourseDetailPage;
