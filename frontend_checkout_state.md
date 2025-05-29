# Frontend Checkout State Management (React)

This document outlines the chosen solution and implementation details for managing the multi-step checkout state on the frontend using React.

## 1. Chosen State Management Solution

*   **Solution:** **React Context API with `useReducer` hook.**
*   **Rationale:**
    *   **Consistency:** This approach aligns with the existing `CartContext`, providing a consistent state management pattern across the application.
    *   **Built-in & Lightweight:** Leverages React's native capabilities without adding external dependencies for this specific module's state.
    *   **Structured State Transitions:** `useReducer` is ideal for managing a state object with several interconnected fields and distinct actions that transition it between states (e.g., moving between checkout steps, updating addresses).
    *   **Self-Contained Logic:** The checkout flow has a clear lifecycle and set of related data, making it well-suited for a dedicated context.

## 2. Checkout State Shape

The checkout state is managed as an object with the following structure:

```javascript
{
  currentStep: 'shipping', // string: Current active step ('shipping', 'billing', 'review', 'processing')
  shippingAddress: null,   // object | null: User's shipping address details.
  billingAddress: null,    // object | null: User's billing address details.
  useShippingForBilling: true, // boolean: If true, billingAddress is automatically synced with shippingAddress.
  orderSummary: {          // object: A snapshot of the cart details at the beginning of checkout.
    items: [],             // Array of item objects from the cart.
    itemCount: 0,          // Total number of items.
    subtotal: 0,           // Subtotal from the cart.
    shippingCost: 0,       // Placeholder for shipping cost.
    taxes: 0,              // Placeholder for taxes.
    total: 0,              // Grand total (initially subtotal, updated with shipping/taxes later).
    cartId: null,          // string | null: The ID of the cart being checked out.
  },
  isProcessingOrder: false, // boolean: True when the final "place order" API call is active.
  error: null               // string | null: Stores error messages related to the checkout process.
}
```

## 3. Implementation File

*   **`client/src/context/CheckoutContext.js`**: This single file contains all core logic for checkout state:
    *   Definition of `initialCheckoutState`.
    *   `ActionTypes` constants (e.g., `SET_CURRENT_STEP`, `LOAD_ORDER_SUMMARY`).
    *   The `checkoutReducer` function.
    *   The `CheckoutContext` object (`createContext()`).
    *   The `CheckoutProvider` component.
    *   The `useCheckout` custom hook.

## 4. `CheckoutProvider` Component

*   **Purpose:** Wraps the part of the application that handles the checkout flow (e.g., the main `CheckoutPage.js` component or the router outlet rendering checkout-related routes).
*   **Usage:**
    ```jsx
    // In your router setup or a layout component that includes CheckoutPage
    import { CheckoutProvider } from './context/CheckoutContext';
    import CheckoutPage from './pages/CheckoutPage'; // Example

    // <CheckoutProvider>
    //   <CheckoutPage /> 
    //   {/* Or <Route path="/checkout" element={<CheckoutPage />} /> if provider is higher up */}
    // </CheckoutProvider>
    ```
*   **Functionality:**
    *   Initializes checkout state using `useReducer(checkoutReducer, initialCheckoutState)`.
    *   Provides the `state` object and memoized action creator functions (e.g., `setCurrentStep`, `setShippingAddress`) to descendant components via `CheckoutContext`.

## 5. `useCheckout` Custom Hook

*   **Purpose:** Allows components within the `CheckoutProvider`'s scope to easily access the checkout state and action methods.
*   **Usage:**
    ```jsx
    import { useCheckout } from './context/CheckoutContext';

    function MyCheckoutSubComponent() {
      const { state, setCurrentStep, setShippingAddress } = useCheckout();
      // Access state: state.currentStep, state.shippingAddress, etc.
      // Call actions: setCurrentStep('billing'), setShippingAddress({ ... }), etc.

      return (
        <div>Current Step: {state.currentStep}</div>
      );
    }
    ```
*   **Returns:** An object containing:
    *   `state`: The current checkout state object.
    *   Memoized action creator functions (see below).

## 6. Actions and Reducer Logic

The `checkoutReducer` handles the following actions (typically dispatched via action creators from `useCheckout`):

*   **`setCurrentStep(stepName)`**:
    *   **Type:** `SET_CURRENT_STEP`
    *   **Payload:** `stepName` (string, e.g., 'shipping', 'billing', 'review').
    *   **Logic:** Updates `currentStep` in the state. Clears any existing `error`.
