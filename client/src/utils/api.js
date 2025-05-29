import axios from 'axios';

// Define the base URL for the API.
// In a real app, this would come from an environment variable.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api'; 

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add X-Cart-ID header from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const cartId = localStorage.getItem('cartId');
    if (cartId) {
      config.headers['X-Cart-ID'] = cartId;
    }
    // Also, if a user token exists (e.g., from auth context/localStorage), add it
    const userToken = localStorage.getItem('userToken'); // Assuming token is stored like this
    if (userToken) {
      config.headers['Authorization'] = `Bearer ${userToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to grab X-Cart-ID from response headers and store it
apiClient.interceptors.response.use(
  (response) => {
    const cartIdFromHeader = response.headers['x-cart-id'];
    if (cartIdFromHeader) {
      const currentCartId = localStorage.getItem('cartId');
      if (cartIdFromHeader !== currentCartId) {
        localStorage.setItem('cartId', cartIdFromHeader);
        // Optionally, dispatch an event or inform context if cartId changes unexpectedly mid-flow
        // console.log('apiClient: X-Cart-ID updated in localStorage:', cartIdFromHeader);
      }
    }
    const mergedCartId = response.headers['x-cart-merged-to'];
    if (mergedCartId) {
        // If a merge happened, the server now uses mergedCartId as the primary cartId.
        // The client should update its stored cartId to this new one.
        localStorage.setItem('cartId', mergedCartId);
        console.log('apiClient: Cart merged. New X-Cart-ID set from X-Cart-Merged-To:', mergedCartId);
    }

    return response;
  },
  (error) => {
    // Handle errors globally if needed (e.g., for unauthorized requests)
    if (error.response && error.response.status === 401) {
      // Example: redirect to login or refresh token
      console.error('API Client: Unauthorized access - 401');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
