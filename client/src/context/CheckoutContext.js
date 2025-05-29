import React, { createContext, useReducer, useContext, useMemo, useCallback } from 'react';
import apiClient from '../utils/api'; 
import { loadStripe } from '@stripe/stripe-js';

// --- 1. Define Checkout State Shape ---
const initialCheckoutState = {
  currentStep: 'shipping', 
  shippingAddress: null,   
  billingAddress: null,    
  useShippingForBilling: true,
  orderSummary: { 
    items: [],
    itemCount: 0,
    subtotal: 0,
    shippingCost: 0, 
    taxes: 0,        
    total: 0,
    cartId: null,
    orderId: null, // Stores the ID of the order created BEFORE payment attempt
  },
  isProcessingOrder: false, // For final order placement after Stripe confirmation
  isPreparingPayment: false, // For creating pending order and fetching client secret
  error: null, // General checkout errors
  placedOrderId: null, // Order ID after successful backend confirmation (via webhook or client poll)
  placedOrderDetails: null, // Store the full order details after client poll for confirmation page

  stripePromise: null, 
  stripe: null, 
  clientSecret: null, 
  stripeError: null, 
};

// --- 2. Define Action Types ---
const ActionTypes = {
  SET_CURRENT_STEP: 'SET_CURRENT_STEP',
  SET_SHIPPING_ADDRESS: 'SET_SHIPPING_ADDRESS',
  SET_BILLING_ADDRESS: 'SET_BILLING_ADDRESS',
  TOGGLE_USE_SHIPPING_FOR_BILLING: 'TOGGLE_USE_SHIPPING_FOR_BILLING',
  LOAD_ORDER_SUMMARY: 'LOAD_ORDER_SUMMARY', 
  
  PREPARE_PAYMENT_START: 'PREPARE_PAYMENT_START',
  PREPARE_PAYMENT_SUCCESS: 'PREPARE_PAYMENT_SUCCESS', 
  PREPARE_PAYMENT_FAILURE: 'PREPARE_PAYMENT_FAILURE', 

  // Renamed for clarity: This is for client-side check after Stripe.js payment success
  CLIENT_CONFIRM_PAYMENT_START: 'CLIENT_CONFIRM_PAYMENT_START', 
  CLIENT_CONFIRM_PAYMENT_SUCCESS: 'CLIENT_CONFIRM_PAYMENT_SUCCESS', // payload: { orderDetails }
  CLIENT_CONFIRM_PAYMENT_FAILURE: 'CLIENT_CONFIRM_PAYMENT_FAILURE', // payload: errorMessage
  
  // This action type is for when webhook *actually* confirms order (not directly used by client actions here)
  // ORDER_PLACEMENT_SUCCESS: 'ORDER_PLACEMENT_SUCCESS', 
  
  SET_CHECKOUT_ERROR: 'SET_CHECKOUT_ERROR', 
  
  SET_STRIPE_ERROR: 'SET_STRIPE_ERROR', 
  CLEAR_STRIPE_ERROR: 'CLEAR_STRIPE_ERROR',
  RESET_CHECKOUT_STATE: 'RESET_CHECKOUT_STATE',
};

