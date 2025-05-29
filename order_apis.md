# Checkout & Order APIs (MVP)

This document describes the API endpoints for Checkout and Order Management, built with Node.js/Express.js and PostgreSQL. These APIs handle the conversion of a shopping cart into an order and managing basic order lifecycle, with Stripe webhooks as the primary source of truth for payment-related status updates.

## 1. Key Assumptions & Pre-requisites

*   **Authentication:** Users must be authenticated (`JWT` via `Authorization: Bearer <token>`) to access order creation and their order history. The `protect` middleware handles this.
*   **Cart Context:** The `POST /api/orders/from-cart` endpoint relies on the `ensureCart` middleware (from the Cart module) to identify and provide the user's current cart (`req.cart`). The client should send the `X-Cart-ID` header if it's a guest cart being converted upon login or if the user's cart ID is managed this way.
*   **Payment Simulation & Webhooks:** Actual payment gateway integration with Stripe is assumed. The `POST /api/orders/{orderId}/confirm-payment` endpoint is now a client-side status check, while the `POST /api/payments/stripe-webhooks` endpoint is the primary mechanism for confirming payment success and updating order status.
*   **Inventory:** Inventory deduction from `product_inventory` is not implemented in this phase but would be a critical next step after payment confirmation via webhook.
*   **Addresses:** The `POST /api/orders/from-cart` endpoint expects `shippingAddress` and `billingAddress` objects in the request body. These are stored as JSONB.
    ```json
    // Example Address Object Structure (flexible due to JSONB)
    {
      "street": "123 Main St",
      "apartment": "Apt 4B", // Optional
      "city": "Anytown",
      "state": "CA", // Or province
      "postalCode": "90210",
      "country": "USA",
      "fullName": "John Doe", // Recommended
      "phoneNumber": "555-1234" // Recommended
    }
    ```

## 2. API Endpoints

All endpoints are prefixed with `/api/orders`.

### 2.1. Create Order from Cart (Initiate Checkout)

*   **Endpoint:** `POST /api/orders/from-cart`
*   **Description:** Converts the current user's active shopping cart into a pending order. This is the first step in the checkout process before payment details are collected.
*   **Access:** Private (Authenticated User required)
*   **Middleware:** `protect`, `ensureCart`
*   **Request Body (JSON):**
    ```json
    {
      "shippingAddress": { /* ... address object ... */ },
      "billingAddress": { /* ... address object ... */ }
    }
    ```
*   **Logic:**
    1.  Verifies authenticated user and active cart with items.
    2.  Generates a unique `order_number`.
    3.  Calculates `subtotal` and `order_total` from cart items (`price_at_addition` is used). (Shipping, taxes, discounts are placeholders/zero for MVP).
    4.  In a database transaction:
        *   Creates a new record in the `orders` table with status 'pending_payment', user details, cart ID, totals, and provided addresses.
        *   Copies items from `cart_items` (via `req.cart.items`) to `order_items`, linking them to the new order. It records `price_paid_per_unit` and snapshots current `product_name_at_order` and `product_sku_at_order`.
    5.  The `shopping_carts.id` has a UNIQUE constraint in the `orders` table, preventing a cart from being converted twice.
*   **Success Response (201 Created):** Returns the newly created order object, including its ID and initial 'pending_payment' status.
    ```json
    {
      "message": "Order created successfully, pending payment.",
      "order": { /* ... full order object with items ... */ }
    }
    ```
*   **Error Responses:** `400` (Bad Request), `401` (Unauthorized), `409` (Conflict - cart already ordered), `500` (Internal Server Error).

### 2.2. Client Polls for Order Status After Payment Attempt (Previously Confirm Payment)

*   **Endpoint:** `POST /api/orders/{orderId}/confirm-payment`
    *   *(Note: While path remains `confirm-payment` for compatibility with previous step, its role has changed. A `GET /api/orders/{orderId}/status-after-payment` might be more semantically correct for future iterations.)*
*   **Description:** This endpoint is called by the client *after* Stripe.js has indicated a successful client-side payment interaction (e.g., `paymentIntent.status === 'succeeded'` from `stripe.confirmCardPayment`). Its purpose is to allow the client to fetch the most up-to-date order status from the backend, which may have been updated by a Stripe webhook. **This endpoint itself no longer changes the order status related to payment.**
*   **Access:** Private (Authenticated User who owns the order, or Admin)
*   **URL Parameters:**
    *   `orderId` (UUID): The ID of the order.
*   **Request Body:** Empty.
*   **Logic:**
    1.  Finds the order by `orderId`.
    2.  Verifies ownership (user ID matches or user is admin).
    3.  Logs that the client has reported a successful payment interaction (optional).
    4.  Fetches and returns the complete, current order details (including `order_status` and `items`).
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Client payment reported. Current order details retrieved.",
      "order": { /* ... full order object with its current status and items ... */ }
    }
    ```
*   **Error Responses:** `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `500` (Internal Server Error).

### 2.3. Get Order Details

*   **Endpoint:** `GET /api/orders/{orderId}`
*   **Description:** Retrieves details for a specific order, including its items.
*   **Access:** Private (Authenticated User who owns the order, or Admin)
*   **URL Parameters:**
    *   `orderId` (UUID): The ID of the order to retrieve.
*   **Success Response (200 OK):**
    ```json
    { /* ... full order object with items ... */ }
    ```
*   **Error Responses:** `401`, `403`, `404`, `500`.

### 2.4. List User's Orders

*   **Endpoint:** `GET /api/orders`
*   **Description:** Retrieves a paginated list of orders for the currently authenticated user.
*   **Access:** Private (Authenticated User required)
*   **Query Parameters (Optional):**
    *   `page` (integer, default: 1).
    *   `limit` (integer, default: 10).
*   **Success Response (200 OK):**
    ```json
    {
      "orders": [ /* ... array of order summary objects ... */ ],
      "pagination": { /* ... pagination details ... */ }
    }
    ```
*   **Error Responses:** `400` (Bad Request), `401`, `500`.

## 3. Webhook-Driven Order Confirmation

*   The `POST /api/payments/stripe-webhooks` endpoint remains the **primary authority** for updating an order's status upon successful payment (e.g., to 'confirmed' or 'processing' when a `payment_intent.succeeded` event is received from Stripe).
*   This ensures reliability even if the client disconnects after payment or if there are other client-side issues.
*   The client-side flow (calling `/api/orders/{orderId}/confirm-payment`) provides immediate feedback, but the webhook is the definitive trigger for backend fulfillment processes.

This refined flow separates the client's immediate feedback mechanism from the authoritative backend update triggered by Stripe webhooks, leading to a more robust payment and order processing system.
```
