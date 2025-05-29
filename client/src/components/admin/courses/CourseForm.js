import React, { useState, useEffect } from 'react';

const CourseForm = ({ initialData, categories = [], onSubmit, isSubmitting, formErrors = {} }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructor_id: '', 
    category_id: '',   
    product_id: '',    
    level: '',
    duration_estimate: '',
    cover_image_url: '',
    is_published: false,
    slug: '', // Display only, not typically editable by user directly
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        instructor_id: initialData.instructor_id || '',
        category_id: initialData.category_id || '',
        product_id: initialData.product_id || '',
        level: initialData.level || '',
        duration_estimate: initialData.duration_estimate || '',
        cover_image_url: initialData.cover_image_url || '',
        is_published: initialData.is_published || false,
        slug: initialData.slug || '', // Used for display in edit mode
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic client-side validation can be added here before calling onSubmit
    // For MVP, assuming onSubmit (in AdminCourseEditPage) will handle more complex validation or rely on backend
    onSubmit(formData); 
  };

  const styles = {
    formSection: { padding: '20px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    textarea: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '100px', boxSizing: 'border-box' },
    select: { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    checkboxContainer: { display: 'flex', alignItems: 'center', marginTop: '10px' },
    checkboxInput: { marginRight: '10px', width: 'auto' },
    button: { padding: '12px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem' },
    disabledButton: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    errorText: { color: 'red', fontSize: '0.8em', marginTop: '4px' }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.formSection}>
      <h2 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>
        {initialData && initialData.id ? 'Edit Course Details' : 'Create New Course'}
      </h2>

      <div style={styles.formGroup}>
        <label htmlFor="title" style={styles.label}>Title <span style={{color: 'red'}}>*</span></label>
        <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} style={styles.input} required disabled={isSubmitting} />
        {formErrors.title && <p style={styles.errorText}>{formErrors.title}</p>}
      </div>

      {initialData && initialData.slug && ( // Display slug only if it exists (edit mode)
        <div style={styles.formGroup}>
          <label htmlFor="slug" style={styles.label}>Slug (URL)</label>
          <input type="text" name="slug" id="slug" value={formData.slug} style={styles.input} readOnly disabled />
        </div>
      )}

      <div style={styles.formGroup}>
        <label htmlFor="description" style={styles.label}>Description</label>
        <textarea name="description" id="description" value={formData.description} onChange={handleChange} style={styles.textarea} disabled={isSubmitting}></textarea>
        {formErrors.description && <p style={styles.errorText}>{formErrors.description}</p>}
      </div>
      
      <div style={styles.formGroup}>
          <label htmlFor="instructor_id" style={styles.label}>Instructor ID (UUID) <span style={{color: 'red'}}>*</span></label>
          {/* In a real app, this would be a dropdown of users with 'instructor' role for Admins.
              If the current user is an instructor, this might be auto-filled and read-only.
              For MVP, simple text input. Backend will validate role/ownership. */}
          <input 
            type="text" 
            name="instructor_id" 
            id="instructor_id" 
            value={formData.instructor_id} 
            onChange={handleChange} 
            style={styles.input} 
            placeholder="Enter instructor's user ID" 
            required 
            disabled={isSubmitting} 
          />
          {formErrors.instructor_id && <p style={styles.errorText}>{formErrors.instructor_id}</p>}
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="category_id" style={styles.label}>Category</label>
        <select name="category_id" id="category_id" value={formData.category_id} onChange={handleChange} style={styles.select} disabled={isSubmitting}>
          <option value="">-- Select Category --</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {formErrors.category_id && <p style={styles.errorText}>{formErrors.category_id}</p>}
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="product_id" style={styles.label}>Linked Product ID (Optional)</label>
        <input type="text" name="product_id" id="product_id" value={formData.product_id} onChange={handleChange} style={styles.input} placeholder="UUID of an existing product if paid" disabled={isSubmitting} />
        {formErrors.product_id && <p style={styles.errorText}>{formErrors.product_id}</p>}
      </div>

      <div style={{display: 'flex', gap: '20px'}}>
        <div style={{...styles.formGroup, flex: 1}}>
            <label htmlFor="level" style={styles.label}>Level</label>
            <input type="text" name="level" id="level" value={formData.level} onChange={handleChange} style={styles.input} placeholder="e.g., Beginner, Intermediate" disabled={isSubmitting} />
            {formErrors.level && <p style={styles.errorText}>{formErrors.level}</p>}
        </div>
        <div style={{...styles.formGroup, flex: 1}}>
            <label htmlFor="duration_estimate" style={styles.label}>Duration Estimate</label>
            <input type="text" name="duration_estimate" id="duration_estimate" value={formData.duration_estimate} onChange={handleChange} style={styles.input} placeholder="e.g., Approx. 10 hours" disabled={isSubmitting} />
            {formErrors.duration_estimate && <p style={styles.errorText}>{formErrors.duration_estimate}</p>}
        </div>
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="cover_image_url" style={styles.label}>Cover Image URL (Optional)</label>
        <input type="url" name="cover_image_url" id="cover_image_url" value={formData.cover_image_url} onChange={handleChange} style={styles.input} placeholder="https://example.com/image.jpg" disabled={isSubmitting} />
        {formErrors.cover_image_url && <p style={styles.errorText}>{formErrors.cover_image_url}</p>}
      </div>

      <div style={{...styles.formGroup, ...styles.checkboxContainer}}>
        <input type="checkbox" name="is_published" id="is_published" checked={formData.is_published} onChange={handleChange} style={styles.checkboxInput} disabled={isSubmitting} />
        <label htmlFor="is_published" style={styles.label}>Published</label>
      </div>
      {formErrors.is_published && <p style={styles.errorText}>{formErrors.is_published}</p>}

      <button type="submit" disabled={isSubmitting} style={isSubmitting ? {...styles.button, ...styles.disabledButton} : styles.button}>
        {isSubmitting ? 'Saving...' : (initialData && initialData.id ? 'Update Course' : 'Create Course')}
      </button>
    </form>
  );
};

export default CourseForm;
