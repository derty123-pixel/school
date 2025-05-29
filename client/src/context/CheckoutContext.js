import React, { createContext, useReducer, useContext, useMemo, useCallback } from 'react';
import apiClient from '../utils/api'; // Import the API client

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
  },
  isProcessingOrder: false, 
  error: null,              
  placedOrderId: null, // To store the ID of the successfully placed order
};

// --- 2. Define Action Types ---
const ActionTypes = {
  SET_CURRENT_STEP: 'SET_CURRENT_STEP',
  SET_SHIPPING_ADDRESS: 'SET_SHIPPING_ADDRESS',
  SET_BILLING_ADDRESS: 'SET_BILLING_ADDRESS',
  TOGGLE_USE_SHIPPING_FOR_BILLING: 'TOGGLE_USE_SHIPPING_FOR_BILLING',
  LOAD_ORDER_SUMMARY: 'LOAD_ORDER_SUMMARY', 
  SET_ORDER_PROCESSING: 'SET_ORDER_PROCESSING',
  SET_CHECKOUT_ERROR: 'SET_CHECKOUT_ERROR',
  CLEAR_CHECKOUT_ERROR: 'CLEAR_CHECKOUT_ERROR',
  ORDER_PLACEMENT_SUCCESS: 'ORDER_PLACEMENT_SUCCESS',
  RESET_CHECKOUT_STATE: 'RESET_CHECKOUT_STATE',
};

// --- 3. Create Reducer Function ---
const checkoutReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CURRENT_STEP:
      return { ...state, currentStep: action.payload, error: null };
    case ActionTypes.SET_SHIPPING_ADDRESS:
      const newShippingAddress = action.payload;
      return {
        ...state,
        shippingAddress: newShippingAddress,
        billingAddress: state.useShippingForBilling ? newShippingAddress : state.billingAddress,
      };
    case ActionTypes.SET_BILLING_ADDRESS:
      return { ...state, billingAddress: action.payload };
    case ActionTypes.TOGGLE_USE_SHIPPING_FOR_BILLING:
      const useShipping = action.payload;
      return {
        ...state,
        useShippingForBilling: useShipping,
        billingAddress: useShipping ? state.shippingAddress : state.billingAddress, 
      };
    case ActionTypes.LOAD_ORDER_SUMMARY:
      const cartData = action.payload;
      return {
        ...state,
        orderSummary: {
          items: cartData.items || [],
          itemCount: cartData.itemCount || 0,
          subtotal: cartData.cartTotal || cartData.subtotal || 0,
          shippingCost: state.orderSummary.shippingCost, 
          taxes: state.orderSummary.taxes,             
          total: cartData.cartTotal || cartData.subtotal || 0, 
          cartId: cartData.cartId || null,
        },
      };
    case ActionTypes.SET_ORDER_PROCESSING:
      return { ...state, isProcessingOrder: action.payload, error: null };
    case ActionTypes.SET_CHECKOUT_ERROR:
      return { ...state, error: action.payload, isProcessingOrder: false };
    case ActionTypes.CLEAR_CHECKOUT_ERROR:
        return { ...state, error: null };
    case ActionTypes.ORDER_PLACEMENT_SUCCESS:
        return {
            ...state, // Keep currentStep, addresses for confirmation page if needed, or reset parts
            isProcessingOrder: false,
            error: null,
            placedOrderId: action.payload.orderId, // Store the placed order ID
        };
    case ActionTypes.RESET_CHECKOUT_STATE:
      // Keep placedOrderId if needed for a brief period, or clear it too.
      // For a full reset:
      const placedOrderId = state.placedOrderId; // Persist if navigating immediately then resetting
      return {
        ...initialCheckoutState,
        placedOrderId: placedOrderId, // Or clear it: initialCheckoutState.placedOrderId if defined as null
        orderSummary: { ...initialCheckoutState.orderSummary } 
      };
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
  handlePlaceOrder: async () => {}, // New action for placing order
  setCheckoutError: () => {}, // Exposing for direct error setting if needed
  clearCheckoutError: () => {},
  resetCheckoutState: () => {},
});

// --- 5. Create CheckoutProvider Component ---
export const CheckoutProvider = ({ children }) => {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);

  const handlePlaceOrder = useCallback(async (cartId, shippingAddress, billingAddress) => {
    if (!cartId || !shippingAddress || !billingAddress) {
        dispatch({ type: ActionTypes.SET_CHECKOUT_ERROR, payload: 'Missing cart or address information for order placement.' });
        return Promise.reject(new Error('Missing cart or address information.'));
    }
    dispatch({ type: ActionTypes.SET_ORDER_PROCESSING, payload: true });
    try {
      // Step 1: Create Order from Cart
      // The backend /api/orders/from-cart expects X-Cart-ID implicitly via interceptor if cartId is the same one in localStorage
      // Or, if the backend specifically needs cart_id in payload, it should be added.
      // Based on `order_apis.md`, `req.cart` is used, which `ensureCart` middleware provides.
      // `ensureCart` uses `X-Cart-ID`. So, `cartId` from `CartContext` should be in `localStorage` via `apiClient`.
      const createOrderResponse = await apiClient.post('/orders/from-cart', {
        shippingAddress,
        billingAddress,
        // cartId: cartId, // Only if backend explicitly needs it in body AND ensureCart doesn't cover it
      });
      
      const pendingOrder = createOrderResponse.data.order;
      if (!pendingOrder || !pendingOrder.id) {
        throw new Error('Order creation failed to return an order ID.');
      }

      // Step 2: Confirm Payment (Simulated)
      const confirmPaymentResponse = await apiClient.post(`/orders/${pendingOrder.id}/confirm-payment`);
      const confirmedOrder = confirmPaymentResponse.data.order;

      dispatch({ type: ActionTypes.ORDER_PLACEMENT_SUCCESS, payload: { orderId: confirmedOrder.id } });
      dispatch({ type: ActionTypes.SET_ORDER_PROCESSING, payload: false });
      return confirmedOrder; // Return the confirmed order details

    } catch (error) {
      console.error('Order placement failed:', error.response?.data?.message || error.message);
      const errorMessage = error.response?.data?.message || 'An unexpected error occurred during order placement.';
      dispatch({ type: ActionTypes.SET_CHECKOUT_ERROR, payload: errorMessage });
      dispatch({ type: ActionTypes.SET_ORDER_PROCESSING, payload: false });
      throw error; // Re-throw for the component to handle (e.g., display alert)
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
    handlePlaceOrder, // Expose the new async action
    setCheckoutError: (error) => dispatch({ type: ActionTypes.SET_CHECKOUT_ERROR, payload: error }), // For direct error setting
    clearCheckoutError: () => dispatch({ type: ActionTypes.CLEAR_CHECKOUT_ERROR }),
    resetCheckoutState: () => dispatch({ type: ActionTypes.RESET_CHECKOUT_STATE }),
  }), [dispatch, handlePlaceOrder]); // Added handlePlaceOrder to dependencies

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
