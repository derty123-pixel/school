# Frontend Checkout API Integration

This document describes how the React frontend Checkout flow components and `CheckoutContext` are integrated with the backend Order APIs.

## 1. API Client Usage

*   The existing `axios` client (`client/src/utils/api.js`) is used for all API calls.
*   This client automatically handles:
    *   Sending the `X-Cart-ID` header (from `localStorage`) with requests, which is used by the backend's `ensureCart` middleware to identify the cart being converted to an order.
    *   Sending the `Authorization: Bearer <token>` header for authenticated users.

## 2. `CheckoutContext.js` API Integration

The `CheckoutContext` is central to managing the state and API interactions during the order placement process.

*   **`handlePlaceOrder(cartId, shippingAddress, billingAddress)` Action:**
    *   This new asynchronous action is the core of the integration.
    *   **Purpose:** To orchestrate the two-step order creation process with the backend: 1) create the order from the cart, 2) confirm the payment (simulated).
    *   **Steps:**
        1.  Dispatches `SET_ORDER_PROCESSING(true)` to update the UI state.
        2.  Makes a `POST /api/orders/from-cart` request using `apiClient`.
            *   The request payload includes `shippingAddress` and `billingAddress`.
            *   The `cartId` (obtained from `CartContext` state) is implicitly sent via the `X-Cart-ID` header managed by `apiClient`, as the backend `/api/orders/from-cart` endpoint uses the `ensureCart` middleware.
        3.  If order creation is successful, it receives the `pendingOrder` details (including the new `orderId`).
        4.  Makes a `POST /api/orders/{orderId}/confirm-payment` request using the `orderId` from the previous step.
        5.  If payment confirmation is successful, it receives the `confirmedOrder` details.
        6.  Dispatches `ORDER_PLACEMENT_SUCCESS` with the `confirmedOrder.id`.
        7.  Dispatches `SET_ORDER_PROCESSING(false)`.
        8.  Returns the `confirmedOrder` object to the calling component (`CheckoutPage`).
    *   **Error Handling:**
        *   If any API call fails, it catches the error.
        *   Dispatches `SET_CHECKOUT_ERROR` with a relevant error message.
        *   Dispatches `SET_ORDER_PROCESSING(false)`.
        *   Re-throws the error so the calling component can also react (e.g., show an alert).

## 3. `CheckoutPage.js` Integration

*   **Consuming Contexts:**
    *   Uses `useCheckout()` to access `checkoutState` (e.g., `currentStep`, `shippingAddress`, `billingAddress`, `orderSummary`, `isProcessingOrder`, `error`) and action creators (`setCurrentStep`, `setShippingAddress`, `handlePlaceOrder`, `resetCheckoutState`, `clearCheckoutError`).
    *   Uses `useCart()` to access `cartState` (specifically `cartState.cartId` needed for `handlePlaceOrder`) and the `loadInitialCart` action (aliased as `reloadCartAfterOrder`).
*   **Loading Order Summary:**
    *   An `useEffect` hook in `CheckoutPage` calls `loadOrderSummary(cartState)` when the component mounts or relevant `cartState` changes, populating `checkoutState.orderSummary`.
*   **Placing an Order (via `submitOrder` function):**
    1.  Retrieves `cartId` from `cartState`.
    2.  Retrieves `shippingAddress` and `billingAddress` from `checkoutState`.
    3.  Calls `handlePlaceOrder(cartId, shippingAddress, billingAddress)` from `CheckoutContext`.
    4.  **On Success (promise from `handlePlaceOrder` resolves):**
        *   Calls `reloadCartAfterOrder()` from `CartContext`: This action in `CartContext` should make a `GET /api/cart` call. Since the previous cart was converted to an order (and potentially marked as such or the backend `ensureCart` logic gives a new cart for the session), this effectively loads a new, empty cart for the user/session. The `X-Cart-ID` in `localStorage` would also be updated by `apiClient` if the backend provides a new one.
        *   Calls `resetCheckoutState()` from `CheckoutContext` to clear addresses, current step, etc., from the checkout form.
        *   Navigates to the `/order-confirmation/{orderId}` page, passing the `confirmedOrder` details received from `handlePlaceOrder` via route state (`location.state`).
    5.  **On Failure (promise from `handlePlaceOrder` rejects):**
        *   The error is already set in `checkoutState.error` by `handlePlaceOrder`.
        *   `CheckoutPage` displays this error. An additional alert might be shown for immediate user feedback.
*   **UI Feedback:**
    *   The "Place Order" button is disabled and shows "Placing Order..." text when `checkoutState.isProcessingOrder` is true.
    *   Checkout-related error messages from `checkoutState.error` are displayed on the page, with an option to dismiss them (calling `clearCheckoutError`).

## 4. `CartContext.js` Interaction

*   **`loadInitialCart()`:** This existing action in `CartContext` is reused after an order is placed. Its responsibility is to fetch the current state of the cart from `GET /api/cart`.
    *   After an order is created from a cart, the backend's `ensureCart` middleware (when called by `GET /api/cart`) should ideally recognize that the previous cart ID is now associated with an order and either return an empty cart or initiate a new cart for the session/user. The `apiClient`'s response interceptor will update `localStorage` with the new `X-Cart-ID` if provided by the backend.

## 5. `OrderConfirmationPage.js`

*   No direct changes needed for API integration itself, as it receives order details via `location.state` from `CheckoutPage.js`.
*   It should robustly check if `location.state.orderDetails` exists before trying to render them.

## 6. Manual Testing Summary (Conceptual)

A thorough manual testing process would verify the end-to-end flow:

1.  **Add Items to Cart:** As a guest or logged-in user.
2.  **Proceed to Checkout:**
    *   Verify `orderSummary` in `CheckoutPage` is correctly populated from `CartContext`.
3.  **Fill Address Forms:**
    *   Complete shipping address. Test "use shipping for billing" toggle.
    *   Complete billing address if different.
    *   Verify addresses are stored in `CheckoutContext` state.
4.  **Review Order:**
    *   Verify all details (addresses, order summary) are correctly displayed.
5.  **Place Order:**
    *   Click "Place Order".
    *   Verify "Place Order" button becomes disabled and shows "Placing Order...".
    *   **Network Monitor:** Observe `POST /api/orders/from-cart` call, then `POST /api/orders/{orderId}/confirm-payment` call. Check payloads and headers (`X-Cart-ID`, `Authorization`).
    *   **On Success:**
        *   Verify navigation to `OrderConfirmationPage`.
        *   Verify correct order details are displayed on the confirmation page.
        *   Verify `CartContext` is updated (e.g., `CartIcon` shows 0 items, or cart is empty if navigated back). This means `loadInitialCart()` in `CartContext` worked as expected.
        *   Verify `CheckoutContext` state is reset.
        *   Verify `localStorage` `cartId` is updated/cleared if the backend issues a new one or invalidates the old one post-order.
    *   **On Failure (Simulated e.g., by temporarily making an API endpoint fail or providing invalid data):**
        *   Verify "Place Order" button re-enables.
        *   Verify an error message is displayed on `CheckoutPage`.
        *   Verify cart contents remain unchanged.
6.  **Guest to User Cart Conversion Check:**
    *   If a guest places an order (assuming guest checkout is allowed and then they log in, or if they log in mid-checkout), ensure the cart used for the order is correctly associated with their user account and cannot be reused. (This scenario is more about backend `ensureCart` and login flow than just checkout API integration). The current `POST /api/orders/from-cart` requires an authenticated user.

This integration connects the client-side checkout steps and state management with the backend APIs to finalize an order.
```
