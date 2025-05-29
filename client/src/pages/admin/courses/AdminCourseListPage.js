import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/api'; // Assuming apiClient is configured

const AdminCourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalPages: 1, 
    totalCourses: 0, 
    limit: 10 // Default limit
  });
  const [isDeleting, setIsDeleting] = useState(null); // Stores ID of course being deleted

  const navigate = useNavigate();

  const fetchCourses = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/admin/courses?page=${page}&limit=${pagination.limit}`);
      setCourses(response.data.courses || []);
      setPagination(response.data.pagination || { currentPage: 1, totalPages: 1, totalCourses: 0, limit: pagination.limit });
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      setError(err.response?.data?.message || 'Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit]); // Dependency on pagination.limit if it can change

  useEffect(() => {
    fetchCourses(pagination.currentPage);
  }, [fetchCourses, pagination.currentPage]);

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (window.confirm(`Are you sure you want to delete the course "${courseTitle}"? This action cannot be undone and will delete all associated modules and lessons.`)) {
      setIsDeleting(courseId);
      setError(null);
      try {
        await apiClient.delete(`/admin/courses/${courseId}`);
        alert(`Course "${courseTitle}" deleted successfully.`);
        // Refresh list:
        // If the current page becomes empty after deletion, try to go to previous page or first page.
        if (courses.length === 1 && pagination.currentPage > 1) {
          fetchCourses(pagination.currentPage - 1);
        } else {
          fetchCourses(pagination.currentPage); 
        }
      } catch (err) {
        console.error(`Failed to delete course ${courseId}:`, err);
        setError(err.response?.data?.message || `Failed to delete course "${courseTitle}".`);
      } finally {
        setIsDeleting(null);
      }
    }
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { margin: 0, fontSize: '2em' },
    button: { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', textDecoration: 'none', cursor: 'pointer', fontSize: '1em' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    th: { borderBottom: '2px solid #dee2e6', padding: '12px', textAlign: 'left', backgroundColor: '#f8f9fa'},
    td: { borderBottom: '1px solid #dee2e6', padding: '12px', verticalAlign: 'middle' },
    actionButton: { marginRight: '10px', padding: '6px 10px', fontSize: '0.9em', cursor: 'pointer', border: 'none', borderRadius: '4px' },
    editButton: { backgroundColor: '#17a2b8', color: 'white' },
    deleteButton: { backgroundColor: '#dc3545', color: 'white' },
    error: { color: 'red', backgroundColor: '#f8d7da', borderColor: '#f5c6cb', padding: '10px', borderRadius: '5px', margin: '10px 0', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '20px', fontSize: '1.2em', color: '#6c757d' },
    paginationControls: { marginTop: '20px', textAlign: 'center' },
    pageButton: { margin: '0 5px', padding: '8px 12px', cursor: 'pointer', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' },
    activePageButton: { backgroundColor: '#007bff', color: 'white', border: '1px solid #007bff'},
    disabledPageButton: { cursor: 'not-allowed', opacity: 0.6 }
  };

  if (isLoading && courses.length === 0 && pagination.currentPage === 1) {
    return <div style={styles.loading}>Loading courses...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Manage Courses</h1>
        <Link to="/admin/courses/new" style={styles.button}>Create New Course</Link>
      </div>

      {error && <div style={styles.error}>Error: {error} <button onClick={() => setError(null)} style={{marginLeft: '10px', background: 'none', border: '1px solid red', borderRadius: '3px', cursor: 'pointer'}}>X</button></div>}
      
      {isLoading && <p style={styles.loading}>Updating course list...</p>}

      <table style={styles.table}>
        <thead style={{backgroundColor: '#f8f9fa'}}>
          <tr>
            <th style={styles.th}>Title</th>
            <th style={styles.th}>Instructor</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!isLoading && courses.length > 0 ? courses.map(course => (
            <tr key={course.id}>
              <td style={styles.td}>{course.title}</td>
              <td style={styles.td}>{course.instructor_email || 'N/A'}</td>
              <td style={styles.td}>{course.category_name || 'N/A'}</td>
              <td style={styles.td}>{course.is_published ? 
                <span style={{color: 'green', fontWeight: 'bold'}}>Published</span> : 
                <span style={{color: 'orange', fontWeight: 'bold'}}>Draft</span>}
              </td>
              <td style={styles.td}>
                <button 
                  onClick={() => navigate(`/admin/courses/${course.id}/edit`)} 
                  style={{...styles.actionButton, ...styles.editButton}}
                  disabled={isDeleting === course.id}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteCourse(course.id, course.title)}
                  style={{...styles.actionButton, ...styles.deleteButton}}
                  disabled={isDeleting === course.id || isLoading}
                >
                  {isDeleting === course.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          )) : (
            !isLoading && (
              <tr>
                <td colSpan="5" style={{...styles.td, textAlign: 'center', padding: '20px'}}>
                  No courses found. {pagination.currentPage > 1 ? "Try a previous page or " : ""}
                  <Link to="/admin/courses/new">create one now</Link>!
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      
      {pagination.totalPages > 1 && (
        <div style={styles.paginationControls}>
          <button 
            onClick={() => handlePageChange(pagination.currentPage - 1)} 
            disabled={pagination.currentPage === 1 || isLoading}
            style={{...styles.pageButton, ...(pagination.currentPage === 1 || isLoading ? styles.disabledPageButton : {})}}
          >
            &laquo; Previous
          </button>
          {/* Simple page number display - can be expanded to show more page numbers */}
          {[...Array(pagination.totalPages).keys()].map(num => {
            const pageNum = num + 1;
            // Limit displayed page numbers for brevity if many pages
            if (
                pagination.totalPages <= 7 || // Show all if 7 or less
                (pageNum === 1) || // Always show first page
                (pageNum === pagination.totalPages) || // Always show last page
                (pageNum >= pagination.currentPage - 1 && pageNum <= pagination.currentPage + 1) || // Show current and direct neighbors
                (pagination.currentPage <= 3 && pageNum <= 5) || // Show first 5 if near beginning
                (pagination.currentPage >= pagination.totalPages - 2 && pageNum >= pagination.totalPages - 4) // Show last 5 if near end
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
                return <span key={pageNum} style={{margin: '0 5px'}}>...</span>;
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

export default AdminCourseListPage;
