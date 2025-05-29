import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext provides user

// Placeholder for AuthContext if not fully implemented
// const useAuth = () => ({ user: { id: 'test-user-id' }, isAuthenticated: true, isLoading: false }); 

const EnrolledCourseCard = ({ course }) => {
  const cardStyle = {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '15px',
    margin: '15px',
    width: 'calc(33.333% - 30px)',
    boxSizing: 'border-box',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  };
  const imageStyle = {
    width: '100%',
    height: '150px',
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    lineHeight: '150px',
    color: '#aaa',
    borderRadius: '4px 4px 0 0',
    overflow: 'hidden'
  };
  const contentStyle = { padding: '10px 0' };
  const titleStyle = { fontSize: '1.2em', fontWeight: 'bold', marginBottom: '5px', minHeight: '44px' };
  const instructorStyle = { fontSize: '0.8em', color: '#777', marginBottom: '10px' };
  const progressContainerStyle = { width: '100%', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '15px', height: '20px', overflow: 'hidden' };
  const progressBarStyle = { width: `${course.progress_percent || 0}%`, backgroundColor: '#28a745', height: '100%', lineHeight: '20px', color: 'white', textAlign: 'center', fontSize: '0.8em' };
  const linkStyle = { textDecoration: 'none', color: '#007bff', fontWeight: 'bold', display: 'block', textAlign: 'center', padding: '10px', border: '1px solid #007bff', borderRadius: '4px', marginTop: 'auto' };

  // Determine the link to the first lesson or last accessed lesson
  const learnLink = course.last_accessed_lesson_id 
    ? `/learn/${course.id}/lessons/${course.last_accessed_lesson_id}` // Assuming this route structure
    : `/learn/${course.id}`; // Fallback to course overview or first lesson (to be handled by CourseLearningPage)


  return (
    <div style={cardStyle}>
      <div>
        <div style={imageStyle}>
            {course.cover_image_url ? <img src={course.cover_image_url} alt={course.title} style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : 'No Image'}
        </div>
        <div style={contentStyle}>
            <h3 style={titleStyle}>{course.title}</h3>
            {course.instructor_name && <p style={instructorStyle}>By: {course.instructor_name}</p>}
            <div style={progressContainerStyle} title={`Progress: ${course.progress_percent || 0}%`}>
                <div style={progressBarStyle}>
                    {course.progress_percent || 0}%
                </div>
            </div>
        </div>
      </div>
      <Link to={learnLink} style={linkStyle}>
        {course.progress_percent > 0 && course.progress_percent < 100 ? 'Continue Learning' : (course.progress_percent === 100 ? 'Review Course' : 'Start Learning')}
      </Link>
    </div>
  );
};


const MyCoursesPage = () => {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0, limit: 9 });
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const fetchEnrolledCourses = useCallback(async (page = 1) => {
    if (!isAuthenticated) return; // Should be caught by ProtectedRoute, but good check

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/courses/enrolled?page=${page}&limit=${pagination.limit}`);
      setEnrolledCourses(response.data.courses || []);
      setPagination(response.data.pagination || { currentPage: 1, totalPages: 1, totalCourses: 0, limit: 9 });
    } catch (err) {
      console.error("Failed to fetch enrolled courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch your courses.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, pagination.limit]);

  useEffect(() => {
    if (isAuthenticated) { // Only fetch if authenticated
        fetchEnrolledCourses(pagination.currentPage);
    }
  }, [isAuthenticated, fetchEnrolledCourses, pagination.currentPage]);
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  const styles = { /* Similar to CourseListPage */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' },
    title: { textAlign: 'center', marginBottom: '30px' },
    courseGrid: { display: 'flex', flexWrap: 'wrap', margin: '0 -15px' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em' },
    paginationControls: { marginTop: '30px', textAlign: 'center' },
    pageButton: { margin: '0 8px', padding: '8px 12px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px' }
  };

  if (authLoading || (isLoading && enrolledCourses.length === 0)) {
    return <div style={styles.loading}>Loading your enrolled courses...</div>;
  }

  if (!isAuthenticated && !authLoading) { // Should be handled by ProtectedRoute
    return (
        <div style={styles.container}>
            <p style={{textAlign: 'center'}}>Please <Link to="/login">log in</Link> to see your courses.</p>
        </div>
    );
  }
  
  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>My Enrolled Courses</h1>
      {isLoading && enrolledCourses.length > 0 && <p style={{textAlign: 'center'}}>Updating course list...</p>}

      {enrolledCourses.length > 0 ? (
        <div style={styles.courseGrid}>
          {enrolledCourses.map(course => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        !isLoading && <p style={{textAlign: 'center'}}>You are not yet enrolled in any courses. <Link to="/courses">Explore courses</Link></p>
      )}
      
      {pagination.totalPages > 1 && (
        <div style={styles.paginationControls}>
          <button 
            onClick={() => handlePageChange(pagination.currentPage - 1)} 
            disabled={pagination.currentPage === 1 || isLoading}
            style={styles.pageButton}
          >
            &laquo; Previous
          </button>
          <span> Page {pagination.currentPage} of {pagination.totalPages} </span>
          <button 
            onClick={() => handlePageChange(pagination.currentPage + 1)} 
            disabled={pagination.currentPage === pagination.totalPages || isLoading}
            style={styles.pageButton}
          >
            Next &raquo;
          </button>
        </div>
      )}
    </div>
  );
};

export default MyCoursesPage;
