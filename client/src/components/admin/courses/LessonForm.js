import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/api';

// Props: courseId, moduleId, lessonData (for edit), onSave, onCancel
const LessonForm = ({ courseId, moduleId, lessonData, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [lessonType, setLessonType] = useState('text'); // Default type
  const [contentUrl, setContentUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [lessonOrder, setLessonOrder] = useState('');
  const [isPreviewAllowed, setIsPreviewAllowed] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(lessonData && lessonData.id);
  const lessonTypes = ['video', 'text', 'quiz', 'document']; // Should match ENUM in backend

  useEffect(() => {
    if (isEditing && lessonData) {
      setTitle(lessonData.title || '');
      setLessonType(lessonData.lesson_type || 'text');
      setContentUrl(lessonData.content_url || '');
      setTextContent(lessonData.text_content || '');
      setDurationMinutes(lessonData.duration_minutes !== undefined ? String(lessonData.duration_minutes) : '');
      setLessonOrder(lessonData.lesson_order !== undefined ? String(lessonData.lesson_order) : '');
      setIsPreviewAllowed(lessonData.is_preview_allowed || false);
    } else {
      // Reset for new lesson form
      setTitle('');
      setLessonType('text');
      setContentUrl('');
      setTextContent('');
      setDurationMinutes('');
      setLessonOrder('');
      setIsPreviewAllowed(false);
    }
  }, [lessonData, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!title.trim()) {
        setError("Lesson title is required.");
        setIsLoading(false);
        return;
    }
    if (!lessonType) {
        setError("Lesson type is required.");
        setIsLoading(false);
        return;
    }
    // Basic validation for content based on type
    if ((lessonType === 'video' || lessonType === 'document') && !contentUrl.trim()) {
        // setError(`Content URL is required for ${lessonType} lessons.`);
        // setIsLoading(false);
        // return; 
        // Making it optional for now at form level, backend might have stricter rules
    }
    if (lessonType === 'text' && !textContent.trim()) {
        // setError(`Text content is required for text lessons.`);
        // setIsLoading(false);
        // return;
    }


    const payload = {
      title,
      lesson_type: lessonType,
      content_url: (lessonType === 'video' || lessonType === 'document') ? contentUrl : null,
      text_content: lessonType === 'text' ? textContent : null,
      // quiz_data: lessonType === 'quiz' ? quizData : null, // Placeholder for quiz
      is_preview_allowed: isPreviewAllowed,
      ...(durationMinutes.trim() !== '' && !isNaN(parseInt(durationMinutes)) && { duration_minutes: parseInt(durationMinutes) }),
      ...(lessonOrder.trim() !== '' && !isNaN(parseInt(lessonOrder)) && { lesson_order: parseInt(lessonOrder) }),
    };
    
    try {
      let response;
      const apiUrl = `/admin/courses/${courseId}/modules/${moduleId}/lessons`;
      if (isEditing) {
        response = await apiClient.put(`${apiUrl}/${lessonData.id}`, payload);
      } else {
        response = await apiClient.post(apiUrl, payload);
      }
      onSave(response.data.lesson || response.data); // Pass back the saved/created lesson
    } catch (err) {
      console.error("Failed to save lesson:", err);
      setError(err.response?.data?.message || `Failed to save lesson.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const styles = { /* Same styles as ModuleForm, or from a shared const */ 
    formContainer: { padding: '20px', border: '1px dashed #ccc', borderRadius: '8px', marginTop: '15px', backgroundColor: '#fdfdfd' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    select: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    textarea: { width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '100px' },
    checkboxLabel: { marginLeft: '5px' },
    button: { padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' },
    error: { color: 'red', fontSize: '0.9em', marginTop: '5px'},
  };

  return (
    <div style={styles.formContainer}>
      <h3 style={{marginTop: 0}}>{isEditing ? 'Edit Lesson' : 'Add New Lesson'}</h3>
      {error && <p style={styles.error}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label htmlFor="lessonTitle" style={styles.label}>Title</label>
          <input type="text" id="lessonTitle" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} required disabled={isLoading} />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="lessonType" style={styles.label}>Lesson Type</label>
          <select id="lessonType" value={lessonType} onChange={(e) => setLessonType(e.target.value)} style={styles.select} disabled={isLoading}>
            {lessonTypes.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
          </select>
        </div>

        {(lessonType === 'video' || lessonType === 'document') && (
          <div style={styles.formGroup}>
            <label htmlFor="contentUrl" style={styles.label}>Content URL (for Video/Document)</label>
            <input type="url" id="contentUrl" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} style={styles.input} placeholder="https://example.com/video_or_doc" disabled={isLoading} />
          </div>
        )}

        {lessonType === 'text' && (
          <div style={styles.formGroup}>
            <label htmlFor="textContent" style={styles.label}>Text Content (Markdown or HTML)</label>
            <textarea id="textContent" value={textContent} onChange={(e) => setTextContent(e.target.value)} style={styles.textarea} rows="8" disabled={isLoading}></textarea>
          </div>
        )}
        
        {lessonType === 'quiz' && (
            <div style={styles.formGroup}><p><em>Quiz creation/management UI TBD. For now, save lesson type as 'quiz'.</em></p></div>
        )}


        <div style={styles.formGroup}>
          <label htmlFor="durationMinutes" style={styles.label}>Duration (Minutes, Optional)</label>
          <input type="number" id="durationMinutes" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={styles.input} placeholder="e.g., 10" disabled={isLoading} />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="lessonOrder" style={styles.label}>Order (Optional - e.g., 1, 2, 3)</label>
          <input type="number" id="lessonOrder" value={lessonOrder} onChange={(e) => setLessonOrder(e.target.value)} style={styles.input} placeholder="Leave blank for auto-order" disabled={isLoading} />
        </div>

        <div style={styles.formGroup}>
          <input type="checkbox" id="isPreviewAllowed" checked={isPreviewAllowed} onChange={(e) => setIsPreviewAllowed(e.target.checked)} disabled={isLoading} />
          <label htmlFor="isPreviewAllowed" style={styles.checkboxLabel}>Allow Preview (for non-enrolled users)</label>
        </div>
        
        <div>
          <button type="submit" disabled={isLoading} style={styles.button}>
            {isLoading ? 'Saving...' : (isEditing ? 'Update Lesson' : 'Create Lesson')}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isLoading} style={{...styles.button, backgroundColor: '#6c757d'}}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default LessonForm;
