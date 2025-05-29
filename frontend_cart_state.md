# Frontend Shopping Cart State Management (React)

This document outlines the chosen solution and implementation details for managing the shopping cart state on the frontend using React.

## 1. Chosen State Management Solution

*   **Solution:** **React Context API with `useReducer` hook.**
*   **Rationale:**
    *   **Built-in:** It's part of React, requiring no external libraries for the core state management logic, which is good for keeping the bundle size down initially.
    *   **Centralized Logic:** `useReducer` is well-suited for managing state that has multiple, complex actions, allowing for a clear separation of concerns with a reducer function handling all state transitions.
    *   **Predictable State Updates:** Actions are dispatched to update state, making the flow of data more predictable and easier to debug than scattered `useState` calls for complex related state.
    *   **Performance:** For self-contained modules like a shopping cart, Context API performance is generally acceptable. If performance issues arise due to excessive re-renders in very large applications, more optimized solutions like Zustand or Redux could be considered, but Context API is a good starting point.
    *   **Sufficiency for MVP:** For the current scope of the shopping cart, it provides enough power and structure without premature optimization or adding external dependencies like Redux.

## 2. Cart State Shape

The cart state is managed as an object with the following structure:

```javascript
{
  cartId: null,      // string | null: Stores the backend's cart identifier. Persisted in localStorage for guests.
  items: [],         // Array: List of cart item objects. Each item typically looks like:
                     // { 
                     //   id: 'product-uuid', // Product ID
                     //   name: 'Product Name', 
                     //   price: 100.00, // Price per unit (price_at_addition from backend cart item)
                     //   quantity: 1, 
                     //   image: 'url-to-image.jpg', // Optional product image URL
                     //   item_id: 'cart-item-uuid' // Unique ID for this item *in the cart* (from backend)
                     // }
  itemCount: 0,      // number: Total number of individual items (sum of quantities of all unique products).
  cartTotal: 0,      // number: Total monetary value of all items in the cart.
  isLoading: true    // boolean: Indicates if the cart data is currently being loaded/synchronized.
}
```

## 3. Implementation Files

*   **`client/src/context/CartContext.js`**: This file contains all the core logic for cart state management:
    *   Initial state definition.
    *   Action type constants (e.g., `LOAD_CART`, `ADD_ITEM`).
    *   The `cartReducer` function.
    *   The `CartContext` object created via `createContext()`.
    *   The `CartProvider` component.
    *   The `useCart` custom hook.

## 4. `CartProvider` Component

*   **Purpose:** This component wraps parts of the application (typically the entire app in `App.js` or a layout component) that need access to the cart state.
*   **Usage:**
    ```jsx
    // In your App.js or a main layout component
    import { CartProvider } from './context/CartContext';

    function App() {
      return (
        <CartProvider>
          {/* Rest of your application components */}
        </CartProvider>
      );
    }
    ```
*   **Functionality:**
    *   Initializes the cart state using `useReducer(cartReducer, initialCartState)`.
    *   Provides the `state` object and action creator functions (e.g., `addItem`, `removeItem`) to all descendant components via the `CartContext`.
    *   Conceptually handles loading the `cartId` from `localStorage` on mount to persist guest carts across sessions (actual cart data fetching from backend using this ID is an integration step).
    *   Updates `localStorage` whenever `state.cartId` changes.

## 5. `useCart` Custom Hook

*   **Purpose:** Provides a clean and simple way for components to access the cart state and action methods.
*   **Usage:**
    ```jsx
    import { useCart } from './context/CartContext';

    function MyComponent() {
      const { state, addItem, removeItem, itemCount, cartTotal } = useCart();
      // state contains: { cartId, items, itemCount, cartTotal, isLoading }
      // Direct access to itemCount and cartTotal is also provided for convenience if destructured from useCart().
      // Though typically, you'd use state.itemCount and state.cartTotal.

      // Example usage:
      // const handleAddItem = (product) => addItem(product, 1);
      // return <div>Cart Items: {state.itemCount}</div>;

      // Corrected example for accessing itemCount and cartTotal from state:
      const handleAddItem = (product) => addItem(product, 1);
      return (
        <div>
          <p>Items in cart: {state.itemCount}</p>
          <p>Cart Total: ${state.cartTotal.toFixed(2)}</p>
          <button onClick={() => handleAddItem({id: 'prod1', name: 'Test Product', price: 10})}>Add Test Item</button>
        </div>
      );
    }
    ```
