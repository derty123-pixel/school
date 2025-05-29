import React, { useState, useEffect } from 'react';

// This form can be used for creating or editing a module.
// If 'moduleData' prop is provided, it's in edit mode.
// 'onSave' callback is called with the form data when submitted.
// 'onCancel' callback to close/hide the form.
// 'isProcessing' prop to disable form elements during submission.
const ModuleForm = ({ moduleData, onSave, onCancel, isProcessing = false }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleOrder, setModuleOrder] = useState(''); 
  const [formError, setFormError] = useState('');

  const isEditing = Boolean(moduleData && moduleData.id);

  useEffect(() => {
    if (isEditing && moduleData) {
      setTitle(moduleData.title || '');
      setDescription(moduleData.description || '');
      setModuleOrder(moduleData.module_order !== undefined ? String(moduleData.module_order) : '');
    } else {
      // Reset for new module form
      setTitle('');
      setDescription('');
      setModuleOrder(''); 
    }
    setFormError(''); // Clear errors when moduleData changes
  }, [moduleData, isEditing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
        setFormError("Module title is required.");
        return;
    }
    
    const payload = {
      title,
      description,
      // Only include module_order if it's explicitly set and valid
      // If empty, backend service will auto-assign next order.
      ...(moduleOrder.trim() !== '' && !isNaN(parseInt(moduleOrder)) && { module_order: parseInt(moduleOrder) })
    };
    
    // onSave is now expected to be an async function that handles the API call
    onSave(payload); 
  };
  
  const styles = { 
    formContainer: { padding: '20px', border: '1px dashed #ccc', borderRadius: '8px', marginTop: '15px', backgroundColor: '#fdfdfd', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    textarea: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', boxSizing: 'border-box' },
    button: { padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px', fontSize: '0.95rem' },
    disabledButton: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    error: { color: 'red', fontSize: '0.9em', marginTop: '5px'},
  };


  return (
    <div style={styles.formContainer}>
      <h3 style={{marginTop:0, marginBottom: '20px'}}>{isEditing ? 'Edit Module' : 'Add New Module'}</h3>
      {formError && <p style={styles.error}>{formError}</p>}
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label htmlFor="moduleTitle" style={styles.label}>Title <span style={{color: 'red'}}>*</span></label>
          <input
            type="text"
            id="moduleTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            required
            disabled={isProcessing}
          />
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="moduleDescription" style={styles.label}>Description (Optional)</label>
          <textarea
            id="moduleDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            disabled={isProcessing}
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
            placeholder="Leave blank for auto-order at the end"
            disabled={isProcessing}
          />
        </div>
        <div>
          <button type="submit" disabled={isProcessing} style={isProcessing ? {...styles.button, ...styles.disabledButton} : styles.button}>
            {isProcessing ? 'Saving...' : (isEditing ? 'Update Module' : 'Create Module')}
          </button>
          {onCancel && ( // Ensure onCancel is provided to show the button
            <button type="button" onClick={onCancel} disabled={isProcessing} style={{...styles.button, backgroundColor: '#6c757d', ...(isProcessing ? styles.disabledButton : {})}}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ModuleForm;
