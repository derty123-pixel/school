import React from 'react';

const CheckoutSteps = ({ currentStep, steps }) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  const getStepStyle = (step, index) => {
    const isActive = step.id === currentStep;
    // Future: Could also mark steps as 'completed'
    // const isCompleted = index < steps.findIndex(s => s.id === currentStep);

    return {
      padding: '10px 15px',
      margin: '0 5px',
      borderBottom: isActive ? '3px solid #007bff' : '3px solid transparent',
      color: isActive ? '#007bff' : '#6c757d',
      fontWeight: isActive ? 'bold' : 'normal',
      cursor: 'default', // Not clickable for now, could be made clickable to go to previous steps
      display: 'inline-block',
    };
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', borderBottom: '1px solid #dee2e6' }}>
      {steps.map((step, index) => (
        <div key={step.id} style={getStepStyle(step, index)}>
          {step.name}
        </div>
      ))}
    </div>
  );
};

export default CheckoutSteps;
