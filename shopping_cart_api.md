# Shopping Cart API (MVP)

This document describes the API endpoints for the Shopping Cart Module, built with Node.js/Express.js and PostgreSQL. This module handles cart creation and management for both guest and authenticated users.

## 1. Cart Identification & Management Strategy

*   **Cart Context Middleware (`ensureCart`):** All routes under `/api/cart` use a dedicated middleware (`ensureCart`) that runs after the optional JWT authentication middleware (`protect`).
    *   The `protect` middleware makes `req.user` available if a valid JWT is sent.
    *   The `ensureCart` middleware is responsible for:
        1.  Identifying the user: If `req.user` exists, it's a logged-in user. Otherwise, it's a guest.
        2.  **Cart ID from Client (for Guests):** Guest clients should send an `X-Cart-ID` header with the ID of their current cart (if they have one).
        3.  **User Cart Logic:**
            *   If `req.user` exists:
                *   The system attempts to retrieve the user's most recently updated active cart from the database.
                *   **Cart Merging:** If the user also had an `X-Cart-ID` (from a previous guest session), the items from this guest cart are merged into the user's primary cart, and the guest cart is then deleted. The client is informed via an `X-Cart-Merged-To: <user_cart_id>` header.
                *   **Guest Cart Assignment:** If the user has no cart but an `X-Cart-ID` is provided, the guest cart is assigned to the user.
                *   If no cart exists for the user and no valid guest cart is provided, a new cart is created for the user.
        4.  **Guest Cart Logic:**
            *   If no `req.user`:
                *   If a valid `X-Cart-ID` (representing a guest cart with `user_id IS NULL`) is provided, that cart is used.
                *   If no `X-Cart-ID` is provided, or if the provided ID is invalid or belongs to another user, a new guest cart (with `user_id IS NULL`) is created.
        5.  **Response Header `X-Cart-ID`:** For all responses on cart routes, the server will include an `X-Cart-ID` header containing the ID of the cart that was used or created for the current request. Guest clients **must** store this ID and send it back in the `X-Cart-ID` header for subsequent requests to maintain cart persistence. Logged-in users' carts are primarily tied to their user ID, but the header is still sent.
        6.  The middleware attaches the determined (or created) cart object as `req.cart` for use by controllers and services.

## 2. API Endpoints

All endpoints are prefixed with `/api/cart`. The `protect` and `ensureCart` middlewares are applied to all of them.

### 2.1. Get Cart Contents

*   **Endpoint:** `GET /api/cart`
*   **Description:** Retrieves the full contents of the current user's or guest's shopping cart, including all items and calculated totals. The `ensureCart` middleware handles cart creation/retrieval before this controller action.
*   **Access:** Public (context-aware: works for guest or authenticated user)
*   **Headers (for Guests):** `X-Cart-ID: <guest_cart_id_if_any>`
*   **Headers (for Authenticated Users):** `Authorization: Bearer <user_jwt_token>` (Optional: `X-Cart-ID` if transitioning from guest)
*   **Success Response (200 OK):** The server will always respond with `X-Cart-ID` header.
    ```json
    {
      "id": "cart-uuid",
      "user_id": "user-uuid" // or null for guest cart
      "items": [
        {
          "item_id": "cart-item-uuid",
          "product_id": "product-uuid",
          "product_name": "Laptop Pro",
          "product_sku": "LP123",
          "product_image_urls": [{ "url": "path/to/image.jpg" }],
          "quantity": 1,
          "price_at_addition": 1299.99,
          "line_item_total": 1299.99
        }
        // ... other items
      ],
      "subtotal": 1299.99,
      "total": 1299.99, // Note: Taxes, shipping not included in MVP
      "updated_at": "timestamp"
    }
    ```
*   **Error Responses:**
    *   `500 Internal Server Error`: If cart session management in middleware fails critically.

### 2.2. Add/Update Item in Cart

*   **Endpoint:** `POST /api/cart/items`
*   **Description:** Adds a specified quantity of a product to the cart. If the product already exists in the cart, its quantity is updated (summed with the new quantity). The `price_at_addition` is fetched from the product's current price when added or updated.
*   **Access:** Public (context-aware)
*   **Headers:** (Same as `GET /api/cart`)
*   **Request Body (JSON):**
    ```json
    {
      "productId": "product-uuid-to-add",
      "quantity": 1 
    }
    ```
*   **Validation:**
    *   `productId`: Required, valid UUID.
    *   `quantity`: Required, positive integer.
