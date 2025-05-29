import React, { createContext, useReducer, useContext, useMemo, useEffect, useCallback } from 'react';
import apiClient from '../utils/api'; // Import the API client

// --- 1. Define Cart State Shape ---
const initialCartState = {
  cartId: null,
  items: [],
  itemCount: 0,
  cartTotal: 0,
  isLoading: true, // Start with true as we will load initial cart
  error: null, // For storing API error messages
};

// --- 2. Define Action Types ---
const ActionTypes = {
  LOAD_CART_SUCCESS: 'LOAD_CART_SUCCESS', // API call successful
  LOAD_CART_FAILURE: 'LOAD_CART_FAILURE', // API call failed
  SET_CART_ID: 'SET_CART_ID', // Primarily for internal sync if needed, LOAD_CART_SUCCESS handles cartId from backend
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR',
  // ADD_ITEM, REMOVE_ITEM, etc. will be handled by calling API and then LOAD_CART_SUCCESS
};

// --- 3. Create Reducer Function ---
const calculateCartTotals = (items) => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Ensure price_at_addition is used for cart total calculation from backend data
  const cartTotal = items.reduce((sum, item) => sum + parseFloat(item.price_at_addition || item.price) * item.quantity, 0);
  return { itemCount, cartTotal };
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: null, // Clear previous errors when a new loading sequence starts
      };
    case ActionTypes.LOAD_CART_SUCCESS:
      const { cartId, items } = action.payload;
      const totals = calculateCartTotals(items || []);
      return {
        ...state,
        cartId: cartId,
        items: items || [],
        itemCount: totals.itemCount,
        cartTotal: totals.cartTotal,
        isLoading: false,
        error: null,
      };
    case ActionTypes.LOAD_CART_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
      };
    case ActionTypes.SET_CART_ID: // Might be redundant if LOAD_CART_SUCCESS always sets it
      return {
        ...state,
        cartId: action.payload,
      };
    case ActionTypes.CLEAR_ERROR:
        return {
            ...state,
            error: null,
        };
    default:
      return state;
  }
};

// --- 4. Create Cart Context ---
const CartContext = createContext({
  state: initialCartState,
  // Action creator functions will be provided by the context
  loadInitialCart: async () => {},
  addItemToCart: async () => {},
  removeItemFromCart: async () => {},
  updateItemQuantityInCart: async () => {},
  clearCartItems: async () => {},
  clearCartError: () => {},
});

// --- 5. Create CartProvider Component ---
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  const loadInitialCart = useCallback(async () => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    try {
      // apiClient will automatically send X-Cart-ID from localStorage if it exists
      const response = await apiClient.get('/cart');
      // The response interceptor in api.js should have updated localStorage with X-Cart-ID from response header
      dispatch({ type: ActionTypes.LOAD_CART_SUCCESS, payload: response.data });
    } catch (error) {
      console.error('Failed to load initial cart:', error.response?.data?.message || error.message);
      dispatch({ type: ActionTypes.LOAD_CART_FAILURE, payload: { error: error.response?.data?.message || 'Failed to load cart.' } });
      // If cart fails to load (e.g. 404 for a guest cart ID that no longer exists),
      // we might want to clear the local cartId so a new one is created on next action.
      localStorage.removeItem('cartId'); 
      dispatch({ type: ActionTypes.SET_CART_ID, payload: null }); // Clear cartId in state too
    }
  }, [dispatch]);

  // Load initial cart on provider mount
  useEffect(() => {
    loadInitialCart();
  }, [loadInitialCart]);
  
  const actions = useMemo(() => ({
    loadInitialCart, // Expose it if manual refresh is needed
    addItemToCart: async (productId, quantity = 1) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      try {
        const response = await apiClient.post('/cart/items', { productId, quantity });
        dispatch({ type: ActionTypes.LOAD_CART_SUCCESS, payload: response.data.cart }); // Assuming backend returns { message, cart }
      } catch (error) {
        console.error('Failed to add item to cart:', error.response?.data?.message || error.message);
        dispatch({ type: ActionTypes.LOAD_CART_FAILURE, payload: { error: error.response?.data?.message || 'Failed to add item.' } });
        throw error; // Re-throw for component to handle if needed
      }
    },
    removeItemFromCart: async (cartItemId) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      try {
        const response = await apiClient.delete(`/cart/items/${cartItemId}`);
        dispatch({ type: ActionTypes.LOAD_CART_SUCCESS, payload: response.data.cart });
      } catch (error) {
        console.error('Failed to remove item from cart:', error.response?.data?.message || error.message);
        dispatch({ type: ActionTypes.LOAD_CART_FAILURE, payload: { error: error.response?.data?.message || 'Failed to remove item.' } });
        throw error;
      }
    },
    updateItemQuantityInCart: async (cartItemId, quantity) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      try {
        const response = await apiClient.put(`/cart/items/${cartItemId}`, { quantity });
        dispatch({ type: ActionTypes.LOAD_CART_SUCCESS, payload: response.data.cart });
      } catch (error) {
        console.error('Failed to update item quantity:', error.response?.data?.message || error.message);
        dispatch({ type: ActionTypes.LOAD_CART_FAILURE, payload: { error: error.response?.data?.message || 'Failed to update quantity.' } });
        throw error;
      }
    },
    clearCartItems: async () => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      try {
        const response = await apiClient.delete('/cart');
        dispatch({ type: ActionTypes.LOAD_CART_SUCCESS, payload: response.data.cart });
      } catch (error) {
        console.error('Failed to clear cart:', error.response?.data?.message || error.message);
        dispatch({ type: ActionTypes.LOAD_CART_FAILURE, payload: { error: error.response?.data?.message || 'Failed to clear cart.' } });
        throw error;
      }
    },
    clearCartError: () => {
        dispatch({ type: ActionTypes.CLEAR_ERROR });
    }
  }), [dispatch, loadInitialCart]); // loadInitialCart added here just in case it's part of actions

  return (
    <CartContext.Provider value={{ state, ...actions }}>
      {children}
    </CartContext.Provider>
  );
};

// --- 6. Create useCart Custom Hook ---
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Export ActionTypes if they need to be used directly (less common now)
export { ActionTypes as CartActionTypes };
```
