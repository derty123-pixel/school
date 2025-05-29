import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext provides user
import EnrolledCourseCard from '../../components/user/EnrolledCourseCard'; // Import EnrolledCourseCard

// Placeholder for AuthContext if not fully implemented (used in previous steps)
// const useAuth = () => {
//   // Replace with actual auth context logic
//   // return { user: { id: 'student-123' }, isAuthenticated: true, isLoading: false }; // Simulate logged-in student
//   return { user: null, isAuthenticated: false, isLoading: false }; // Simulate logged-out user
// };

const MyCoursesPage = () => {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalCourses: 0, 
    limit: 9 // Default limit, e.g., for a 3x3 grid
  });
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();

  const fetchEnrolledCourses = useCallback(async (page = 1) => {
    // This check is important because this page should only load data if user is authenticated.
    // ProtectedRoute handles redirection, but this prevents API calls if somehow rendered otherwise.
    if (!isAuthenticated) {
      setIsLoading(false); // Ensure loading is false if not authenticated
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page,
        limit: pagination.limit,
      });
      const response = await apiClient.get(`/courses/enrolled?${params.toString()}`);
      setEnrolledCourses(response.data.courses || []);
      setPagination(response.data.pagination || { 
        currentPage: page, 
        totalPages: 1, 
        totalCourses: response.data.courses?.length || 0, 
        limit: pagination.limit 
      });
    } catch (err) {
      console.error("Failed to fetch enrolled courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch your enrolled courses.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, pagination.limit]); // Dependency on isAuthenticated and pagination.limit

  useEffect(() => {
    // Only fetch if authenticated and authentication is not loading
    if (isAuthenticated && !authIsLoading) {
      fetchEnrolledCourses(pagination.currentPage);
    } else if (!isAuthenticated && !authIsLoading) {
      // If user logs out while on this page, or was never logged in.
      // ProtectedRoute should handle redirection, but as a fallback:
      setEnrolledCourses([]); // Clear courses
      setPagination({ currentPage: 1, totalPages: 1, totalCourses: 0, limit: 9 });
    }
  }, [isAuthenticated, authIsLoading, fetchEnrolledCourses, pagination.currentPage]);
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
      fetchEnrolledCourses(newPage);
    }
  };

  const styles = { /* Similar to CourseListPage styles */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' },
    title: { textAlign: 'center', marginBottom: '30px', fontSize: '2.2em' },
    courseGrid: { display: 'flex', flexWrap: 'wrap', margin: '0 -15px', justifyContent: 'flex-start' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center', margin: '20px'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em', color: '#6c757d' },
    infoMessage: { textAlign: 'center', padding: '30px', fontSize: '1.1em', color: '#555' },
    paginationControls: { marginTop: '30px', textAlign: 'center', paddingBottom: '20px' },
    pageButton: { margin: '0 5px', padding: '8px 12px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' },
    activePageButton: { backgroundColor: '#007bff', color: 'white', border: '1px solid #007bff'},
    disabledPageButton: { cursor: 'not-allowed', opacity: 0.6 }
  };

  if (authIsLoading || (isLoading && enrolledCourses.length === 0 && pagination.currentPage === 1)) {
    return <div style={styles.loading}>Loading your courses...</div>;
  }

  // ProtectedRoute should ideally handle this, but as a safeguard:
  if (!isAuthenticated && !authIsLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.infoMessage}>
          Please <Link to="/login">log in</Link> to view your enrolled courses.
        </p>
      </div>
    );
  }
  
  if (error) {
    return <div style={styles.error}>Error: {error} <button onClick={() => fetchEnrolledCourses(pagination.currentPage)} style={{marginLeft: '10px'}}>Retry</button></div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>My Courses</h1>
      {isLoading && <p style={styles.loading}>Updating your courses...</p>}

      {!isLoading && enrolledCourses.length === 0 && !error && (
         <p style={styles.infoMessage}>
            You are not yet enrolled in any courses. 
            <Link to="/courses" style={{marginLeft: '5px', textDecoration:'underline', color: '#007bff'}}>Explore available courses</Link>!
         </p>
      )}

      {enrolledCourses.length > 0 && (
        <div style={styles.courseGrid}>
          {enrolledCourses.map(course => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
      
      {pagination.totalPages > 1 && (
        <div style={styles.paginationControls}>
          <button 
            onClick={() => handlePageChange(pagination.currentPage - 1)} 
            disabled={pagination.currentPage === 1 || isLoading}
            style={{...styles.pageButton, ...(pagination.currentPage === 1 || isLoading ? styles.disabledPageButton : {})}}
          >
            &laquo; Previous
          </button>
          {[...Array(pagination.totalPages).keys()].map(num => {
            const pageNum = num + 1;
             if (
                pagination.totalPages <= 7 ||
                (pageNum === 1) ||
                (pageNum === pagination.totalPages) ||
                (pageNum >= pagination.currentPage - 1 && pageNum <= pagination.currentPage + 1) ||
                (pagination.currentPage <= 3 && pageNum <= 5) ||
                (pagination.currentPage >= pagination.totalPages - 2 && pageNum >= pagination.totalPages - 4)
            ) {
                 return (
                    <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                        style={{
                            ...styles.pageButton, 
                            ...(pageNum === pagination.currentPage ? styles.activePageButton : {}),
                            ...(isLoading ? styles.disabledPageButton : {})
                        }}
                    >
                        {pageNum}
                    </button>
                 );
            } else if (
                (pagination.currentPage > 3 && pageNum === pagination.currentPage - 2) ||
                (pagination.currentPage < pagination.totalPages - 2 && pageNum === pagination.currentPage + 2)
            ) {
                return <span key={`ellipsis-${pageNum}`} style={{margin: '0 5px'}}>...</span>;
            }
            return null;
          })}
          <button 
            onClick={() => handlePageChange(pagination.currentPage + 1)} 
            disabled={pagination.currentPage === pagination.totalPages || isLoading}
            style={{...styles.pageButton, ...(pagination.currentPage === pagination.totalPages || isLoading ? styles.disabledPageButton : {})}}
          >
            Next &raquo;
          </button>
        </div>
      )}
    </div>
  );
};

export default MyCoursesPage;
