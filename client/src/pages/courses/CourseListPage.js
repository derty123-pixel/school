import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/api'; // Assuming apiClient is configured

// Placeholder for a Course Card component
const CourseCard = ({ course }) => {
  const cardStyle = {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '15px',
    margin: '15px',
    width: 'calc(33.333% - 30px)', // Adjust for 3 cards per row, considering margin
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
  const titleStyle = { fontSize: '1.2em', fontWeight: 'bold', marginBottom: '5px', minHeight: '44px' }; // Min height for 2 lines
  const descriptionStyle = { fontSize: '0.9em', color: '#555', marginBottom: '10px', minHeight: '70px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'  };
  const instructorStyle = { fontSize: '0.8em', color: '#777', marginBottom: '10px' };
  const priceStyle = { fontSize: '1.1em', fontWeight: 'bold', color: '#333', marginBottom: '15px' };
  const linkStyle = { textDecoration: 'none', color: '#007bff', fontWeight: 'bold', display: 'block', textAlign: 'center', padding: '10px', border: '1px solid #007bff', borderRadius: '4px', marginTop: 'auto' };

  return (
    <div style={cardStyle}>
      <div>
        <div style={imageStyle}>
            {course.cover_image_url ? <img src={course.cover_image_url} alt={course.title} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : 'No Image'}
        </div>
        <div style={contentStyle}>
            <h3 style={titleStyle}>{course.title}</h3>
            <p style={descriptionStyle}>{course.description || 'No description available.'}</p>
            {course.instructor_name && <p style={instructorStyle}>By: {course.instructor_name}</p>}
            {course.course_price !== undefined && course.course_price !== null ? (
                <p style={priceStyle}>${parseFloat(course.course_price).toFixed(2)}</p>
            ) : (
                <p style={priceStyle}>Free</p>
            )}
        </div>
      </div>
      <Link to={`/courses/${course.slug}`} style={linkStyle}>View Details</Link>
    </div>
  );
};


const CourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0, limit: 9 }); // 3x3 grid

  const fetchPublishedCourses = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/courses/published?page=${page}&limit=${pagination.limit}`);
      setCourses(response.data.courses || []);
      setPagination(response.data.pagination || { currentPage: 1, totalPages: 1, totalCourses: 0, limit: 9 });
    } catch (err) {
      console.error("Failed to fetch published courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch courses.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchPublishedCourses(pagination.currentPage);
  }, [fetchPublishedCourses, pagination.currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };
  
  const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' },
    title: { textAlign: 'center', marginBottom: '30px' },
    courseGrid: { display: 'flex', flexWrap: 'wrap', margin: '0 -15px' }, // For card gutters
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em' },
    paginationControls: { marginTop: '30px', textAlign: 'center' },
    pageButton: { margin: '0 8px', padding: '8px 12px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px' }
  };

  if (isLoading && courses.length === 0) {
    return <div style={styles.loading}>Loading available courses...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Explore Our Courses</h1>
      {error && <div style={styles.error}>Error: {error}</div>}
      {isLoading && courses.length > 0 && <p style={{textAlign: 'center'}}>Updating course list...</p>}

      {courses.length > 0 ? (
        <div style={styles.courseGrid}>
          {courses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        !isLoading && <p style={{textAlign: 'center'}}>No courses available at the moment. Please check back later!</p>
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

export default CourseListPage;
