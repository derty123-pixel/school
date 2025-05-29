# Frontend Shopping Cart Components (React - MVP Structure)

This document outlines the structure and expected props/interactions for the initial set of React components created for the shopping cart user interface. These components provide the basic JSX structure and placeholders for functionality.

## 1. `CartIcon.js`

*   **Location:** `client/src/components/cart/CartIcon.js` (can be placed in a shared `layout` components folder too).
*   **Purpose:** Displays a cart icon and a badge indicating the total number of unique items or total quantity in the cart. Navigates to the cart page on click.
*   **JSX Structure:**
    *   Uses a placeholder SVG for the cart icon.
    *   Displays a numerical badge positioned relative to the icon if `itemCount > 0`.
    *   Wrapped in a `<Link>` component (from `react-router-dom`) to navigate to `/cart`.
*   **Props:**
    *   `itemCount` (number): The total number of items (or unique products) in the cart. Used to display the badge.
*   **Interactions:**
    *   **Click:** Navigates the user to the `/cart` route (Cart Page).
*   **Styling:** Basic inline styles for badge positioning and appearance.

## 2. `AddToCartButton.js`

*   **Location:** `client/src/components/cart/AddToCartButton.js` (can also be placed in a `products` component folder).
*   **Purpose:** A button used on product listings or product detail pages to add a specific product to the shopping cart.
*   **JSX Structure:**
    *   A standard HTML `<button>` element.
    *   Displays text like "Add to Cart".
*   **Props:**
    *   `productId` (string/number): The unique identifier of the product to be added.
    *   `onAddToCart` (function): A callback function that is executed when the button is clicked. It's expected to handle the logic of adding the item to the cart (e.g., dispatching an action, calling an API). Receives `productId` and a default quantity (e.g., 1) as arguments.
    *   `productName` (string, optional): Name of the product, used for ARIA label. Defaults to "this product".
*   **Interactions:**
    *   **Click:** Calls the `onAddToCart(productId, 1)` prop.
*   **Styling:** Basic inline styles for button appearance.

## 3. `CartPage.js`

*   **Location:** `client/src/pages/CartPage.js`
*   **Purpose:** A page component that displays the full contents of the shopping cart, including a list of items, cart totals, and actions like proceeding to checkout or clearing the cart.
*   **JSX Structure:**
    *   Displays a title like "Your Shopping Cart".
    *   If the cart is empty, shows a message and a "Continue Shopping" button.
    *   If the cart has items:
        *   Renders a table with headers (Product, Price, Quantity, Total, Actions).
        *   Maps over `cart.items` and renders a `CartItem` component for each item.
        *   Displays a cart summary section with Subtotal, Taxes (placeholder "TBD"), Shipping (placeholder "TBD"), and Grand Total.
        *   Includes a "Clear Cart" button.
        *   Includes a "Proceed to Checkout" button (placeholder functionality).
*   **Props:**
    *   `cart` (object): The cart object, expected to have a structure like:
        ```javascript
        {
          id: 'cart-uuid', // Cart ID
          items: [ /* array of item objects, see CartItem props */ ],
          subtotal: 123.45,
          total: 123.45, // May include other calculated fields like taxes, shipping in future
          user_id: 'user-uuid' // or null
        }
        ```
    *   `onUpdateQuantity` (function): Callback passed to each `CartItem` for handling quantity changes. Signature: `(itemId, newQuantity) => void`.
    *   `onRemoveItem` (function): Callback passed to each `CartItem` for handling item removal. Signature: `(itemId) => void`.
    *   `onClearCart` (function): Callback executed when the "Clear Cart" button is clicked. Signature: `(cartId) => void`.
*   **Interactions:**
    *   **"Clear Cart" Button Click:** Calls `onClearCart(cart.id)` after a confirmation dialog.
    *   **"Proceed to Checkout" Button Click:** Currently logs a message and shows an alert (placeholder).
*   **Styling:** Basic inline styles for layout and appearance.

## 4. `CartItem.js`

*   **Location:** `client/src/components/cart/CartItem.js`
*   **Purpose:** Displays a single item within the shopping cart list on the `CartPage`.
*   **JSX Structure:**
    *   Rendered as a table row (`<tr>`).
    *   Displays product image (placeholder), name, unit price (`price_at_addition`).
    *   Includes an input field (type number) for quantity, along with "+" and "-" buttons for easier quantity adjustment.
    *   Displays the calculated line item total.
    *   Includes a "Remove" button.
*   **Props:**
    *   `item` (object): An object representing the cart item, expected to have a structure like:
        ```javascript
        {
          item_id: 'cart-item-uuid', // or 'id'
          product_id: 'product-uuid',
          product_name: 'Product Name',
          product_image_urls: [{ url: '...' }], // Optional
          quantity: 2,
          price_at_addition: 25.00,
          line_item_total: 50.00 
        }
        ```
    *   `onUpdateQuantity` (function): Callback executed when the quantity is changed (via input field or +/- buttons). Signature: `(itemId, newQuantity) => void`.
    *   `onRemoveItem` (function): Callback executed when the "Remove" button is clicked. Signature: `(itemId) => void`.
*   **Interactions:**
    *   **Quantity Input Change:** Updates local component state for quantity and calls `onUpdateQuantity`. If quantity becomes <= 0, it calls `onRemoveItem` (or `onUpdateQuantity` with 0, depending on how parent handles it).
    *   **"+/-" Button Click:** Modifies local quantity and calls `onUpdateQuantity`. If quantity becomes 0 via "-", calls `onRemoveItem`.
    *   **"Remove" Button Click:** Calls `onRemoveItem(item.item_id)`.
*   **Styling:** Basic inline styles for layout within the table row.

These components form the structural basis for the shopping cart interface. State management (e.g., using Context API, Redux, Zustand) and API integration will be required in subsequent development phases to make them functional.
```
