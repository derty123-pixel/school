import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Assuming AuthContext

// Placeholder for AuthContext if not fully implemented
// const useAuth = () => ({ user: { id: 'test-user-id' }, isAuthenticated: true, isLoading: false }); 

// --- Optional: Add these to package.json if you want richer rendering ---
// For video: npm install react-player
// import ReactPlayer from 'react-player/lazy';
// For markdown: npm install react-markdown
// import ReactMarkdown from 'react-markdown';

const LessonView = () => {
  const { courseId, lessonId } = useParams();
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [courseStructure, setCourseStructure] = useState(null); // Full course with modules and lessons list
  
  const [isLoadingLesson, setIsLoadingLesson] = useState(true);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [error, setError] = useState(null);
  
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(null);
  // isCompleted status for the current lesson will be derived from courseStructure or lesson itself
  const [isCurrentLessonCompleted, setIsCurrentLessonCompleted] = useState(false);


  const fetchCourseStructureAndLesson = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingStructure(true);
    setIsLoadingLesson(true); // Combined loading initially
    setError(null);
    setCompletionError(null);

    try {
      // Fetch full course structure first (includes all lessons with their completion status for this user)
      const courseResponse = await apiClient.get(`/courses/enrolled/${courseId}`);
      setCourseStructure(courseResponse.data);

      // Find the current lesson within the fetched structure to get its details and completion status
      let currentLessonData = null;
      let found = false;
      for (const module of courseResponse.data.modules) {
        for (const l of module.lessons) {
          if (l.id === lessonId) {
            currentLessonData = l; // This lesson from structure already has 'is_completed'
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      if (currentLessonData) {
        // Now fetch the detailed content for this specific lesson (e.g., full text_content)
        // The backend /lessons/:lessonId endpoint updates last_accessed_lesson_id
        const lessonContentResponse = await apiClient.get(`/courses/enrolled/${courseId}/lessons/${lessonId}`);
        // Merge detailed content into the lesson data we found in the structure
        setLesson({ ...currentLessonData, ...lessonContentResponse.data });
        setIsCurrentLessonCompleted(currentLessonData.is_completed || false);
      } else {
        throw new Error("Lesson not found in course structure.");
      }

    } catch (err) {
      console.error(`Failed to fetch course/lesson data (C:${courseId}, L:${lessonId}):`, err);
      setError(err.response?.data?.message || 'Failed to load content. You might not be enrolled or the content is unavailable.');
    } finally {
      setIsLoadingStructure(false);
      setIsLoadingLesson(false);
    }
  }, [courseId, lessonId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && !authIsLoading) {
      fetchCourseStructureAndLesson();
    } else if (!isAuthenticated && !authIsLoading) {
        navigate('/login', { state: { from: `/learn/${courseId}/lessons/${lessonId}` } });
    }
  }, [isAuthenticated, authIsLoading, fetchCourseStructureAndLesson, courseId, lessonId, navigate]);


  const handleMarkAsComplete = async () => {
    if (!lesson || isCurrentLessonCompleted) return;
    setIsCompleting(true);
    setCompletionError(null);
    try {
      const response = await apiClient.post(`/courses/enrolled/${courseId}/lessons/${lessonId}/complete`);
      setIsCurrentLessonCompleted(true);
      
      // Update progress in courseStructure locally for immediate feedback if possible
      // This is a bit complex without a proper state management for course progress across components
      if (courseStructure) {
        const updatedModules = courseStructure.modules.map(m => ({
            ...m,
            lessons: m.lessons.map(l => l.id === lessonId ? {...l, is_completed: true} : l)
        }));
        const newCourseStructure = {...courseStructure, modules: updatedModules, enrollment_details: {
            ...courseStructure.enrollment_details,
            progress_percent: response.data.progress_percent, // from API response
            completed_at: response.data.course_completed_at, // from API response
        }};
        setCourseStructure(newCourseStructure);
        // If current lesson is also updated from a detailed fetch, update it too
        setLesson(prev => ({...prev, is_completed: true}));
      }
      
      alert(`Lesson marked as complete! Course Progress: ${response.data.progress_percent}%`);

      // Auto-navigate to next lesson
      const next = findNextLesson(); // Use memoized version
      if (next) {
        navigate(`/learn/${courseId}/lessons/${next.id}`);
      } else {
        alert("Congratulations! You've completed all lessons in this course!");
        // navigate(`/learn/${courseId}`); // Or to "My Courses"
      }
    } catch (err) {
      console.error("Failed to mark lesson as complete:", err);
      setCompletionError(err.response?.data?.message || 'Failed to mark lesson as complete.');
    } finally {
      setIsCompleting(false);
    }
  };
  
  const { prevLesson, nextLesson } = useMemo(() => {
    if (!courseStructure || !courseStructure.modules || !lessonId) return { prevLesson: null, nextLesson: null };
    
    const allLessonsFlat = courseStructure.modules.flatMap(module => module.lessons);
    const currentIndex = allLessonsFlat.findIndex(l => l.id === lessonId);

    if (currentIndex === -1) return { prevLesson: null, nextLesson: null };

    return {
        prevLesson: currentIndex > 0 ? allLessonsFlat[currentIndex - 1] : null,
        nextLesson: currentIndex < allLessonsFlat.length - 1 ? allLessonsFlat[currentIndex + 1] : null,
    };
  }, [courseStructure, lessonId]);


  const styles = { /* Basic styles from previous step */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    title: { fontSize: '1.8em', color: '#333' },
    courseLink: { fontSize: '0.9em', display: 'block', marginBottom: '10px', color: '#007bff', textDecoration: 'none' },
    contentArea: { marginTop: '20px', marginBottom: '30px', padding: '20px', background: '#fff', borderRadius: '5px', minHeight: '300px', border: '1px solid #e7e7e7', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    videoEmbedContainer: { position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%', background: '#000' },
    videoEmbed: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    textContent: { lineHeight: '1.7', whiteSpace: 'pre-wrap' /* Preserve line breaks from simple text */ },
    actions: { marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderTop: '1px solid #eee' },
    button: { padding: '10px 20px', textDecoration: 'none', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1em' },
    navButton: { backgroundColor: '#6c757d', color: 'white'},
    completeButton: { backgroundColor: '#28a745', color: 'white' },
    completedText: { color: 'green', fontWeight: 'bold', fontSize: '1em'},
    disabledButton: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', textAlign: 'center', margin: '15px 0'},
    loading: { textAlign: 'center', padding: '50px', fontSize: '1.5em', color: '#6c757d' },
  };

  if (authIsLoading || isLoadingLesson || isLoadingStructure) {
    return <div style={styles.loading}>Loading lesson content...</div>;
  }
  if (error) {
    return <div style={styles.error}>Error: {error} <Link to={courseStructure ? `/learn/${courseId}` : '/my-courses'}>Back to {courseStructure ? courseStructure.title : 'My Courses'}</Link></div>;
  }
  if (!lesson || !courseStructure) {
    return <div style={styles.loading}>Lesson or course data not found. <Link to="/my-courses">Back to My Courses</Link></div>;
  }

  return (
    <div style={styles.container}>
      <Link to={`/learn/${courseId}`} style={styles.courseLink}>&larr; Back to "{courseStructure.title}" Overview</Link>
      <div style={styles.header}>
        <h1 style={styles.title}>{lesson.title}</h1>
        <p style={{fontSize: '0.9em', color: '#555'}}>Type: {lesson.lesson_type} | Duration: {lesson.duration_minutes || 'N/A'} min</p>
      </div>

      <div style={styles.contentArea}>
        {lesson.lesson_type === 'video' && lesson.content_url && (
          <div style={styles.videoEmbedContainer}>
            {/* Basic iframe embed, consider ReactPlayer for more robust solution for various URLs */}
            {(lesson.content_url.includes('vimeo.com') || lesson.content_url.includes('youtube.com/embed') || lesson.content_url.includes('youtube.com/watch')) ? (
                 <iframe 
                    src={lesson.content_url
                        .replace("vimeo.com/", "player.vimeo.com/video/")
                        .replace("youtube.com/watch?v=", "youtube.com/embed/")} 
                    style={styles.videoEmbed}
                    frameBorder="0" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowFullScreen
                    title={lesson.title}>
                </iframe>
            ) : (
                <p>Video link: <a href={lesson.content_url} target="_blank" rel="noopener noreferrer">{lesson.content_url}</a> (Direct embedding for this URL type is not set up. Use ReactPlayer for wider support.)</p>
            )}
          </div>
        )}
        {lesson.lesson_type === 'text' && (
          <div>
            {/* If text_content is HTML: */}
            <div style={styles.textContent} dangerouslySetInnerHTML={{ __html: lesson.text_content || '<p>No text content available.</p>' }} />
            {/* If text_content is Markdown (requires react-markdown or similar): */}
            {/* <ReactMarkdown>{lesson.text_content || '*No text content available.*'}</ReactMarkdown> */}
          </div>
        )}
        {lesson.lesson_type === 'document' && lesson.content_url && (
          <div>
            <h4>Document</h4>
            <p><a href={lesson.content_url} target="_blank" rel="noopener noreferrer" style={{...styles.button, backgroundColor: '#17a2b8'}}>View/Download Document</a></p>
          </div>
        )}
        {lesson.lesson_type === 'quiz' && (
          <div><h4>Quiz</h4><p>Quiz functionality and content will be displayed here. (Coming Soon!)</p></div>
        )}
      </div>
      
      {completionError && <p style={{...styles.error, marginTop: '10px'}}>{completionError}</p>}

      <div style={styles.actions}>
        {prevLesson ? (
            <Link to={`/learn/${courseId}/lessons/${prevLesson.id}`} style={{...styles.button, ...styles.navButton}}>Previous Lesson</Link>
        ) : <div style={{minWidth: '150px'}} />} {/* Placeholder for layout balance */}
        
        {isCurrentLessonCompleted ? (
          <span style={styles.completedText}>Lesson Completed! ✔</span>
        ) : (
          <button 
            onClick={handleMarkAsComplete} 
            disabled={isCompleting} 
            style={isCompleting ? {...styles.button, ...styles.completeButton, ...styles.disabledButton} : {...styles.button, ...styles.completeButton}}
          >
            {isCompleting ? 'Completing...' : 'Mark as Complete'}
          </button>
        )}

        {nextLesson ? (
            <Link to={`/learn/${courseId}/lessons/${nextLesson.id}`} style={{...styles.button, ...styles.navButton}}>Next Lesson</Link>
        ) : <div style={{minWidth: '150px'}} />} {/* Placeholder for layout balance */}
      </div>
    </div>
  );
};

export default LessonView;
