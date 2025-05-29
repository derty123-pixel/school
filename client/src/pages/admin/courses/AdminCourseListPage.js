import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }_from 'react-router-dom';
import apiClient from '../../../utils/api'; // Assuming apiClient is configured

const AdminCourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCourses: 0, limit: 10 });
  const navigate = useNavigate();

  const fetchCourses = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      // Admin/Instructor roles are checked by backend API based on JWT
      const response = await apiClient.get(`/admin/courses?page=${page}&limit=${pagination.limit}`);
      setCourses(response.data.courses);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchCourses(pagination.currentPage);
  }, [fetchCourses, pagination.currentPage]);

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (window.confirm(`Are you sure you want to delete the course "${courseTitle}"? This action cannot be undone.`)) {
      setIsLoading(true); // You might want a more specific loading state for delete
      try {
        await apiClient.delete(`/admin/courses/${courseId}`);
        // Re-fetch courses after delete
        fetchCourses(pagination.currentPage); 
        // Or, filter out the deleted course from current state for faster UI update:
        // setCourses(prevCourses => prevCourses.filter(course => course.id !== courseId));
        alert(`Course "${courseTitle}" deleted successfully.`);
      } catch (err) {
        console.error(`Failed to delete course ${courseId}:`, err);
        setError(err.response?.data?.message || `Failed to delete course "${courseTitle}".`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  // Basic styling
  const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { margin: 0 },
    button: { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', textDecoration: 'none', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
    th: { borderBottom: '2px solid #dee2e6', padding: '12px', textAlign: 'left', backgroundColor: '#f8f9fa'},
    td: { borderBottom: '1px solid #dee2e6', padding: '12px' },
    actionButton: { marginRight: '10px', padding: '6px 10px', fontSize: '0.9em', cursor: 'pointer' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', margin: '10px 0'},
    loading: { textAlign: 'center', padding: '20px', fontSize: '1.2em' },
    paginationControls: { marginTop: '20px', textAlign: 'center' },
    pageButton: { margin: '0 5px', padding: '5px 10px', cursor: 'pointer' }
  };

  if (isLoading && courses.length === 0) {
    return <div style={styles.loading}>Loading courses...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Manage Courses</h1>
        <Link to="/admin/courses/new" style={styles.button}>Create New Course</Link>
      </div>

      {error && <div style={styles.error}>Error: {error}</div>}
      {isLoading && <p>Updating course list...</p>}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Title</th>
            <th style={styles.th}>Instructor</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.length > 0 ? courses.map(course => (
            <tr key={course.id}>
              <td style={styles.td}>{course.title}</td>
              <td style={styles.td}>{course.instructor_email || 'N/A'}</td>
              <td style={styles.td}>{course.category_name || 'N/A'}</td>
              <td style={styles.td}>{course.is_published ? 'Published' : 'Draft'}</td>
              <td style={styles.td}>
                <button 
                  onClick={() => navigate(`/admin/courses/${course.id}/edit`)} 
                  style={{...styles.actionButton, backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '3px'}}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteCourse(course.id, course.title)}
                  style={{...styles.actionButton, backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px'}}
                  disabled={isLoading} // Disable if any loading is happening
                >
                  Delete
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" style={{...styles.td, textAlign: 'center'}}>No courses found.</td>
            </tr>
          )}
        </tbody>
      </table>
      
      {pagination.totalPages > 1 && (
        <div style={styles.paginationControls}>
          <button 
            onClick={() => handlePageChange(pagination.currentPage - 1)} 
            disabled={pagination.currentPage === 1 || isLoading}
            style={styles.pageButton}
          >
            Previous
          </button>
          <span> Page {pagination.currentPage} of {pagination.totalPages} </span>
          <button 
            onClick={() => handlePageChange(pagination.currentPage + 1)} 
            disabled={pagination.currentPage === pagination.totalPages || isLoading}
            style={styles.pageButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCourseListPage;
