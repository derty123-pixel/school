# Checkout & Order APIs (MVP)

This document describes the API endpoints for Checkout and Order Management, built with Node.js/Express.js and PostgreSQL. These APIs handle the conversion of a shopping cart into an order and managing basic order lifecycle.

## 1. Key Assumptions & Pre-requisites

*   **Authentication:** Users must be authenticated (`JWT` via `Authorization: Bearer <token>`) to access order creation and their order history. The `protect` middleware handles this.
*   **Cart Context:** The `POST /api/orders/from-cart` endpoint relies on the `ensureCart` middleware (from the Cart module) to identify and provide the user's current cart (`req.cart`). The client should send the `X-Cart-ID` header if it's a guest cart being converted upon login or if the user's cart ID is managed this way.
*   **Payment Simulation:** Actual payment gateway integration is out of scope for this MVP. The `/confirm-payment` endpoint simulates a successful payment.
*   **Inventory:** Inventory deduction from `product_inventory` is not implemented in this phase but would be a critical next step after payment confirmation.
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
*   **Description:** Converts the current user's active shopping cart into an order. This is the primary step in the checkout process.
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
        *   Copies items from `cart_items` to `order_items`, linking them to the new order. It records `price_paid_per_unit` and snapshots current `product_name_at_order` and `product_sku_at_order`.
    5.  The `shopping_carts.id` has a UNIQUE constraint in the `orders` table, preventing a cart from being converted twice.
*   **Success Response (201 Created):**
    ```json
    {
      "message": "Order created successfully.",
      "order": {
        "id": "order-uuid",
        "order_number": "ORD-YYYYMMDD-XXXXX",
        "user_id": "user-uuid",
        "cart_id": "cart-uuid-that-was-converted",
        "order_total": 150.99,
        "subtotal": 150.99,
        "shipping_cost": 0.00,
        "taxes_total": 0.00,
        "discount_total": 0.00,
        "shipping_address": { /* ... */ },
        "billing_address": { /* ... */ },
        "order_status": "pending_payment",
        "payment_gateway": null,
        "payment_intent_id": null,
        "payment_status": null,
        "notes_to_customer": null,
        "internal_notes": null,
        "created_at": "timestamp",
        "updated_at": "timestamp",
        "items": [
          {
            "id": "order-item-uuid",
            "product_id": "product-uuid",
            "quantity": 1,
            "price_paid_per_unit": 150.99,
            "product_name_at_order": "Example Product",
            "product_sku_at_order": "SKU123",
            "created_at": "timestamp"
          }
          // ... other items
        ]
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Cart is empty, addresses missing or invalid.
    *   `401 Unauthorized`: User not authenticated.
    *   `409 Conflict`: Cart has already been processed into an order.
    *   `500 Internal Server Error`: Database error or other server issue.

### 2.2. Confirm Payment (Simulated)

*   **Endpoint:** `POST /api/orders/{orderId}/confirm-payment`
*   **Description:** Simulates a successful payment confirmation for an order. In a real scenario, this would be triggered by a webhook from a payment gateway.
*   **Access:** Private (Authenticated User who owns the order, or Admin)
*   **URL Parameters:**
    *   `orderId` (UUID): The ID of the order to confirm payment for.
*   **Request Body:** Empty.
*   **Logic:**
    1.  Finds the order by `orderId`.
    2.  Verifies ownership (user ID matches or user is admin).
    3.  Checks if the current `order_status` is 'pending_payment'.
    4.  Updates `order_status` to 'confirmed' (or 'processing') and sets a mock `payment_status` to 'succeeded'.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Payment confirmed successfully.",
      "order": { /* ... updated full order object, similar to create response, with new status ... */ }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Order status is not 'pending_payment'.
    *   `401 Unauthorized`: User not authenticated.
    *   `403 Forbidden`: User does not own the order and is not an admin.
    *   `404 Not Found`: Order not found.
    *   `500 Internal Server Error`.

### 2.3. Get Order Details

*   **Endpoint:** `GET /api/orders/{orderId}`
*   **Description:** Retrieves details for a specific order, including its items.
*   **Access:** Private (Authenticated User who owns the order, or Admin)
*   **URL Parameters:**
    *   `orderId` (UUID): The ID of the order to retrieve.
*   **Success Response (200 OK):**
    ```json
    { /* ... full order object with items, similar to create response ... */ }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`.
    *   `403 Forbidden`.
    *   `404 Not Found`.
    *   `500 Internal Server Error`.

### 2.4. List User's Orders

*   **Endpoint:** `GET /api/orders`
*   **Description:** Retrieves a paginated list of orders for the currently authenticated user.
*   **Access:** Private (Authenticated User required)
*   **Query Parameters (Optional):**
    *   `page` (integer, default: 1): Page number for pagination.
    *   `limit` (integer, default: 10): Number of orders per page.
*   **Success Response (200 OK):**
    ```json
    {
      "orders": [
        {
          "id": "order-uuid",
          "order_number": "ORD-YYYYMMDD-XXXXX",
          "order_total": 150.99,
          "order_status": "confirmed",
          "created_at": "timestamp",
          "item_count": 1 
        }
        // ... other orders (summary view)
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 3,
        "totalOrders": 25,
        "limit": 10
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid pagination parameters.
    *   `401 Unauthorized`.
    *   `500 Internal Server Error`.

## 3. Testing Notes

*   Ensure a user is authenticated and has a JWT token.
*   Use an existing cart (via `X-Cart-ID` from cart operations or ensure `ensureCart` middleware correctly picks up user's cart).
*   For `POST /api/orders/from-cart`, provide valid `shippingAddress` and `billingAddress` in the JSON body.
*   After creating an order, use its `id` to test payment confirmation and detail retrieval.
*   Verify that a cart ID cannot be used to create a second order.

This API provides the foundational backend logic for converting a cart to an order and managing its basic lifecycle. Further development will involve actual payment gateway integration, inventory management, email notifications, and more complex order status transitions.
```