// --- 3. Create Reducer Function ---
const checkoutReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CURRENT_STEP:
      return { ...state, currentStep: action.payload, error: null, stripeError: null };
    case ActionTypes.SET_SHIPPING_ADDRESS:
      const newShippingAddress = action.payload;
      return { ...state, shippingAddress: newShippingAddress, billingAddress: state.useShippingForBilling ? newShippingAddress : state.billingAddress };
    case ActionTypes.SET_BILLING_ADDRESS:
      return { ...state, billingAddress: action.payload };
    case ActionTypes.TOGGLE_USE_SHIPPING_FOR_BILLING:
      const useShipping = action.payload;
      return { ...state, useShippingForBilling: useShipping, billingAddress: useShipping ? state.shippingAddress : state.billingAddress };
    case ActionTypes.LOAD_ORDER_SUMMARY:
      const cartData = action.payload;
      return {
        ...state,
        orderSummary: { ...state.orderSummary, items: cartData.items || [], itemCount: cartData.itemCount || 0, subtotal: cartData.cartTotal || cartData.subtotal || 0, total: cartData.cartTotal || cartData.subtotal || 0, cartId: cartData.cartId || null },
      };
    
    case ActionTypes.PREPARE_PAYMENT_START:
        return { ...state, isPreparingPayment: true, error: null, stripeError: null, clientSecret: null };
    case ActionTypes.PREPARE_PAYMENT_SUCCESS:
        return { 
            ...state, 
            isPreparingPayment: false, 
            orderSummary: { ...state.orderSummary, orderId: action.payload.orderId }, // Store orderId here
            clientSecret: action.payload.clientSecret,
            stripe: action.payload.stripeInstance,
            stripePromise: action.payload.stripePromiseInstance,
            error: null, 
            stripeError: null,
        };
    case ActionTypes.PREPARE_PAYMENT_FAILURE:
        return { ...state, isPreparingPayment: false, error: action.payload, stripeError: action.payload, clientSecret: null };

    case ActionTypes.CLIENT_CONFIRM_PAYMENT_START: // Client calls backend to get latest status
      return { ...state, isProcessingOrder: true, error: null, stripeError: null };
    case ActionTypes.CLIENT_CONFIRM_PAYMENT_SUCCESS: // Backend returned latest order details
        return { 
            ...state, 
            isProcessingOrder: false, 
            error: null, 
            stripeError: null, 
            placedOrderId: action.payload.orderDetails.id, // Store the ID of the order
            placedOrderDetails: action.payload.orderDetails, // Store the full order details for confirmation page
            currentStep: 'confirmation', // Move to confirmation step/page
        };
    case ActionTypes.CLIENT_CONFIRM_PAYMENT_FAILURE:
      return { ...state, error: action.payload, isProcessingOrder: false };
    
    case ActionTypes.SET_CHECKOUT_ERROR: // General non-Stripe checkout error
      return { ...state, error: action.payload, isProcessingOrder: false, isPreparingPayment: false };
    case ActionTypes.SET_STRIPE_ERROR:
        return { ...state, stripeError: action.payload, isProcessingOrder: false, isPreparingPayment: false };
    case ActionTypes.CLEAR_STRIPE_ERROR:
        return { ...state, stripeError: null };
    case ActionTypes.RESET_CHECKOUT_STATE:
      const { stripePromise: sp, stripe: s } = state; 
      return { ...initialCheckoutState, stripePromise: sp, stripe: s, orderSummary: { ...initialCheckoutState.orderSummary } };
    default:
      return state;
  }
};

// --- 4. Create Checkout Context ---
const CheckoutContext = createContext({
  state: initialCheckoutState,
  setCurrentStep: () => {},
  setShippingAddress: () => {},
  setBillingAddress: () => {},
  toggleUseShippingForBilling: () => {},
  loadOrderSummary: () => {},
  preparePayment: async () => {}, 
  // Renamed to reflect its new role: fetching latest status from backend after client-side Stripe success
  fetchOrderStatusAfterClientPayment: async () => {}, 
  setCheckoutError: () => {}, 
  setStripeError: () => {},
  clearStripeError: () => {},
  resetCheckoutState: () => {},
});

// --- 5. Create CheckoutProvider Component ---
let stripePromiseGlobalInstance = null; 

