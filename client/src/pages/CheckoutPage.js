import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js'; 
import AddressForm from '../components/checkout/AddressForm';
import OrderSummary from '../components/checkout/OrderSummary';
import CheckoutSteps from '../components/checkout/CheckoutSteps';
import StripePaymentForm from '../components/checkout/StripePaymentForm'; 
import { useCart } from '../context/CartContext';
import { useCheckout } from '../context/CheckoutContext';

const CHECKOUT_STEP_CONFIG = [
  { id: 'shipping', name: 'Shipping Address' },
  { id: 'billing', name: 'Billing Address' },
  { id: 'payment', name: 'Payment & Review' }, 
];

const CheckoutPage = () => {
  const { state: cartState, loadInitialCart: reloadCartAfterOrder } = useCart();
  const { 
    state: checkoutState, 
    setCurrentStep, 
    setShippingAddress, 
    setBillingAddress, 
    toggleUseShippingForBilling,
    loadOrderSummary,
    preparePayment,         
    fetchOrderStatusAfterClientPayment, // Updated action name
    resetCheckoutState,
    clearCheckoutError, // General checkout errors
    clearStripeError, // Stripe specific errors
  } = useCheckout();
  
  const navigate = useNavigate();

  const { 
    currentStep, 
    shippingAddress, 
    billingAddress, 
    useShippingForBilling, 
    orderSummary, 
    isProcessingOrder,  // Used by fetchOrderStatusAfterClientPayment
    isPreparingPayment, 
    error: checkoutError, 
    stripePromise,      
    clientSecret,       
    stripeError,
    // placedOrderDetails will be available in state after fetchOrderStatusAfterClientPayment SUCCESS
  } = checkoutState;

  useEffect(() => {
    if (cartState.cartId && cartState.items.length > 0) {
      loadOrderSummary({
        items: cartState.items,
        itemCount: cartState.itemCount,
        cartTotal: cartState.cartTotal,
        cartId: cartState.cartId,
      });
    }
    if ((!cartState.items || cartState.items.length === 0) && !cartState.isLoading && currentStep !== CHECKOUT_STEP_CONFIG[0].id) {
        if (currentStep !== 'confirmation' && !isProcessingOrder && !isPreparingPayment) { 
             console.warn("CheckoutPage: Cart is empty, redirecting to cart page.");
             navigate('/cart'); 
        }
    }
  }, [cartState, loadOrderSummary, currentStep, navigate, isProcessingOrder, isPreparingPayment]);

  const stablePreparePayment = useCallback(preparePayment, []); 
  useEffect(() => {
    if (currentStep === 'payment' && !clientSecret && !isPreparingPayment && !checkoutError && !stripeError) {
        if (orderSummary.cartId && orderSummary.items.length > 0) {
             console.log("CheckoutPage: Current step is 'payment', preparing payment...");
             stablePreparePayment(cartState); 
        } else if (!cartState.isLoading) { 
            console.warn("CheckoutPage: Cart data not ready for payment preparation.");
            setCurrentStep('shipping'); 
        }
    }
  }, [currentStep, clientSecret, isPreparingPayment, stablePreparePayment, orderSummary, cartState, checkoutError, stripeError, setCurrentStep]);


  const handleShippingSubmit = (addressData) => {
    setShippingAddress(addressData);
    if (useShippingForBilling) {
      setCurrentStep('payment'); 
    } else {
      setCurrentStep('billing');
    }
  };

  const handleBillingSubmit = (addressData) => {
    setBillingAddress(addressData);
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = async (paymentIntent) => {
    console.log('CheckoutPage: Stripe payment successful via client!', paymentIntent);
    try {
      if (!orderSummary.orderId) {
        // This should not happen if preparePayment was successful
        throw new Error("Order ID not found after payment preparation.");
      }
      // Call the updated action to fetch latest order status from backend
      const finalOrderDetails = await fetchOrderStatusAfterClientPayment(orderSummary.orderId);
      
      await reloadCartAfterOrder(); // Refresh cart (should be empty or new) in CartContext
      
      navigate(`/order-confirmation/${finalOrderDetails.id}`, { 
          state: { orderDetails: finalOrderDetails } 
      });
      resetCheckoutState(); // Reset checkout state after successful navigation
    } catch (error) {
      console.error('CheckoutPage: Failed to finalize order status on backend after client payment success:', error);
      // Error is already set in checkoutState.error by fetchOrderStatusAfterClientPayment
      // Alert for immediate feedback, though error is also in state
      alert(`Order finalization failed: ${checkoutState.error || error.message}`);
    }
  };

  const handlePaymentFailure = (stripeJsError) => {
    console.error('CheckoutPage: Stripe payment failed on client!', stripeJsError);
    // The error (stripeJsError.message) is already set in checkoutState.stripeError 
    // by StripePaymentForm calling setStripeError from context.
    // No further action needed here unless specific UI changes are required on CheckoutPage itself.
  };
  
  const handlePrevStep = () => {
    const currentIndex = CHECKOUT_STEP_CONFIG.findIndex(step => step.id === currentStep);
    // Clear Stripe-specific errors when navigating away from payment screen
    if (currentStep === 'payment' && stripeError) {
        clearStripeError();
    }
    if (currentIndex > 0) {
      setCurrentStep(CHECKOUT_STEP_CONFIG[currentIndex - 1].id);
    }
  };
  
  if (cartState.isLoading && !cartState.cartId && !checkoutError && !stripeError) {
      return <div style={{padding: '20px', textAlign: 'center'}}>Loading cart details...</div>;
  }

  if (!cartState.isLoading && (!orderSummary.items || orderSummary.items.length === 0) && currentStep !== 'confirmation' && !checkoutError && !stripeError && !isPreparingPayment && !isProcessingOrder) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Your cart is empty.</h2>
        <p>You need items in your cart to proceed to checkout.</p>
        <button onClick={() => navigate('/')}>Go Shopping</button>
      </div>
    );
  }

  // Combined loading state for disabling UI elements appropriately
  const isLoading = isPreparingPayment || isProcessingOrder;


  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Checkout</h1>
      <CheckoutSteps currentStep={currentStep} steps={CHECKOUT_STEP_CONFIG} />

      {checkoutError && ( // General checkout errors (e.g. from backend order creation, finalization)
        <div style={{ color: 'red', backgroundColor: '#ffe0e0', padding: '10px', marginBottom: '15px', borderRadius: '5px', textAlign: 'center' }}>
          Error: {checkoutError} 
          <button onClick={clearCheckoutError} style={{ marginLeft: '10px', background: 'none', border: '1px solid red', color: 'red', borderRadius: '3px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}
      {/* Stripe-specific errors (e.g. card declined) are displayed within StripePaymentForm, 
          but also available in checkoutState.stripeError if needed here.
          StripePaymentForm now uses its own localStripeError first.
      */}


      <div style={{ display: 'flex', gap: '30px', flexDirection: window.innerWidth < 768 ? 'column-reverse' : 'row' }}>
        <div style={{ flex: 2 }}> 
          {currentStep === 'shipping' && (
            <AddressForm 
              title="Shipping Address" 
              initialAddress={shippingAddress || {}}
              onSubmitAddress={handleShippingSubmit} 
              submitButtonText={useShippingForBilling ? "Continue to Payment & Review" : "Continue to Billing"}
              disabled={isLoading}
            />
          )}
          {currentStep === 'billing' && !useShippingForBilling && (
            <AddressForm 
              title="Billing Address" 
              initialAddress={billingAddress || {}}
              onSubmitAddress={handleBillingSubmit} 
              submitButtonText="Continue to Payment & Review"
              disabled={isLoading}
            />
          )}
          {currentStep === 'payment' && (
            <div style={{border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9'}}>
              <h2 style={{marginTop:0}}>Review & Pay</h2>
              {shippingAddress && <div><strong>Shipping To:</strong> <pre style={{fontSize: '0.9em', background:'#eee', padding:'5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(shippingAddress, null, 2)}</pre></div>}
              {billingAddress && !useShippingForBilling && <div style={{marginTop: '10px'}}><strong>Billing With:</strong> <pre style={{fontSize: '0.9em', background:'#eee', padding:'5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(billingAddress, null, 2)}</pre></div>}
              
              <div style={{margin: '20px 0'}}>
                {isPreparingPayment && <p style={{textAlign: 'center', fontSize: '1.1em'}}>Preparing secure payment, please wait...</p>}
                {!isPreparingPayment && stripeError && ( // Error during payment prep (e.g. client secret fetch)
                     <p style={{color: 'red', textAlign: 'center'}}>Could not initialize payment form. Error: {stripeError}</p>
                )}
                {!isPreparingPayment && !stripeError && stripePromise && clientSecret && (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                    <StripePaymentForm 
                        clientSecret={clientSecret} 
                        onPaymentSuccess={handlePaymentSuccess}
                        onPaymentFailure={handlePaymentFailure}
                    />
                  </Elements>
                )}
                {/* Case where payment prep is done, but clientSecret or stripePromise is missing, without specific error */}
                {!isPreparingPayment && !stripeError && (!stripePromise || !clientSecret) && (
                     <p style={{color: 'orange', textAlign: 'center'}}>Payment form is loading or there was an issue. Please wait or refresh.</p>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {(currentStep === 'billing' || (currentStep === 'payment' && !isProcessingOrder)) && (
              <button onClick={handlePrevStep} disabled={isLoading} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Back</button>
            )}
            {currentStep === 'shipping' && <div />} {/* Spacer for layout consistency */}
            
            {/* No main "Place Order" button here anymore, it's inside StripePaymentForm */}
          </div>
           {currentStep === 'shipping' && (
             <div style={{marginTop: '20px'}}>
                <label>
                    <input 
                        type="checkbox" 
                        checked={useShippingForBilling}
                        onChange={(e) => toggleUseShippingForBilling(e.target.checked)}
                        disabled={isLoading}
                    />
                    My billing address is the same as my shipping address.
                </label>
             </div>
           )}
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <OrderSummary cart={orderSummary} />
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
