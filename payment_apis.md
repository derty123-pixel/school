# Payment APIs (Stripe Integration - MVP)

This document describes the API endpoint(s) related to payment processing, specifically for creating Stripe PaymentIntents and handling Stripe webhooks.

## 1. Prerequisites & Assumptions

*   **Stripe Account:** A Stripe test account is set up, and Test Publishable/Secret keys are available.
*   **Environment Variables:**
    *   The Stripe Secret Key is configured as `STRIPE_SECRET_KEY` in the backend environment.
    *   The Stripe Webhook Signing Secret (for verifying webhook events) is configured as `STRIPE_WEBHOOK_SECRET` in the backend environment.
*   **Authentication:** Users must be authenticated (`JWT` via `Authorization: Bearer <token>`) to create PaymentIntents for their orders. The `protect` middleware handles this. Webhook endpoint is public but verified.
*   **Order Existence:** An order must already exist (typically created via `POST /api/orders/from-cart`) and be in a state suitable for payment (e.g., 'pending_payment') for PaymentIntent creation.
*   **Currency:** For MVP, the currency is assumed to be 'usd'. This should be made configurable in a production system.
*   **`orders` Table Schema:** The `orders` table must have the following columns (as defined in `order_management_schema.sql`):
    *   `payment_intent_id` (TEXT, UNIQUE, Nullable): To store the Stripe PaymentIntent ID.
    *   `payment_gateway` (TEXT, Nullable): To store 'stripe'.
    *   `payment_status` (TEXT, Nullable): To store the status from the PaymentIntent (e.g., 'requires_payment_method', 'succeeded').
    *   `order_status` (`order_status_enum`): To store the lifecycle status of the order.

## 2. API Endpoints

### 2.1. Create or Retrieve Stripe PaymentIntent

*   **Endpoint:** `POST /api/payments/create-payment-intent`
*   **Description:** Creates a new Stripe PaymentIntent for a given order or retrieves an existing, usable one. This endpoint is called by the frontend when it's ready to initialize Stripe Elements for payment collection. The `client_secret` returned is used by the frontend to confirm the payment with Stripe.
*   **Access:** Private (Authenticated User required)
*   **Request Body (JSON):**
    ```json
    {
      "orderId": "your-order-uuid"
    }
    ```
*   **Validation:**
    *   `orderId`: Required, must be a valid UUID.
*   **Logic Summary:**
    1.  Authenticates the user and verifies order ownership and status.
    2.  If a valid, unpaid `payment_intent_id` exists for the order on Stripe, its `client_secret` is returned.
    3.  Otherwise, a new PaymentIntent is created with Stripe (amount from `order.order_total`, currency 'usd', metadata including `order_id`).
    4.  The new `PaymentIntent.id` and `status` are saved to the corresponding `orders` record.
    5.  The `client_secret` from the PaymentIntent is returned.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "New PaymentIntent created." // or "Existing PaymentIntent retrieved."
      "clientSecret": "pi_xxxx_secret_xxxx", 
      "paymentIntentId": "pi_xxxx" 
    }
    ```
*   **Error Responses:** `400` (Bad Request), `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `500` (Internal Server Error).

### 2.2. Handle Stripe Webhook Events

*   **Endpoint:** `POST /api/payments/stripe-webhooks`
*   **Description:** Receives and processes webhook events sent from Stripe. This is crucial for reliably updating order status based on payment events, especially for asynchronous payment methods or events occurring after the initial transaction.
*   **Access:** Public (Webhook events come from Stripe servers, not a logged-in user. Security is handled by verifying the Stripe signature).
*   **Request Body:** Raw JSON payload sent by Stripe.
*   **Middleware Requirement:** This specific route uses `express.raw({ type: 'application/json' })` middleware *before* any global `express.json()` parser. This is essential because Stripe's signature verification requires the raw, unparsed request body.
*   **Signature Verification:**
    *   The endpoint retrieves the raw request body (`req.body`) and the `Stripe-Signature` header (`req.headers['stripe-signature']`).
    *   It uses `stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)` to verify the event's authenticity.
    *   If verification fails, a `400 Bad Request` is returned to Stripe.
*   **Event Handling Logic (within `payment.service.js`):**
    *   A `switch (event.type)` statement handles different event types:
        *   **`payment_intent.succeeded`:**
            *   The `PaymentIntent` object is extracted from `event.data.object`.
            *   The corresponding order is found in the database (using `paymentIntent.id` or `paymentIntent.metadata.order_id`).
            *   **Idempotency:** If the order is already 'confirmed' (or a later state), the event is acknowledged with a `200 OK` but no further processing occurs.
            *   Otherwise, the order's `order_status` is updated to 'confirmed' (or 'processing') and `payment_status` is updated to `paymentIntent.status` ('succeeded').
            *   (Future work: Trigger email notifications, inventory updates, fulfillment processes).
        *   **`payment_intent.payment_failed`:**
            *   The `PaymentIntent` object is extracted.
            *   The corresponding order is found.
            *   The order's `order_status` is updated to 'payment_failed', and `payment_status` is updated.
            *   (Future work: Notify user about the payment failure).
        *   **`default`:** Unhandled event types are logged.
    *   Database updates are performed within a transaction.
*   **Success Response (to Stripe):**
    *   After successfully processing the event (or acknowledging an already processed event), the endpoint returns a `200 OK` with `{ "received": true }`. This acknowledges to Stripe that the event was received and processed, preventing Stripe from resending it.
*   **Error Response (to Stripe):**
    *   If signature verification fails: `400 Bad Request`.
    *   If an internal error occurs during processing that should cause Stripe to retry: `500 Internal Server Error`. (Careful: if the error is due to bad data that won't resolve on retry, a `4xx` might be better if it means Stripe should stop sending for that specific event).
*   **Testing Webhooks Locally:**
    *   Use the **Stripe CLI** (`stripe listen --forward-to localhost:<your_port>/api/payments/stripe-webhooks`).
    *   The CLI provides a webhook signing secret for local testing.
    *   Trigger test events from the Stripe Dashboard or using `stripe trigger <event_type>`.

This webhook endpoint ensures that the application can reliably react to payment events from Stripe, keeping order statuses synchronized and enabling automated post-payment workflows.
```