*   **Returns:** An object containing:
    *   `state`: The current cart state object.
    *   `dispatch`: The dispatch function from `useReducer` (less commonly used directly by components if action creators are provided).
    *   Memoized action creator functions (see below).

## 6. Actions and Reducer Logic

The `cartReducer` handles the following actions (dispatched via action creators from `useCart`):

*   **`loadCart(cartData)`**:
    *   **Type:** `LOAD_CART`
    *   **Payload:** `cartData` (object: `{ cartId, items }`). Typically received from the backend.
    *   **Logic:** Replaces the entire cart state with the payload. Recalculates `itemCount` and `cartTotal`. Sets `isLoading` to `false`.
*   **`setCartId(cartId)`**:
    *   **Type:** `SET_CART_ID`
    *   **Payload:** `cartId` (string).
    *   **Logic:** Updates the `cartId` in the state. Useful for synchronizing the frontend cart ID with the one from the backend, especially for guest carts.
*   **`addItem(product, quantity = 1)`**:
    *   **Type:** `ADD_ITEM`
    *   **Payload:** `{ product, quantity }` (where `product` is an object with at least `id`, `name`, `price`).
    *   **Logic:** If the product already exists in `items`, its quantity is increased. Otherwise, the new product is added to `items`. Recalculates `itemCount` and `cartTotal`.
*   **`removeItem(itemId)`**:
    *   **Type:** `REMOVE_ITEM`
    *   **Payload:** `{ itemId }` (where `itemId` is `product.id` or `cart_item.item_id`).
    *   **Logic:** Removes the item with the matching ID from `items`. Recalculates `itemCount` and `cartTotal`.
*   **`updateItemQuantity(itemId, quantity)`**:
    *   **Type:** `UPDATE_ITEM_QUANTITY`
    *   **Payload:** `{ itemId, quantity }`.
    *   **Logic:** Updates the quantity of the specified item. If `quantity` is 0 or less, the item is removed. Recalculates `itemCount` and `cartTotal`.
*   **`clearCart()`**:
    *   **Type:** `CLEAR_CART`
    *   **Payload:** (Optional) `{ cartId }` if a new cart ID needs to be set after clearing.
    *   **Logic:** Resets `items` to an empty array and `itemCount`, `cartTotal` to 0. May keep or update `cartId`.
*   **`setLoading(isLoading)`**:
    *   **Type:** `SET_LOADING`
    *   **Payload:** `isLoading` (boolean).
    *   **Logic:** Sets the `isLoading` flag in the state.

## 7. Connecting UI Components (Conceptual)

The previously created UI components would interact with this state as follows:

*   **`CartIcon.js`:**
    ```jsx
    import { useCart } from '../context/CartContext';
    // ...
    const { state } = useCart();
    // Pass state.itemCount to the component: <CartIcon itemCount={state.itemCount} />
    ```
*   **`AddToCartButton.js`:**
    ```jsx
    import { useCart } from '../context/CartContext';
    // ...
    const { addItem } = useCart();
    // Call addItem on click: <AddToCartButton productId="prod123" onAddToCart={(productId, quantity) => addItem({id: productId, name: "Sample", price: 100}, quantity)} />
    // Product details (name, price) would ideally come from product data, not hardcoded here.
    ```
*   **`CartPage.js`:**
    ```jsx
    import { useCart } from '../context/CartContext';
    // ...
    const { state, updateItemQuantity, removeItem, clearCart } = useCart();
    // Pass state.cart (or state itself) and action creators to the page:
    // <CartPage cart={state} onUpdateQuantity={updateItemQuantity} onRemoveItem={removeItem} onClearCart={() => clearCart()} />
    ```
*   **`CartItem.js`:** This component receives handlers (`onUpdateQuantity`, `onRemoveItem`) from `CartPage` which are now connected to the `useCart` actions.

## 8. Guest Cart ID Persistence

*   The `CartProvider` includes a `useEffect` hook that:
    *   On initial mount, attempts to read `cartId` from `localStorage`. This ID would be used to fetch the full cart details from the backend (API call not implemented in this step).
    *   Whenever `state.cartId` changes (e.g., after being set by a backend response), it's saved to `localStorage`. This ensures that if a guest user refreshes the page or revisits the site, their `cartId` can be retrieved, allowing the application to fetch their cart contents from the backend.

This setup provides a robust, self-contained state management solution for the shopping cart within the React frontend. The next step would be to integrate this with backend API calls.
```
