import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/api';

// This form can be used for creating or editing a module.
// If 'moduleData' prop is provided, it's in edit mode.
// 'courseId' is required to associate the module with its course.
// 'onSave' callback is called after successful save.
// 'onCancel' callback to close/hide the form.
const ModuleForm = ({ courseId, moduleData, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleOrder, setModuleOrder] = useState(''); // Backend might auto-assign if not provided for new
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(moduleData && moduleData.id);

  useEffect(() => {
    if (isEditing) {
      setTitle(moduleData.title || '');
      setDescription(moduleData.description || '');
      setModuleOrder(moduleData.module_order !== undefined ? String(moduleData.module_order) : '');
    } else {
      // Reset for new module form
      setTitle('');
      setDescription('');
      setModuleOrder(''); // Or fetch next available order number
    }
  }, [moduleData, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!title.trim()) {
        setError("Module title is required.");
        setIsLoading(false);
        return;
    }
    
    const payload = {
      title,
      description,
      // Only include module_order if it's explicitly set and valid
      ...(moduleOrder.trim() !== '' && !isNaN(parseInt(moduleOrder)) && { module_order: parseInt(moduleOrder) })
    };

    try {
      let response;
      if (isEditing) {
        response = await apiClient.put(`/admin/courses/${courseId}/modules/${moduleData.id}`, payload);
      } else {
        response = await apiClient.post(`/admin/courses/${courseId}/modules`, payload);
      }
      onSave(response.data.module || response.data); // Pass back the saved/created module
    } catch (err) {
      console.error("Failed to save module:", err);
      setError(err.response?.data?.message || `Failed to save module.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const styles = {
    formContainer: { padding: '20px', border: '1px dashed #ccc', borderRadius: '8px', marginTop: '15px', backgroundColor: '#fdfdfd' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    textarea: { width: 'calc(100% - 18px)', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px' },
    button: { padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' },
    error: { color: 'red', fontSize: '0.9em', marginTop: '5px'},
  };


  return (
    <div style={styles.formContainer}>
      <h3 style={{marginTop:0}}>{isEditing ? 'Edit Module' : 'Add New Module'}</h3>
      {error && <p style={styles.error}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label htmlFor="moduleTitle" style={styles.label}>Title</label>
          <input
            type="text"
            id="moduleTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            required
            disabled={isLoading}
          />
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="moduleDescription" style={styles.label}>Description (Optional)</label>
          <textarea
            id="moduleDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            disabled={isLoading}
          />
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="moduleOrder" style={styles.label}>Order (Optional - e.g., 1, 2, 3)</label>
          <input
            type="number"
            id="moduleOrder"
            value={moduleOrder}
            onChange={(e) => setModuleOrder(e.target.value)}
            style={styles.input}
            placeholder="Leave blank for auto-order"
            disabled={isLoading}
          />
        </div>
        <div>
          <button type="submit" disabled={isLoading} style={styles.button}>
            {isLoading ? 'Saving...' : (isEditing ? 'Update Module' : 'Create Module')}
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

export default ModuleForm;
