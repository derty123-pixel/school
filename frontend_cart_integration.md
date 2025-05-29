# Frontend Shopping Cart API Integration

This document describes how the React frontend shopping cart components and state management (`CartContext`) are integrated with the backend shopping cart APIs.

## 1. API Client Setup (`client/src/utils/api.js`)

*   **HTTP Client:** `axios` is used for making API calls. It's added as a dependency in `client/package.json`.
*   **Base URL:** A base URL for API endpoints (e.g., `http://localhost:3001/api`) is configured.
*   **Interceptors:**
    *   **Request Interceptor:**
        *   Automatically attaches the `X-Cart-ID` header to outgoing requests if a `cartId` is found in `localStorage`. This is crucial for guest cart persistence.
        *   Automatically attaches the `Authorization: Bearer <token>` header if a user token is found in `localStorage` (or an auth context).
    *   **Response Interceptor:**
        *   Checks for `X-Cart-ID` in response headers. If present and different from the one in `localStorage`, it updates `localStorage`. This ensures the client always has the latest cart ID provided by the backend.
        *   Checks for `X-Cart-Merged-To` in response headers. If present (indicating a guest cart was merged into a user's cart), it updates `localStorage` with this new primary cart ID.

## 2. `CartContext.js` API Integration

The `CartContext` actions have been refactored to be asynchronous and interact with the backend:

*   **State Enhancements:**
    *   `isLoading` (boolean): True while an API call related to cart modification is in progress.
    *   `error` (string | null): Stores error messages from API call failures.
*   **`loadInitialCart()`:**
    *   Called when `CartProvider` mounts.
    *   Dispatches `SET_LOADING` (true).
    *   Makes a `GET /api/cart` request (via `apiClient`, which sends `X-Cart-ID` if available).
    *   On success, dispatches `LOAD_CART_SUCCESS` with the full cart data from the backend response (payload: `{ cartId, items }`). The `items` from backend should include `item_id` (cart item's own ID), `product_id`, `product_name`, `quantity`, `price_at_addition`, `line_item_total`, etc.
    *   On failure, dispatches `LOAD_CART_FAILURE` with an error message. If the failure is due to an invalid guest `cartId` (e.g., 404), `localStorage` `cartId` is cleared to allow for a new guest cart creation.
*   **`addItemToCart(productId, quantity)`:**
    *   Dispatches `SET_LOADING` (true).
    *   Calls `POST /api/cart/items` with `{ productId, quantity }`.
    *   On success, dispatches `LOAD_CART_SUCCESS` with the updated cart from the backend response (backend should return the entire updated cart object).
    *   On failure, dispatches `LOAD_CART_FAILURE`.
*   **`removeItemFromCart(cartItemId)`:**
    *   Dispatches `SET_LOADING` (true).
    *   Calls `DELETE /api/cart/items/{cartItemId}`.
    *   On success, dispatches `LOAD_CART_SUCCESS` with the updated cart.
    *   On failure, dispatches `LOAD_CART_FAILURE`.
*   **`updateItemQuantityInCart(cartItemId, quantity)`:**
    *   Dispatches `SET_LOADING` (true).
    *   Calls `PUT /api/cart/items/{cartItemId}` with `{ quantity }`.
    *   On success, dispatches `LOAD_CART_SUCCESS` with the updated cart.
    *   On failure, dispatches `LOAD_CART_FAILURE`.
*   **`clearCartItems()`:**
    *   Dispatches `SET_LOADING` (true).
    *   Calls `DELETE /api/cart`.
    *   On success, dispatches `LOAD_CART_SUCCESS` with the (now empty) cart.
    *   On failure, dispatches `LOAD_CART_FAILURE`.
*   **`clearCartError()`:**
    *   Action to clear any existing error message from the state.

## 3. UI Component Updates

The UI components now use the asynchronous actions from `useCart()` and reflect loading/error states:

*   **`CartIcon.js`:**
    *   Displays `state.itemCount` from `useCart()`.
    *   Shows a loading indicator (e.g., "...") in the badge if `state.isLoading` is true during initial load.
*   **`AddToCartButton.js`:**
    *   Calls the asynchronous `addItemToCart(product.id, 1)` action.
    *   Is disabled and shows different text (e.g., "Adding...") when `state.isLoading` is true.
    *   Can display alerts or local error messages on API call failure (though global error display is also recommended via `CartPage`).
*   **`CartItem.js`:**
    *   Calls `updateItemQuantityInCart(item.item_id, newQuantity)` or `removeItemFromCart(item.item_id)`.
    *   Controls (quantity input, +/- buttons, remove button) are disabled when `state.isLoading` is true.
    *   Optimistic UI updates for quantity input are attempted, with reversion on error.
*   **`CartPage.js`:**
    *   Displays a global loading message (e.g., "Loading Your Cart..." or "Updating cart...") when `state.isLoading` is true.
    *   Displays error messages from `state.error`. Provides a "Dismiss" button for errors.
    *   "Clear Cart" button calls `clearCartItems()`.
    *   "Proceed to Checkout" button and other action buttons are disabled when `state.isLoading` is true or if the cart is empty.
    *   Uses cart data (`state.items`, `state.cartTotal`, `state.subtotal`) from `useCart()` to render the page.

## 4. Loading and Error State Handling

*   **Loading:** The `isLoading` flag in `CartContext` provides global feedback. Components disable interactive elements or show specific loading indicators during API operations.
*   **Errors:**
    *   API call errors are caught by the action functions in `CartContext.js`.
    *   An error message is stored in `state.error`.
    *   `CartPage.js` (or a global error display component) can render this error message.
    *   A `clearCartError` action allows users to dismiss the error message.
    *   Individual components like `AddToCartButton` can also catch errors from the promises returned by actions to provide more localized feedback if needed.

## 5. Manual Testing Summary (Conceptual)

A thorough manual testing process would be performed to cover various scenarios:

1.  **Guest User - First Visit:**
    *   Open site. `loadInitialCart` called. `GET /api/cart` (no `X-Cart-ID`). Backend creates guest cart.
    *   Response `X-Cart-ID` stored in `localStorage`.
    *   Cart UI shows empty cart. `CartIcon` shows 0.
2.  **Guest User - Add to Cart:**
    *   Click "Add to Cart". `addItemToCart` called. `POST /api/cart/items` (with `X-Cart-ID`).
    *   UI updates based on response. `CartIcon` updates.
3.  **Guest User - View Cart & Modify:**
    *   Navigate to Cart Page. `GET /api/cart` (with `X-Cart-ID`).
    *   Update quantity: `PUT /api/cart/items/{id}`.
    *   Remove item: `DELETE /api/cart/items/{id}`.
    *   Clear cart: `DELETE /api/cart`.
    *   Verify UI reflects changes and loading states.
4.  **Guest User - Session Persistence:**
    *   Add items to cart. Close tab/browser.
    *   Reopen. `loadInitialCart` called. `GET /api/cart` (with stored `X-Cart-ID`).
    *   Cart should be restored.
5.  **User Login - No Guest Cart:**
    *   Log in. `loadInitialCart` called. `GET /api/cart` (with Auth token, no/old `X-Cart-ID`).
    *   Backend returns/creates user-specific cart. New `X-Cart-ID` (if different) stored.
6.  **User Login - With Guest Cart (Merge Test):**
    *   As guest, add items to cart. Note `X-Cart-ID`.
    *   Log in. (Client should send Auth token AND the guest `X-Cart-ID`).
    *   `loadInitialCart` calls `GET /api/cart`. Backend `ensureCart` middleware detects user and guest `X-Cart-ID`, performs merge.
    *   Response `X-Cart-ID` (now user's primary cart ID) and potentially `X-Cart-Merged-To` are handled by `apiClient` interceptor to update `localStorage`.
    *   UI shows merged cart.
7.  **Error Scenarios:**
    *   Simulate API errors (e.g., network down, server 500 error).
    *   Verify `isLoading` is set to false and error messages are displayed.
    *   Test adding non-existent product, etc.
8.  **Concurrency/Rapid Actions:**
    *   Click "Add to Cart" multiple times quickly. Verify state remains consistent and buttons are disabled during loading.

This integration provides a functional shopping cart experience on the frontend, synchronized with the backend, and handles guest/user persistence.
```
