import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../../utils/api';
import CourseForm from '../../../components/admin/courses/CourseForm'; 
import ModuleForm from '../../../components/admin/courses/ModuleForm'; 
import LessonForm from '../../../components/admin/courses/LessonForm'; // Import LessonForm

const AdminCourseEditPage = () => {
  const { courseId } = useParams(); 
  const navigate = useNavigate();
  const isEditingCourse = Boolean(courseId);

  // Course State
  const [initialCourseData, setInitialCourseData] = useState(null); 
  const [courseTitleForHeader, setCourseTitleForHeader] = useState(''); 
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false); 
  const [submitError, setSubmitError] = useState(null); 
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Modules State
  const [modules, setModules] = useState([]); 
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null); 
  const [isSubmittingModule, setIsSubmittingModule] = useState(false);
  const [moduleError, setModuleError] = useState(null);
  const [moduleSuccessMessage, setModuleSuccessMessage] = useState(null);

  // Lessons State
  const [selectedModule, setSelectedModule] = useState(null); // To hold the module whose lessons are being viewed/edited
  const [lessonsForSelectedModule, setLessonsForSelectedModule] = useState([]);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [isSubmittingLesson, setIsSubmittingLesson] = useState(false);
  const [lessonError, setLessonError] = useState(null);
  const [lessonSuccessMessage, setLessonSuccessMessage] = useState(null);
  
  // Common State
  const [categories, setCategories] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false); 
  const [error, setError] = useState(null); // General page load error

  const fetchCourseDataWithContent = useCallback(async () => {
    if (isEditingCourse) {
      setIsLoadingData(true);
      setError(null);
      try {
        const response = await apiClient.get(`/admin/courses/${courseId}`);
        const fetchedCourse = response.data;
        setInitialCourseData(fetchedCourse); 
        setCourseTitleForHeader(fetchedCourse.title);
        const courseModules = fetchedCourse.modules || [];
        setModules(courseModules);
        // If a module was selected, refresh its lessons too
        if (selectedModule) {
            const updatedSelectedModule = courseModules.find(m => m.id === selectedModule.id);
            if (updatedSelectedModule) {
                setLessonsForSelectedModule(updatedSelectedModule.lessons || []);
            } else {
                // Selected module might have been deleted, so clear selection
                setSelectedModule(null);
                setLessonsForSelectedModule([]);
            }
        }
      } catch (err) {
        console.error("Failed to fetch course details:", err);
        setError(err.response?.data?.message || 'Failed to load course data.');
      } finally {
        setIsLoadingData(false);
      }
    }
  }, [isEditingCourse, courseId, selectedModule]); // Added selectedModule to deps

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/catalog/categories'); 
      setCategories(response.data || []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } 
  }, []);
  
  useEffect(() => {
    fetchCategories();
    if (isEditingCourse) {
      fetchCourseDataWithContent();
    } else {
      setInitialCourseData({
        title: '', description: '', instructor_id: '', category_id: '',
        product_id: '', level: '', duration_estimate: '', cover_image_url: '',
        is_published: false,
      });
      setCourseTitleForHeader('New Course');
      setModules([]);
      setLessonsForSelectedModule([]);
    }
  }, [isEditingCourse, fetchCourseDataWithContent, fetchCategories]);

  const handleSaveCourse = async (formData) => {
    setIsSubmittingCourse(true); setSubmitError(null); setSuccessMessage(null);
    const payload = { ...formData };
    if (payload.category_id === '') payload.category_id = null;
    if (payload.product_id === '') payload.product_id = null;
    if (!isEditingCourse) delete payload.slug; 

    try {
      let response;
      if (isEditingCourse) {
        response = await apiClient.put(`/admin/courses/${courseId}`, payload);
        setSuccessMessage('Course updated successfully!');
        setInitialCourseData(response.data.course); 
        setCourseTitleForHeader(response.data.course.title);
      } else {
        response = await apiClient.post('/admin/courses', payload);
        setSuccessMessage('Course created successfully! You can now add modules and lessons.');
        navigate(`/admin/courses/${response.data.course.id}/edit`, { replace: true });
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to save course.');
    } finally {
      setIsSubmittingCourse(false);
    }
  };

  // --- Module Management ---
  const handleAddNewModule = () => { setEditingModule(null); setShowModuleForm(true); setModuleError(null); setModuleSuccessMessage(null); };
  const handleEditModule = (module) => { setEditingModule(module); setShowModuleForm(true); setModuleError(null); setModuleSuccessMessage(null);};
  const handleSaveModule = async (moduleFormData) => {
    setIsSubmittingModule(true); setModuleError(null); setModuleSuccessMessage(null);
    try {
      if (editingModule && editingModule.id) { 
        await apiClient.put(`/admin/courses/${courseId}/modules/${editingModule.id}`, moduleFormData);
        setModuleSuccessMessage('Module updated successfully!');
      } else { 
        await apiClient.post(`/admin/courses/${courseId}/modules`, moduleFormData);
        setModuleSuccessMessage('Module created successfully!');
      }
      setShowModuleForm(false); setEditingModule(null); fetchCourseDataWithContent(); 
    } catch (err) {
      setModuleError(err.response?.data?.message || 'Failed to save module.');
    } finally {
      setIsSubmittingModule(false);
    }
  };
  const handleDeleteModule = async (moduleId, moduleTitle) => {
    if (window.confirm(`Delete module "${moduleTitle}"? This deletes all its lessons.`)) {
      setIsSubmittingModule(true); setModuleError(null); setModuleSuccessMessage(null);
      try {
        await apiClient.delete(`/admin/courses/${courseId}/modules/${moduleId}`);
        setModuleSuccessMessage(`Module "${moduleTitle}" deleted.`);
        if(selectedModule && selectedModule.id === moduleId) { // Clear lesson view if deleted module was selected
            setSelectedModule(null);
            setLessonsForSelectedModule([]);
        }
        fetchCourseDataWithContent(); 
      } catch (err) {
        setModuleError(err.response?.data?.message || `Failed to delete module.`);
      } finally {
        setIsSubmittingModule(false);
      }
    }
  };
  const handleCancelModuleForm = () => { setShowModuleForm(false); setEditingModule(null); setModuleError(null);};

  // --- Lesson Management ---
  const handleSelectModuleForLessons = (module) => {
    setSelectedModule(module);
    setLessonsForSelectedModule(module.lessons || []);
    setShowLessonForm(false); // Hide lesson form when changing module
    setEditingLesson(null);
    setLessonError(null);
    setLessonSuccessMessage(null);
  };
  const handleAddNewLesson = () => { setEditingLesson(null); setShowLessonForm(true); setLessonError(null); setLessonSuccessMessage(null);};
  const handleEditLesson = (lesson) => { setEditingLesson(lesson); setShowLessonForm(true); setLessonError(null); setLessonSuccessMessage(null);};
  const handleSaveLesson = async (lessonFormData) => {
    if (!selectedModule) { setLessonError("No module selected to add lesson to."); return; }
    setIsSubmittingLesson(true); setLessonError(null); setLessonSuccessMessage(null);
    try {
      const apiUrl = `/admin/courses/${courseId}/modules/${selectedModule.id}/lessons`;
      if (editingLesson && editingLesson.id) {
        await apiClient.put(`${apiUrl}/${editingLesson.id}`, lessonFormData);
        setLessonSuccessMessage('Lesson updated successfully!');
      } else {
        await apiClient.post(apiUrl, lessonFormData);
        setLessonSuccessMessage('Lesson created successfully!');
      }
      setShowLessonForm(false); setEditingLesson(null); fetchCourseDataWithContent(); // Re-fetch all data to update lessons
    } catch (err) {
      setLessonError(err.response?.data?.message || 'Failed to save lesson.');
    } finally {
      setIsSubmittingLesson(false);
    }
  };
  const handleDeleteLesson = async (lessonId, lessonTitle) => {
    if (!selectedModule) return;
    if (window.confirm(`Delete lesson "${lessonTitle}"?`)) {
      setIsSubmittingLesson(true); setLessonError(null); setLessonSuccessMessage(null);
      try {
        await apiClient.delete(`/admin/courses/${courseId}/modules/${selectedModule.id}/lessons/${lessonId}`);
        setLessonSuccessMessage(`Lesson "${lessonTitle}" deleted.`);
        fetchCourseDataWithContent(); 
      } catch (err) {
        setLessonError(err.response?.data?.message || `Failed to delete lesson.`);
      } finally {
        setIsSubmittingLesson(false);
      }
    }
  };
  const handleCancelLessonForm = () => { setShowLessonForm(false); setEditingLesson(null); setLessonError(null);};
  
  const styles = { /* Styles from previous step, ensure they are complete */
    container: { padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' },
    header: { marginBottom: '20px', fontSize: '1.8em' },
    error: { color: 'red', backgroundColor: '#ffe0e0', padding: '10px', borderRadius: '5px', margin: '10px 0'},
    success: { color: 'green', backgroundColor: '#e0ffe0', padding: '10px', borderRadius: '5px', margin: '10px 0'},
    loading: { textAlign: 'center', padding: '20px', fontSize: '1.2em' },
    sectionTitle: { marginTop: '30px', marginBottom: '15px', borderBottom: '1px solid #ccc', paddingBottom: '10px', fontSize: '1.5em' },
    itemList: { listStyle: 'none', paddingLeft: 0 },
    item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', backgroundColor: '#fff', borderRadius: '4px', marginBottom: '8px' },
    actionButton: { marginRight: '10px', padding: '6px 10px', fontSize: '0.9em', cursor: 'pointer', border: 'none', borderRadius: '4px' },
    editButton: { backgroundColor: '#ffc107', color: '#212529'},
    deleteButton: { backgroundColor: '#dc3545', color: 'white'},
    addButton: { padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1em', marginBottom: '15px' },
    moduleItem: { /* existing item style */ },
    selectedModule: { backgroundColor: '#e7f3ff' /* Highlight selected module */ },
    lessonItem: { marginLeft: '20px', /* Indent lessons */ }
  };

  if (isLoadingData && isEditingCourse && !initialCourseData) return <div style={styles.loading}>Loading course details...</div>;
  if (error) return <div style={styles.error}>Error fetching data: {error} <Link to="/admin/courses">Back to Courses</Link></div>;

  return (
    <div style={styles.container}>
      <Link to="/admin/courses" style={{display: 'inline-block', marginBottom: '20px'}}>&larr; Back to Course List</Link>
      <h1 style={styles.header}>{isEditingCourse ? `Edit Course: ${courseTitleForHeader}` : 'Create New Course'}</h1>

      {submitError && <div style={styles.error}>{submitError}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {(initialCourseData || !isEditingCourse) && ( 
        <CourseForm initialData={initialCourseData || {is_published: false}} categories={categories} onSubmit={handleSaveCourse} isSubmitting={isSubmittingCourse} />
      )}
      
      {isEditingCourse && courseId && initialCourseData && (
        <>
          {/* --- Module Management --- */}
          <div style={styles.sectionTitle}>Manage Modules</div>
          {moduleError && <div style={styles.error}>{moduleError}</div>}
          {moduleSuccessMessage && <div style={styles.success}>{moduleSuccessMessage}</div>}
          {!showModuleForm && <button onClick={handleAddNewModule} style={styles.addButton} disabled={isSubmittingModule}>Add New Module</button>}
          {showModuleForm && <ModuleForm courseId={courseId} moduleData={editingModule} onSave={handleSaveModule} onCancel={handleCancelModuleForm} isProcessing={isSubmittingModule}/>}
          {modules.length > 0 ? (
            <ul style={styles.itemList}>
              {modules.map(module => (
                <li key={module.id} style={{...styles.item, ...(selectedModule?.id === module.id && styles.selectedModule)}} onClick={() => handleSelectModuleForLessons(module)}>
                  <span>{module.module_order}. {module.title}</span>
                  <div>
                    <button onClick={(e) => { e.stopPropagation(); handleEditModule(module);}} style={{...styles.actionButton, ...styles.editButton}} disabled={isSubmittingModule || showModuleForm}>Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteModule(module.id, module.title);}} style={{...styles.actionButton, ...styles.deleteButton}} disabled={isSubmittingModule || showModuleForm}>Delete</button>
                  </div>
                </li>))}
            </ul>
          ) : (!showModuleForm && <p>No modules created yet.</p>)}
          
          {/* --- Lesson Management (for selected module) --- */}
          {selectedModule && (
            <div style={{marginTop: '20px', paddingLeft: '20px', borderLeft: '3px solid #007bff'}}>
              <h3 style={{fontSize: '1.3em'}}>Lessons for: "{selectedModule.title}"</h3>
              {lessonError && <div style={styles.error}>{lessonError}</div>}
              {lessonSuccessMessage && <div style={styles.success}>{lessonSuccessMessage}</div>}
              {!showLessonForm && <button onClick={handleAddNewLesson} style={{...styles.addButton, fontSize: '0.9em'}} disabled={isSubmittingLesson}>Add New Lesson to "{selectedModule.title}"</button>}
              {showLessonForm && <LessonForm courseId={courseId} moduleId={selectedModule.id} lessonData={editingLesson} onSave={handleSaveLesson} onCancel={handleCancelLessonForm} isProcessing={isSubmittingLesson}/>}
              {lessonsForSelectedModule.length > 0 ? (
                <ul style={styles.itemList}>
                  {lessonsForSelectedModule.map(lesson => (
                    <li key={lesson.id} style={{...styles.item, ...styles.lessonItem}}>
                      <span>{lesson.lesson_order}. {lesson.title} ({lesson.lesson_type}) {lesson.is_preview_allowed ? '(Preview)' : ''}</span>
                      <div>
                        <button onClick={() => handleEditLesson(lesson)} style={{...styles.actionButton, ...styles.editButton, fontSize: '0.8em'}} disabled={isSubmittingLesson || showLessonForm}>Edit</button>
                        <button onClick={() => handleDeleteLesson(lesson.id, lesson.title)} style={{...styles.actionButton, ...styles.deleteButton, fontSize: '0.8em'}} disabled={isSubmittingLesson || showLessonForm}>Delete</button>
                      </div>
                    </li>))}
                </ul>
              ) : (!showLessonForm && <p>No lessons created yet for this module.</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminCourseEditPage;