export const CheckoutProvider = ({ children }) => {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);

  const preparePayment = useCallback(async (cartContextState) => {
    if (!state.shippingAddress || (!state.useShippingForBilling && !state.billingAddress)) {
        dispatch({ type: ActionTypes.PREPARE_PAYMENT_FAILURE, payload: 'Shipping or billing address is missing.' });
        throw new Error('Shipping or billing address is missing.');
    }
    if (!cartContextState || !cartContextState.cartId) {
        dispatch({ type: ActionTypes.PREPARE_PAYMENT_FAILURE, payload: 'Cart information is missing.' });
        throw new Error('Cart information is missing.');
    }

    dispatch({ type: ActionTypes.PREPARE_PAYMENT_START });

    try {
      const orderPayload = {
        shippingAddress: state.shippingAddress,
        billingAddress: state.useShippingForBilling ? state.shippingAddress : state.billingAddress,
      };
      const orderResponse = await apiClient.post('/orders/from-cart', orderPayload);
      const pendingOrder = orderResponse.data.order;
      if (!pendingOrder || !pendingOrder.id) {
        throw new Error('Order creation failed to return an order ID.');
      }
      
      if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) {
        throw new Error("Stripe publishable key not found.");
      }
      if (!stripePromiseGlobalInstance) {
        stripePromiseGlobalInstance = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
      }
      const stripeInstance = await stripePromiseGlobalInstance;
      if (!stripeInstance) {
        throw new Error("Stripe.js failed to load.");
      }

      const clientSecretResponse = await apiClient.post('/payments/create-payment-intent', { orderId: pendingOrder.id });
      if (!clientSecretResponse.data || !clientSecretResponse.data.clientSecret) {
        throw new Error('Client secret not received from backend.');
      }

      dispatch({ 
        type: ActionTypes.PREPARE_PAYMENT_SUCCESS, 
        payload: { 
          orderId: pendingOrder.id, // This is the crucial orderId for the current checkout
          clientSecret: clientSecretResponse.data.clientSecret,
          stripeInstance,
          stripePromiseInstance: stripePromiseGlobalInstance,
        }
      });
      // Return orderId and clientSecret so CheckoutPage can use them if needed, though they are in state
      return { orderId: pendingOrder.id, clientSecret: clientSecretResponse.data.clientSecret };

    } catch (error) {
      console.error('Payment preparation failed:', error.response?.data?.message || error.message);
      const errorMessage = error.response?.data?.message || 'Failed to prepare payment.';
      dispatch({ type: ActionTypes.PREPARE_PAYMENT_FAILURE, payload: errorMessage });
      throw error;
    }
  }, [dispatch, state.shippingAddress, state.billingAddress, state.useShippingForBilling]);

  // Renamed action: This is called by client after Stripe.js payment success.
  // Its job is to call the backend endpoint which now just fetches the latest order status.
  const fetchOrderStatusAfterClientPayment = useCallback(async (orderId) => {
    if (!orderId) {
        dispatch({ type: ActionTypes.CLIENT_CONFIRM_PAYMENT_FAILURE, payload: 'Order ID is missing for status fetch.' });
        throw new Error('Order ID is missing.');
    }
    dispatch({ type: ActionTypes.CLIENT_CONFIRM_PAYMENT_START });
    try {
      // Backend endpoint POST /api/orders/{orderId}/confirm-payment now just fetches order status
      const response = await apiClient.post(`/orders/${orderId}/confirm-payment`); 
      const latestOrderDetails = response.data.order;

      dispatch({ type: ActionTypes.CLIENT_CONFIRM_PAYMENT_SUCCESS, payload: { orderDetails: latestOrderDetails } });
      return latestOrderDetails; // Return for navigation etc.
    } catch (error) {
      console.error('Fetching order status after client payment failed:', error.response?.data?.message || error.message);
      const errorMessage = error.response?.data?.message || 'Failed to fetch final order status.';
      dispatch({ type: ActionTypes.CLIENT_CONFIRM_PAYMENT_FAILURE, payload: errorMessage });
      throw error;
    }
  }, [dispatch]);

  const actions = useMemo(() => ({
    setCurrentStep: (stepName) => dispatch({ type: ActionTypes.SET_CURRENT_STEP, payload: stepName }),
    setShippingAddress: (address) => dispatch({ type: ActionTypes.SET_SHIPPING_ADDRESS, payload: address }),
    setBillingAddress: (address) => dispatch({ type: ActionTypes.SET_BILLING_ADDRESS, payload: address }),
    toggleUseShippingForBilling: (useShipping) => dispatch({ type: ActionTypes.TOGGLE_USE_SHIPPING_FOR_BILLING, payload: useShipping }),
    loadOrderSummary: useCallback((cartData) => {
        dispatch({ type: ActionTypes.LOAD_ORDER_SUMMARY, payload: cartData })
    }, [dispatch]),
    preparePayment, 
    fetchOrderStatusAfterClientPayment, // Updated name
    setCheckoutError: (error) => dispatch({ type: ActionTypes.SET_CHECKOUT_ERROR, payload: error }),
    setStripeError: (error) => dispatch({ type: ActionTypes.SET_STRIPE_ERROR, payload: error}),
    clearStripeError: () => dispatch({ type: ActionTypes.CLEAR_STRIPE_ERROR }),
    resetCheckoutState: () => dispatch({ type: ActionTypes.RESET_CHECKOUT_STATE }),
  }), [dispatch, preparePayment, fetchOrderStatusAfterClientPayment]);

  return (
    <CheckoutContext.Provider value={{ state, ...actions }}>
      {children}
    </CheckoutContext.Provider>
  );
};

// --- 6. Create useCheckout Custom Hook ---
export const useCheckout = () => {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
};

export { ActionTypes as CheckoutActionTypes };
```
