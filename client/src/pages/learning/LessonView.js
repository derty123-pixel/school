import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext
// import ReactPlayer from 'react-player/lazy'; // Optional: for video playback for various URLs
// import { marked } from 'marked'; // Optional: if text_content is Markdown

// Placeholder for AuthContext if not fully implemented
// const useAuth = () => ({ user: { id: 'test-user-id' }, isAuthenticated: true, isLoading: false }); 

const LessonView = () => {
  const { courseId, lessonId } = useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [courseStructure, setCourseStructure] = useState(null); // To get next/prev lessons
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(null);

  const fetchLessonDetails = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch lesson content itself
      const lessonResponse = await apiClient.get(`/courses/enrolled/${courseId}/lessons/${lessonId}`);
      setLesson(lessonResponse.data);

      // Fetch course structure for next/prev navigation (could be optimized by fetching once per course)
      // This endpoint should return modules and lessons (titles, slugs, ids, order)
      // For now, let's assume getEnrolledCourseContent provides this structure
      // If not, a separate endpoint for course structure might be needed.
      // For this MVP, let's assume we might re-fetch full course content to find next/prev.
      // This is not optimal but simpler for now.
      const courseResponse = await apiClient.get(`/courses/enrolled/${courseId}`);
      setCourseStructure(courseResponse.data); // Expects course with modules and lessons array

    } catch (err) {
      console.error(`Failed to fetch lesson ${lessonId} for course ${courseId}:`, err);
      setError(err.response?.data?.message || 'Failed to load lesson content. You might not be enrolled or the content is unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [courseId, lessonId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLessonDetails();
    } else if (!authLoading) {
        navigate('/login', { state: { from: `/learn/${courseId}/lessons/${lessonId}` } });
    }
  }, [isAuthenticated, authLoading, fetchLessonDetails, courseId, lessonId, navigate]);

  const handleMarkAsComplete = async () => {
    setIsCompleting(true);
    setCompletionError(null);
    try {
      const response = await apiClient.post(`/courses/enrolled/${courseId}/lessons/${lessonId}/complete`);
      // Update lesson state to reflect completion
      setLesson(prev => ({ ...prev, is_completed: true }));
      // Update overall course progress in UI (ideally from context or re-fetch course data)
      alert(`Lesson marked as complete! Progress: ${response.data.progress_percent}%`);
      // Navigate to next lesson or back to course overview
      const nextLesson = findNextLesson();
      if (nextLesson) {
        navigate(`/learn/${courseId}/lessons/${nextLesson.id}`);
      } else {
        navigate(`/learn/${courseId}`); // Or to a "course completed" page/modal
      }
    } catch (err) {
      console.error("Failed to mark lesson as complete:", err);
      setCompletionError(err.response?.data?.message || 'Failed to mark lesson as complete.');
    } finally {
      setIsCompleting(false);
    }
  };
  
  const findNextLesson = () => {
    if (!courseStructure || !courseStructure.modules) return null;
    let currentLessonFound = false;
    for (const module of courseStructure.modules) {
      for (const l of module.lessons) {
        if (currentLessonFound) return l; // This is the next lesson
        if (l.id === lessonId) currentLessonFound = true;
      }
    }
    return null; // No next lesson in the current module or course
  };
  
  const findPrevLesson = () => {
     if (!courseStructure || !courseStructure.modules) return null;
     let prevLesson = null;
     for (const module of courseStructure.modules) {
        for (const l of module.lessons) {
            if (l.id === lessonId) return prevLesson; // Current lesson found, return previous
            prevLesson = l;
        }
     }
     return null; // No previous lesson (current is likely the first)
  };


  const styles = { /* Basic styles */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    title: { fontSize: '1.8em' },
    courseLink: { fontSize: '0.9em', display: 'block', marginBottom: '10px' },
    contentArea: { marginTop: '20px', marginBottom: '30px', padding: '15px', background: '#f9f9f9', borderRadius: '5px', minHeight: '300px' },
    videoEmbed: { width: '100%', height: '450px' }, // Basic responsive iframe might need more
    actions: { marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    button: { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', textDecoration: 'none', cursor: 'pointer' },
    completeButton: { backgroundColor: '#28a745' },
    completedText: { color: 'green', fontWeight: 'bold'},
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em' },
  };

  if (authLoading || isLoading) {
    return <div style={styles.loading}>Loading lesson...</div>;
  }
  if (error) {
    return <div style={styles.error}>Error: {error} <Link to={`/learn/${courseId || ''}`}>Back to course</Link></div>;
  }
  if (!lesson) {
    return <div style={styles.loading}>Lesson not found. <Link to={`/learn/${courseId || ''}`}>Back to course</Link></div>;
  }

  const prevLesson = findPrevLesson();
  const nextLesson = findNextLesson();

  return (
    <div style={styles.container}>
      {courseStructure && (
        <Link to={`/learn/${courseId}`} style={styles.courseLink}>&larr; Back to {courseStructure.title || 'Course'}</Link>
      )}
      <div style={styles.header}>
        <h1 style={styles.title}>{lesson.title}</h1>
        <p style={{fontSize: '0.9em', color: '#555'}}>Type: {lesson.lesson_type} | Duration: {lesson.duration_minutes || 'N/A'} min</p>
      </div>

      <div style={styles.contentArea}>
        {lesson.lesson_type === 'video' && lesson.content_url && (
          <div>
            <h4>Video Content</h4>
            {/* Basic iframe embed, consider ReactPlayer for more robust solution */}
            {lesson.content_url.includes('vimeo.com') || lesson.content_url.includes('youtube.com') ? (
                 <iframe 
                    src={lesson.content_url.replace("vimeo.com/", "player.vimeo.com/video/").replace("youtube.com/watch?v=", "youtube.com/embed/")} 
                    style={styles.videoEmbed}
                    frameBorder="0" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowFullScreen
                    title={lesson.title}>
                </iframe>
            ) : (
                <p>Video link: <a href={lesson.content_url} target="_blank" rel="noopener noreferrer">{lesson.content_url}</a> (Consider using a video player component for direct embedding)</p>
            )}
          </div>
        )}
        {lesson.lesson_type === 'text' && lesson.text_content && (
          <div>
            <h4>Lesson Content</h4>
            {/* For Markdown: <div dangerouslySetInnerHTML={{ __html: marked(lesson.text_content) }} /> */}
            <div dangerouslySetInnerHTML={{ __html: lesson.text_content.replace(/\n/g, '<br />') }} />
          </div>
        )}
        {lesson.lesson_type === 'document' && lesson.content_url && (
          <div>
            <h4>Document</h4>
            <p><a href={lesson.content_url} target="_blank" rel="noopener noreferrer">View/Download Document</a></p>
          </div>
        )}
        {lesson.lesson_type === 'quiz' && (
          <div><h4>Quiz</h4><p>Quiz content and interaction will be implemented here.</p></div>
        )}
      </div>
      
      {completionError && <p style={{...styles.error, marginTop: '10px'}}>{completionError}</p>}

      <div style={styles.actions}>
        {prevLesson ? (
            <Link to={`/learn/${courseId}/lessons/${prevLesson.id}`} style={{...styles.button, backgroundColor: '#6c757d'}}>Previous Lesson</Link>
        ) : <div />} {/* Placeholder for layout */}
        
        {lesson.is_completed ? (
          <span style={styles.completedText}>Lesson Completed!</span>
        ) : (
          <button onClick={handleMarkAsComplete} disabled={isCompleting} style={{...styles.button, ...styles.completeButton}}>
            {isCompleting ? 'Completing...' : 'Mark as Complete'}
          </button>
        )}

        {nextLesson ? (
            <Link to={`/learn/${courseId}/lessons/${nextLesson.id}`} style={styles.button}>Next Lesson</Link>
        ) : <div />} {/* Placeholder for layout */}
      </div>
    </div>
  );
};

export default LessonView;
