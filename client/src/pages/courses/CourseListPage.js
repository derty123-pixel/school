import React, { useState, useEffect, useCallback } from 'react';
// Removed Link from here as CourseCard handles its own navigation
import apiClient from '../../utils/api'; 
import CourseCard from '../../components/courses/CourseCard'; // Import CourseCard

const CourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalCourses: 0, 
    limit: 9 // Default limit for a 3x3 grid
  });
  // Add state for filters if implementing UI for them
  // const [filters, setFilters] = useState({ categoryId: null, instructorId: null });

  const fetchPublishedCourses = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      // Construct query parameters for API call
      const params = new URLSearchParams({
        page: page,
        limit: pagination.limit,
      });
      // if (filters.categoryId) params.append('categoryId', filters.categoryId);
      // if (filters.instructorId) params.append('instructorId', filters.instructorId);

      const response = await apiClient.get(`/courses/published?${params.toString()}`);
      setCourses(response.data.courses || []);
      setPagination(response.data.pagination || { 
        currentPage: page, 
        totalPages: 1, 
        totalCourses: response.data.courses?.length || 0, 
        limit: pagination.limit 
      });
    } catch (err) {
      console.error("Failed to fetch published courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch courses.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit /*, filters */]); // Add filters to dependency array if used

  useEffect(() => {
    fetchPublishedCourses(pagination.currentPage);
  }, [fetchPublishedCourses, pagination.currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
      // setPagination(prev => ({ ...prev, currentPage: newPage })); // This would also work
      // To directly fetch for the new page:
      fetchPublishedCourses(newPage);
    }
  };
  
  const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' },
    title: { textAlign: 'center', marginBottom: '30px', fontSize: '2.2em' },
    courseGrid: { display: 'flex', flexWrap: 'wrap', margin: '0 -15px', justifyContent: 'flex-start' }, // Ensure cards start from left
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center', margin: '20px'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em', color: '#6c757d' },
    paginationControls: { marginTop: '30px', textAlign: 'center', paddingBottom: '20px' },
    pageButton: { margin: '0 5px', padding: '8px 12px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' },
    activePageButton: { backgroundColor: '#007bff', color: 'white', border: '1px solid #007bff'},
    disabledPageButton: { cursor: 'not-allowed', opacity: 0.6 }
  };

  if (isLoading && courses.length === 0 && pagination.currentPage === 1) {
    return <div style={styles.loading}>Loading available courses...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Explore Our Courses</h1>
      {/* Placeholder for filter UI */}
      {/* <div> Filter by Category / Instructor (UI TBD) </div> */}

      {error && <div style={styles.error}>Error: {error} <button onClick={() => fetchPublishedCourses(pagination.currentPage)} style={{marginLeft: '10px'}}>Retry</button></div>}
      {isLoading && <p style={styles.loading}>Updating course list...</p>}

      {!isLoading && courses.length === 0 && !error && (
         <p style={{textAlign: 'center', fontSize: '1.1em', marginTop: '30px'}}>
            No courses available at the moment that match your criteria. Please check back later!
         </p>
      )}

      {courses.length > 0 && (
        <div style={styles.courseGrid}>
          {courses.map(course => (
            <CourseCard key={course.id} course={course} />
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
          {/* Page numbers generation - simplified for brevity, can be expanded */}
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

export default CourseListPage;