*   **Success Response (200 OK):** The server will always respond with `X-Cart-ID` header.
    ```json
    {
      "message": "Item added/updated in cart.",
      "cart": { /* ... updated cart object, same structure as GET /api/cart ... */ }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors (e.g., missing fields, invalid UUID, non-positive quantity).
    *   `404 Not Found`: Product specified by `productId` not found or not available.
    *   `500 Internal Server Error`.

### 2.3. Update Cart Item Quantity

*   **Endpoint:** `PUT /api/cart/items/{cartItemId}`
*   **Description:** Updates the quantity of a specific item already in the cart. If quantity is set to 0, the item is removed.
*   **Access:** Public (context-aware)
*   **Headers:** (Same as `GET /api/cart`)
*   **URL Parameters:**
    *   `cartItemId` (UUID): The ID of the cart item to update.
*   **Request Body (JSON):**
    ```json
    {
      "quantity": 2 
    }
    ```
*   **Validation:**
    *   `cartItemId`: Required, valid UUID in URL.
    *   `quantity`: Required, non-negative integer (0 to remove).
*   **Success Response (200 OK):** The server will always respond with `X-Cart-ID` header.
    ```json
    {
      "message": "Cart item quantity updated.",
      "cart": { /* ... updated cart object ... */ }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors.
    *   `404 Not Found`: `cartItemId` not found in the current cart.
    *   `500 Internal Server Error`.

### 2.4. Remove Item from Cart

*   **Endpoint:** `DELETE /api/cart/items/{cartItemId}`
*   **Description:** Removes a specific item from the cart.
*   **Access:** Public (context-aware)
*   **Headers:** (Same as `GET /api/cart`)
*   **URL Parameters:**
    *   `cartItemId` (UUID): The ID of the cart item to remove.
*   **Validation:**
    *   `cartItemId`: Required, valid UUID in URL.
*   **Success Response (200 OK):** The server will always respond with `X-Cart-ID` header.
    ```json
    {
      "message": "Item removed from cart.",
      "cart": { /* ... updated cart object ... */ }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors.
    *   `404 Not Found`: `cartItemId` not found in the current cart.
    *   `500 Internal Server Error`.

### 2.5. Clear Cart

*   **Endpoint:** `DELETE /api/cart`
*   **Description:** Removes all items from the current user's or guest's shopping cart. The cart itself remains for future use.
*   **Access:** Public (context-aware)
*   **Headers:** (Same as `GET /api/cart`)
*   **Success Response (200 OK):** The server will always respond with `X-Cart-ID` header.
    ```json
    {
      "message": "Cart cleared successfully.",
      "cart": { /* ... empty cart object ... */ }
    }
    ```
*   **Error Responses:**
    *   `500 Internal Server Error`.

## 3. Testing Workflow

1.  **Guest User:**
    *   Make a `GET /api/cart` request without any `Authorization` or `X-Cart-ID` header.
    *   The server should respond with an empty cart and an `X-Cart-ID` header. Store this ID.
    *   Make a `POST /api/cart/items` request, including the received `X-Cart-ID` in the request header, to add items.
    *   Verify the response `X-Cart-ID` matches.
    *   Use this `X-Cart-ID` for all subsequent guest operations.
2.  **User Registration/Login:**
    *   Register or log in a user to get a JWT.
3.  **Authenticated User (No Prior Guest Cart):**
    *   Make a `GET /api/cart` request with `Authorization: Bearer <jwt_token>`.
    *   Server responds with a new user-associated cart and an `X-Cart-ID` header.
    *   Use this JWT for subsequent operations. The `X-Cart-ID` header can be ignored by the client if it relies on the JWT, but the server will still send it.
4.  **Authenticated User (With Prior Guest Cart):**
    *   Simulate having items in a guest cart (note the guest `X-Cart-ID`).
    *   Log in the user (get JWT).
    *   Make a `GET /api/cart` request with `Authorization: Bearer <jwt_token>` AND the previous guest `X-Cart-ID` in the `X-Cart-ID` header.
    *   The server should detect the user and the guest cart. It will merge the guest cart items into the user's cart.
    *   The response should include the user's cart ID in `X-Cart-ID` and potentially `X-Cart-Merged-To` indicating the merge target. The old guest cart ID is no longer valid.
    *   Verify items from the guest cart are now in the user's cart.
5.  **Test all CRUD operations** for items (`POST`, `PUT`, `DELETE /items/{id}`) and `DELETE /cart` for both guest and authenticated user scenarios.

This API provides the core functionalities for shopping cart management. Future enhancements would include stock checking during cart operations, handling promotions/discounts, and saving cart for later.
```