*   **`setShippingAddress(addressObject)`**:
    *   **Type:** `SET_SHIPPING_ADDRESS`
    *   **Payload:** `addressObject`.
    *   **Logic:** Updates `shippingAddress`. If `useShippingForBilling` is true, also updates `billingAddress` with the same object.
*   **`setBillingAddress(addressObject)`**:
    *   **Type:** `SET_BILLING_ADDRESS`
    *   **Payload:** `addressObject`.
    *   **Logic:** Updates `billingAddress`. Does not affect `shippingAddress`.
*   **`toggleUseShippingForBilling(useShipping)`**:
    *   **Type:** `TOGGLE_USE_SHIPPING_FOR_BILLING`
    *   **Payload:** `useShipping` (boolean).
    *   **Logic:** Updates `useShippingForBilling`. If `useShipping` becomes true, it copies the current `shippingAddress` to `billingAddress`.
*   **`loadOrderSummary(cartData)`**:
    *   **Type:** `LOAD_ORDER_SUMMARY`
    *   **Payload:** `cartData` (object from `CartContext` state, e.g., `{ items, itemCount, cartTotal, cartId }`).
    *   **Logic:** Populates the `orderSummary` part of the checkout state. `cartTotal` from `CartContext` is typically used as the initial `subtotal` and `total` for the order summary. Shipping and taxes are placeholders.
*   **`setOrderProcessing(isProcessing)`**:
    *   **Type:** `SET_ORDER_PROCESSING`
    *   **Payload:** `isProcessing` (boolean).
    *   **Logic:** Sets the `isProcessingOrder` flag (e.g., when submitting the order to the backend). Clears any existing `error`.
*   **`setCheckoutError(errorMessage)`**:
    *   **Type:** `SET_CHECKOUT_ERROR`
    *   **Payload:** `errorMessage` (string).
    *   **Logic:** Sets the `error` message in the state and sets `isProcessingOrder` to false.
*   **`clearCheckoutError()`**:
    *   **Type:** `CLEAR_CHECKOUT_ERROR`
    *   **Logic:** Clears the `error` message in the state.
*   **`resetCheckoutState()`**:
    *   **Type:** `RESET_CHECKOUT_STATE`
    *   **Logic:** Resets the entire checkout state to its `initialCheckoutState`. Useful after successful order placement or if the user abandons the checkout process.

## 7. Integration with `CheckoutPage.js` and Sub-components (Conceptual)

*   **`CheckoutPage.js`:**
    *   Will be wrapped by `CheckoutProvider` (or `CheckoutProvider` will be higher in the component tree).
    *   Uses `useCheckout()` to get `state` (e.g., `currentStep`, `shippingAddress`, `isProcessingOrder`, `error`) and action creators (`setCurrentStep`, `setShippingAddress`, etc.).
    *   Uses `useCart()` from `CartContext` to get current cart details.
    *   In a `useEffect` hook (triggered on mount or when cart changes and checkout begins), it calls `loadOrderSummary(cartStateFromCartContext)` to populate the checkout state's order summary.
    *   Passes relevant parts of the checkout `state` and action creators as props to `AddressForm` and `OrderSummary` components if they don't consume the context directly.
    *   Handles navigation between steps by calling `setCurrentStep`.
    *   When "Place Order" is clicked:
        1.  Calls `setOrderProcessing(true)`.
        2.  (Future Task) Makes an API call to the backend.
        3.  (Future Task) On API success: calls `resetCheckoutState()`, calls `clearCart()` from `CartContext`, navigates to order confirmation.
        4.  (Future Task) On API failure: calls `setCheckoutError(errorMsg)`, `setOrderProcessing(false)`.
*   **`AddressForm.js`:**
    *   Receives `initialAddress` (e.g., `state.shippingAddress` from `useCheckout()`).
    *   Receives `onSubmitAddress` which would be a handler in `CheckoutPage` that calls `setShippingAddress(addressData)` or `setBillingAddress(addressData)` from `useCheckout()`, then `setCurrentStep()`.
*   **`OrderSummary.js`:**
    *   Receives `cart` (which would be `state.orderSummary` from `useCheckout()`) as a prop from `CheckoutPage`.

This setup provides a structured way to manage the state of the multi-step checkout flow, keeping data and logic organized and accessible to the relevant components.
```
