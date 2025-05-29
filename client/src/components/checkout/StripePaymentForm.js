import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCheckout } from '../../context/CheckoutContext'; // To access global loading/error states and actions

const StripePaymentForm = ({ clientSecret, onPaymentSuccess, onPaymentFailure }) => {
  const stripe = useStripe();
  const elements = useElements();
  // Use checkout context for global error display or disabling form during other operations
  const { state: checkoutState, setStripeError, clearStripeError } = useCheckout(); 
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');
  const [localStripeError, setLocalStripeError] = useState(null); // For immediate form errors

  const cardElementOptions = {
    style: {
      base: {
        color: "#32325d",
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#aab7c4"
        }
      },
      invalid: {
        color: "#fa755a",
        iconColor: "#fa755a"
      }
    },
    // hidePostalCode: true, // Optionally hide postal code if not needed by your Stripe settings
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearStripeError(); // Clear global Stripe error from context
    setLocalStripeError(null); // Clear local Stripe error

    if (!stripe || !elements) {
      console.error("Stripe.js has not loaded yet.");
      setLocalStripeError("Payment system is not ready. Please try again.");
      // Also set global error for visibility if this state persists
      if (typeof setStripeError === 'function') setStripeError("Payment system is not ready. Please try again.");
      return;
    }
    if (!clientSecret) {
        console.error("Client secret is not available for payment.");
        setLocalStripeError("Payment cannot be processed due to a configuration issue. Please try refreshing or contact support.");
        if (typeof setStripeError === 'function') setStripeError("Payment configuration issue.");
        return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
        console.error("CardElement not found");
        setLocalStripeError("Payment input element not found. Please try refreshing.");
        if (typeof setStripeError === 'function') setStripeError("Payment input element not found.");
        return;
    }

    setIsProcessingPayment(true);

    try {
      const billingDetails = {};
      if (cardHolderName.trim()) {
        billingDetails.name = cardHolderName.trim();
      }
      // Example: You can also collect address details here if needed,
      // or use what's already in checkoutState.billingAddress.
      // For simplicity, we'll only pass name if provided.
      // if (checkoutState.billingAddress) {
      //   billingDetails.address = {
      //     line1: checkoutState.billingAddress.street,
      //     city: checkoutState.billingAddress.city,
      //     state: checkoutState.billingAddress.state,
      //     postal_code: checkoutState.billingAddress.postalCode,
      //     country: checkoutState.billingAddress.country?.substring(0,2).toUpperCase(), // Stripe expects 2-letter country code
      //   };
      // }
      
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: billingDetails,
          },
        }
      );

      if (error) {
        // This error is from Stripe.js, e.g. card declined, invalid card details.
        console.error("Stripe payment confirmation error:", error);
        setLocalStripeError(error.message || "An unknown payment error occurred.");
        if (typeof setStripeError === 'function') setStripeError(error.message || "An unknown payment error occurred."); // Set in global context too
        if (onPaymentFailure) onPaymentFailure(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // PaymentIntent is successful
        console.log("Stripe PaymentIntent successful:", paymentIntent);
        setLocalStripeError(null); // Clear any previous local error
        if (onPaymentSuccess) onPaymentSuccess(paymentIntent);
      } else if (paymentIntent) {
        // Handle other statuses like 'requires_action', 'processing', etc.
        // For MVP, we primarily expect 'succeeded' or an error.
        console.warn("Stripe PaymentIntent status:", paymentIntent.status, paymentIntent);
        setLocalStripeError(`Payment status: ${paymentIntent.status}. Please follow any additional instructions or try again.`);
        if (typeof setStripeError === 'function') setStripeError(`Payment status: ${paymentIntent.status}.`);
        if (onPaymentFailure) onPaymentFailure({ message: `Payment status: ${paymentIntent.status}` });
      }
    } catch (e) {
        // Catch any unexpected exceptions during the process
        console.error("Exception during payment submission:", e);
        setLocalStripeError("A critical error occurred during payment processing.");
        if (typeof setStripeError === 'function') setStripeError("A critical error occurred.");
        if (onPaymentFailure) onPaymentFailure(e);
    } finally {
        setIsProcessingPayment(false);
    }
  };

  const formStyle = {
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  };
  const inputGroupStyle = { marginBottom: '15px' };
  const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
  const inputStyle = { width: 'calc(100% - 22px)', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '5px' };


  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Payment Details</h3>
      
      <div style={inputGroupStyle}>
        <label htmlFor="card-holder-name" style={labelStyle}>Cardholder Name</label>
        <input 
            type="text" 
            id="card-holder-name"
            value={cardHolderName}
            onChange={(e) => setCardHolderName(e.target.value)}
            placeholder="John M. Doe"
            style={inputStyle}
            disabled={isProcessingPayment || checkoutState.isProcessingOrder || checkoutState.isPreparingPayment}
        />
      </div>

      <div style={inputGroupStyle}>
        <label htmlFor="card-element" style={labelStyle}>Card Details</label>
        <CardElement id="card-element" options={cardElementOptions} />
      </div>

      {/* Display local errors first, then global Stripe errors if any */}
      {localStripeError && (
        <div style={{ color: 'red', marginBottom: '10px', fontSize: '0.9em' }}>
          Error: {localStripeError}
        </div>
      )}
      {!localStripeError && checkoutState.stripeError && (
         <div style={{ color: 'red', marginBottom: '10px', fontSize: '0.9em' }}>
          Error: {checkoutState.stripeError}
        </div>
      )}

      <button 
        type="submit" 
        disabled={!stripe || !elements || isProcessingPayment || checkoutState.isProcessingOrder || checkoutState.isPreparingPayment}
        style={{
          padding: '12px 25px', 
          backgroundColor: (!stripe || !elements || isProcessingPayment || checkoutState.isProcessingOrder || checkoutState.isPreparingPayment) ? '#ccc' : '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px', 
          fontSize: '1.1em', 
          width: '100%',
          cursor: (!stripe || !elements || isProcessingPayment || checkoutState.isProcessingOrder || checkoutState.isPreparingPayment) ? 'not-allowed' : 'pointer'
        }}
      >
        {isProcessingPayment ? 'Processing Payment...' : `Pay $${(checkoutState.orderSummary.total || 0).toFixed(2)}`}
      </button>
    </form>
  );
};

export default StripePaymentForm;
