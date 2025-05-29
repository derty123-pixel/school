import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AddressForm from '../components/checkout/AddressForm';
import OrderSummary from '../components/checkout/OrderSummary';
import CheckoutSteps from '../components/checkout/CheckoutSteps';
import { useCart } from '../context/CartContext';
import { useCheckout } from '../context/CheckoutContext';

const CHECKOUT_STEP_CONFIG = [ // Changed from CHECKOUT_STEPS to avoid conflict
  { id: 'shipping', name: 'Shipping Address' },
  { id: 'billing', name: 'Billing Address' },
  { id: 'review', name: 'Review & Place Order' },
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
    handlePlaceOrder, // API call action
    resetCheckoutState,
    clearCheckoutError,
  } = useCheckout();
  
  const navigate = useNavigate();

  const { 
    currentStep, 
    shippingAddress, 
    billingAddress, 
    useShippingForBilling, 
    orderSummary, 
    isProcessingOrder, 
    error: checkoutError 
  } = checkoutState;

  // Load order summary from cart when component mounts or cart changes
  useEffect(() => {
    if (cartState.cartId && cartState.items.length > 0) {
      loadOrderSummary({
        items: cartState.items,
        itemCount: cartState.itemCount,
        cartTotal: cartState.cartTotal, // This is typically the subtotal for the order
        cartId: cartState.cartId,
      });
    }
    // If cart becomes empty and we are not already past shipping (e.g. user cleared cart in another tab)
    // and checkout process has started (e.g. currentStep is not initial or shippingAddress is set)
    if ((!cartState.items || cartState.items.length === 0) && !cartState.isLoading && currentStep !== CHECKOUT_STEP_CONFIG[0].id) {
        // navigate('/cart'); // Or show message
        console.warn("CheckoutPage: Cart is empty, consider redirecting or showing a message.");
    }

  }, [cartState, loadOrderSummary, currentStep, navigate]);


  const handleNextStep = () => {
    const currentIndex = CHECKOUT_STEP_CONFIG.findIndex(step => step.id === currentStep);
    if (currentIndex < CHECKOUT_STEP_CONFIG.length - 1) {
      setCurrentStep(CHECKOUT_STEP_CONFIG[currentIndex + 1].id);
    } else {
      // This case should ideally be "Place Order" from review step
      submitOrder();
    }
  };

  const handlePrevStep = () => {
    const currentIndex = CHECKOUT_STEP_CONFIG.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(CHECKOUT_STEP_CONFIG[currentIndex - 1].id);
    }
  };

  const handleShippingSubmit = (addressData) => {
    setShippingAddress(addressData); // This will also set billing if useShippingForBilling is true
    if (useShippingForBilling) {
      setCurrentStep('review'); 
    } else {
      setCurrentStep('billing');
    }
  };

  const handleBillingSubmit = (addressData) => {
    setBillingAddress(addressData);
    setCurrentStep('review');
  };

  const submitOrder = async () => {
    if (!shippingAddress || (!useShippingForBilling && !billingAddress)) {
      alert('Please complete shipping and billing information.');
      setCurrentStep('shipping'); 
      return;
    }
    if (!orderSummary.cartId) {
        alert('Cart information is missing. Cannot place order.');
        return;
    }

    const finalShippingAddress = shippingAddress;
    const finalBillingAddress = useShippingForBilling ? shippingAddress : billingAddress;

    try {
      const confirmedOrder = await handlePlaceOrder(
        orderSummary.cartId, 
        finalShippingAddress, 
        finalBillingAddress
      );
      
      // Order successfully placed and payment confirmed (simulated)
      await reloadCartAfterOrder(); // Refresh cart (should be empty or new) in CartContext
      // resetCheckoutState(); // Reset checkout state AFTER navigation potentially
      
      navigate(`/order-confirmation/${confirmedOrder.id}`, { 
          state: { orderDetails: confirmedOrder } 
      });
      // It's important to reset checkout state AFTER navigation or ensure OrderConfirmationPage doesn't rely on it.
      // For a clean experience, resetCheckoutState might be better called when CheckoutPage unmounts or on successful navigation.
      // Or, OrderConfirmationPage should not use useCheckout() hook.
      // Let's call reset after navigation for now.
      resetCheckoutState();


    } catch (error) {
      // Error is already set in checkoutState by handlePlaceOrder
      console.error('CheckoutPage: Failed to place order:', error);
      // Alert for immediate feedback, though error is also in state
      alert(`Order placement failed: ${checkoutState.error || error.message}`);
    }
  };
  
  // Initial loading of cart from CartContext
  if (cartState.isLoading && !cartState.cartId && !checkoutError) {
      return <div style={{padding: '20px', textAlign: 'center'}}>Loading cart details...</div>;
  }

  // If cart is empty after initial load (and not due to an error being displayed)
  if (!cartState.isLoading && (!orderSummary.items || orderSummary.items.length === 0) && !checkoutError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Your cart is empty.</h2>
        <p>You need items in your cart to proceed to checkout.</p>
        <button onClick={() => navigate('/')}>Go Shopping</button>
      </div>
    );
  }


  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Checkout</h1>
      <CheckoutSteps currentStep={currentStep} steps={CHECKOUT_STEP_CONFIG} />

      {checkoutError && (
        <div style={{ color: 'red', backgroundColor: '#ffe0e0', padding: '10px', marginBottom: '15px', borderRadius: '5px', textAlign: 'center' }}>
          Error: {checkoutError} 
          <button onClick={clearCheckoutError} style={{ marginLeft: '10px', background: 'none', border: '1px solid red', color: 'red', borderRadius: '3px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}


      <div style={{ display: 'flex', gap: '30px', flexDirection: window.innerWidth < 768 ? 'column-reverse' : 'row' }}>
        <div style={{ flex: 2 }}> {/* Forms and review */}
          {currentStep === 'shipping' && (
            <AddressForm 
              title="Shipping Address" 
              initialAddress={shippingAddress || {}}
              onSubmitAddress={handleShippingSubmit} 
              submitButtonText={useShippingForBilling ? "Continue to Review" : "Continue to Billing"}
            />
          )}
          {currentStep === 'billing' && !useShippingForBilling && (
            <AddressForm 
              title="Billing Address" 
              initialAddress={billingAddress || {}}
              onSubmitAddress={handleBillingSubmit} 
              submitButtonText="Continue to Review"
            />
          )}
          {currentStep === 'review' && (
            <div style={{border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9'}}>
              <h2 style={{marginTop:0}}>Review Your Order</h2>
              {shippingAddress && <div><strong>Shipping Address:</strong> <pre style={{fontSize: '0.9em', background:'#eee', padding:'5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(shippingAddress, null, 2)}</pre></div>}
              {billingAddress && !useShippingForBilling && <div style={{marginTop: '10px'}}><strong>Billing Address:</strong> <pre style={{fontSize: '0.9em', background:'#eee', padding:'5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(billingAddress, null, 2)}</pre></div>}
              <p style={{marginTop: '20px'}}>Please review your order details and items in the summary before placing your order.</p>
              <div style={{margin: '20px 0', padding: '15px', border: '1px dashed #ccc', textAlign:'center'}}>
                <h4>Payment Method</h4>
                <p>Payment gateway integration (Stripe/PayPal) will appear here. For now, click "Place Order" to simulate order creation and payment.</p>
              </div>
            </div>
          )}

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {currentStep !== CHECKOUT_STEP_CONFIG[0].id && (
              <button onClick={handlePrevStep} disabled={isProcessingOrder} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Back</button>
            )}
            {/* Spacer if "Back" button is not shown */}
            {currentStep === CHECKOUT_STEP_CONFIG[0].id && <div />} 

            {currentStep === 'review' ? (
              <button 
                onClick={submitOrder} 
                style={{ padding: '12px 25px', backgroundColor: isProcessingOrder ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.1em', cursor: isProcessingOrder ? 'not-allowed' : 'pointer' }}
                disabled={isProcessingOrder || cartState.isLoading} 
              >
                {isProcessingOrder ? 'Placing Order...' : 'Place Order'}
              </button>
            ) : ( 
              // "Continue" button is implicitly part of AddressForm submission
              // If a step has no form, a generic "Next" button would be here.
              // For now, AddressForm handles moving to next step.
              null
            )}
          </div>
           {currentStep === 'shipping' && (
             <div style={{marginTop: '20px'}}>
                <label>
                    <input 
                        type="checkbox" 
                        checked={useShippingForBilling}
                        onChange={(e) => toggleUseShippingForBilling(e.target.checked)}
                        disabled={isProcessingOrder}
                    />
                    My billing address is the same as my shipping address.
                </label>
             </div>
           )}
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <OrderSummary cart={orderSummary} /> {/* Pass orderSummary from checkoutState */}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
