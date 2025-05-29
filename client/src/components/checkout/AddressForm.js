import React, { useState, useEffect } from 'react';

const AddressForm = ({ title, initialAddress = {}, onSubmitAddress, submitButtonText = "Continue" }) => {
  const [address, setAddress] = useState({
    fullName: '',
    street: '',
    apartment: '',
    city: '',
    state: '', // State/Province
    postalCode: '',
    country: '',
    phoneNumber: '',
    ...initialAddress, // Spread initialAddress to prefill if provided
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Update form if initialAddress prop changes (e.g., fetched user's saved address)
    setAddress(prev => ({ ...prev, ...initialAddress }));
  }, [initialAddress]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAddress((prevAddress) => ({
      ...prevAddress,
      [name]: value,
    }));
    // Basic real-time validation feedback (optional)
    if (errors[name] && value.trim() !== '') {
        setErrors(prev => ({...prev, [name]: null}));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!address.fullName.trim()) newErrors.fullName = 'Full name is required.';
    if (!address.street.trim()) newErrors.street = 'Street address is required.';
    if (!address.city.trim()) newErrors.city = 'City is required.';
    if (!address.postalCode.trim()) newErrors.postalCode = 'Postal code is required.';
    if (!address.country.trim()) newErrors.country = 'Country is required.';
    // Add more specific validation as needed (e.g., postal code format, phone format)
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      console.log(`AddressForm (${title}) submitted:`, address);
      if (onSubmitAddress) {
        onSubmitAddress(address);
      }
    } else {
      console.log('AddressForm validation failed');
    }
  };
  
  const formFieldStyle = { marginBottom: '15px' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
  const inputStyle = { width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' };
  const errorStyle = { color: 'red', fontSize: '0.8em', marginTop: '2px' };


  return (
    <div style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>{title}</h3>
      <form onSubmit={handleSubmit}>
        <div style={formFieldStyle}>
          <label htmlFor={`fullName-${title}`} style={labelStyle}>Full Name</label>
          <input type="text" id={`fullName-${title}`} name="fullName" value={address.fullName} onChange={handleChange} style={inputStyle} />
          {errors.fullName && <p style={errorStyle}>{errors.fullName}</p>}
        </div>
        <div style={formFieldStyle}>
          <label htmlFor={`street-${title}`} style={labelStyle}>Street Address</label>
          <input type="text" id={`street-${title}`} name="street" value={address.street} onChange={handleChange} style={inputStyle} />
          {errors.street && <p style={errorStyle}>{errors.street}</p>}
        </div>
        <div style={formFieldStyle}>
          <label htmlFor={`apartment-${title}`} style={labelStyle}>Apartment, suite, etc. (Optional)</label>
          <input type="text" id={`apartment-${title}`} name="apartment" value={address.apartment} onChange={handleChange} style={inputStyle} />
        </div>
        <div style={formFieldStyle}>
          <label htmlFor={`city-${title}`} style={labelStyle}>City</label>
          <input type="text" id={`city-${title}`} name="city" value={address.city} onChange={handleChange} style={inputStyle} />
          {errors.city && <p style={errorStyle}>{errors.city}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{...formFieldStyle, flex: 1}}>
                <label htmlFor={`state-${title}`} style={labelStyle}>State / Province</label>
                <input type="text" id={`state-${title}`} name="state" value={address.state} onChange={handleChange} style={inputStyle} />
                {/* Add error display for state if needed */}
            </div>
            <div style={{...formFieldStyle, flex: 1}}>
                <label htmlFor={`postalCode-${title}`} style={labelStyle}>ZIP / Postal Code</label>
                <input type="text" id={`postalCode-${title}`} name="postalCode" value={address.postalCode} onChange={handleChange} style={inputStyle} />
                {errors.postalCode && <p style={errorStyle}>{errors.postalCode}</p>}
            </div>
        </div>
        <div style={formFieldStyle}>
          <label htmlFor={`country-${title}`} style={labelStyle}>Country</label>
          <input type="text" id={`country-${title}`} name="country" value={address.country} onChange={handleChange} style={inputStyle} />
          {errors.country && <p style={errorStyle}>{errors.country}</p>}
        </div>
        <div style={formFieldStyle}>
          <label htmlFor={`phoneNumber-${title}`} style={labelStyle}>Phone Number (Optional)</label>
          <input type="tel" id={`phoneNumber-${title}`} name="phoneNumber" value={address.phoneNumber} onChange={handleChange} style={inputStyle} />
        </div>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem' }}>
          {submitButtonText}
        </button>
      </form>
    </div>
  );
};

export default AddressForm;
