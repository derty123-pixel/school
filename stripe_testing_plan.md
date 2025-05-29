# Stripe Payment Gateway Integration: Manual Testing Plan (Test Mode)

This document outlines the manual testing plan for verifying the Stripe payment gateway integration within the application. All tests should be performed in Stripe's **Test Mode**.

## 1. Prerequisites & Setup

Before starting any test cases, ensure the following are in place:

1.  **Stripe Account:**
    *   A Stripe account exists and is accessible.
    *   The account is switched to **Test Mode** in the Stripe Dashboard.

2.  **API Keys:**
    *   **Test Publishable Key** (e.g., `pk_test_xxxxxxxxxxxxxx`): Correctly configured in the frontend application's environment variables (e.g., `REACT_APP_STRIPE_PUBLISHABLE_KEY`).
    *   **Test Secret Key** (e.g., `sk_test_xxxxxxxxxxxxxx`): Correctly configured in the backend application's environment variables (e.g., `STRIPE_SECRET_KEY`).

3.  **Webhook Endpoint:**
    *   **Webhook Signing Secret** (e.g., `whsec_xxxxxxxxxxxxxx`): Obtained from the Stripe Dashboard (when setting up the webhook endpoint) and configured in the backend environment variables (e.g., `STRIPE_WEBHOOK_SECRET`).
    *   **Local Webhook Forwarding:** A method to forward Stripe webhook events to the local development backend is active. The recommended tool is the Stripe CLI:
        ```bash
        stripe listen --forward-to localhost:YOUR_BACKEND_PORT/api/payments/stripe-webhooks
        ```
        (Replace `YOUR_BACKEND_PORT` with the actual port your backend server is running on, e.g., 3001).

4.  **Application State:**
    *   The frontend and backend applications are running locally or in a test environment.
    *   There are existing products in the product catalog that can be added to the cart.
    *   A test user account is available for logging in.

5.  **Stripe Test Cards:**
    *   Have a list of Stripe's international test card numbers available for simulating various scenarios (successful payments, declines, 3D Secure, etc.). Refer to Stripe's documentation for these card numbers.

## 2. Test Cases

### Test Case 1: Successful Payment Flow (Happy Path)

*   **Objective:** Verify a complete successful payment transaction from cart to order confirmation.
*   **Steps:**
    1.  Log in to the application using the test user account.
    2.  Navigate to product listings and add one or more items to the shopping cart.
    3.  Proceed to the checkout page.
    4.  Fill in valid shipping and billing address details.
    5.  Proceed to the payment step.
    6.  Verify that the Stripe Card Element (payment form) loads correctly.
    7.  Enter a standard Stripe test card number for successful payments (e.g., `4242` repeated).
    8.  Enter a valid future expiry date (e.g., 12/30).
    9.  Enter a valid CVC (e.g., 123).
    10. Enter a cardholder name.
    11. Click the "Pay" or "Submit Payment" button.
*   **Expected Frontend Behavior:**
    1.  The "Pay" button shows a loading/processing state.
    2.  No client-side validation errors are displayed by Stripe.js for the card details.
    3.  After a short processing time, the user is navigated to the Order Confirmation page.
    4.  The Order Confirmation page displays:
        *   A success message (e.g., "Thank You For Your Order!").
        *   The correct order number.
        *   A summary of the ordered items and the correct total amount.
        *   The shipping address provided.
        *   The order status shown should be 'confirmed' or 'processing' (or 'pending_payment' if the webhook is significantly delayed, which should be noted).
    5.  Navigate to the shopping cart page or view the cart icon: the cart should now be empty or reflect a new, empty cart session.
*   **Expected Backend Behavior (Verify via logs, database inspection, and Stripe Dashboard):**
    1.  **Order Creation:**
        *   `POST /api/orders/from-cart` is called successfully when the user proceeds from address entry to payment preparation.
        *   A new order is created in the `orders` table with `order_status: 'pending_payment'`.
        *   `order_items` are correctly associated with this order.
    2.  **PaymentIntent Creation:**
        *   `POST /api/payments/create-payment-intent` is called successfully by the frontend before rendering the Stripe form.
        *   The `orders` table record is updated with the `payment_intent_id`, `payment_gateway: 'stripe'`, and `payment_status` (e.g., 'requires_payment_method').
        *   A `client_secret` for the PaymentIntent is returned to the frontend.
    3.  **Stripe Webhook Processing:**
        *   The Stripe CLI (`stripe listen...`) shows a `payment_intent.succeeded` event being received.
        *   The backend webhook handler (`POST /api/payments/stripe-webhooks`) successfully verifies the event signature.
        *   The order associated with the `payment_intent.id` (or `metadata.order_id`) in the `orders` table is updated:
            *   `order_status` changes from 'pending_payment' to 'confirmed' (or 'processing').
            *   `payment_status` changes to 'succeeded'.
    4.  **Client-Side Confirmation Poll (Optional but Recommended):**
        *   After `stripe.confirmCardPayment()` succeeds on the client, the client calls `POST /api/orders/{orderId}/confirm-payment`.
        *   This backend endpoint fetches and returns the order, which by this time, should ideally reflect the status updated by the webhook.
    5.  **Stripe Dashboard:**
        *   A new PaymentIntent is visible with status "Succeeded".
        *   The payment details (amount, currency, metadata including `order_id`) are correct.
        *   An event for `payment_intent.succeeded` is logged.

### Test Case 2: Payment Declined by Stripe

*   **Objective:** Verify graceful handling of a declined payment.
*   **Steps:**
    1.  Follow steps 1-6 from Test Case 1.
    2.  Enter a Stripe test card number that simulates a generic decline (e.g., a card for "Insufficient Funds" or "Generic Decline" from Stripe's test card list).
    3.  Enter a valid future expiry date and CVC.
    4.  Enter a cardholder name.
    5.  Click the "Pay" or "Submit Payment" button.
*   **Expected Frontend Behavior:**
    1.  The "Pay" button shows a loading/processing state briefly.
    2.  An appropriate error message from Stripe (e.g., "Your card was declined.") is displayed directly on or near the payment form.
    3.  The user remains on the payment step of the checkout process.
    4.  The user can attempt to enter different card details or retry.
    5.  The shopping cart contents remain unchanged. No order confirmation is shown.
*   **Expected Backend Behavior:**
    1.  Order Creation and PaymentIntent Creation (steps 1 & 2 from Test Case 1 backend behavior) occur as usual. The order is 'pending_payment'.
    2.  **Stripe Webhook Processing:**
        *   The Stripe CLI shows a `payment_intent.payment_failed` event being received.
        *   The backend webhook handler verifies the event.
        *   The order associated with the PaymentIntent in the `orders` table is updated:
            *   `order_status` might be updated to 'payment_failed'.
            *   `payment_status` is updated to 'failed' (or the specific failure reason/status from Stripe).
    3.  **Stripe Dashboard:**
        *   The PaymentIntent shows status "Failed" or "Incomplete" with the reason for decline.
        *   An event for `payment_intent.payment_failed` is logged.

### Test Case 3: Invalid Card Details (Client-Side Validation)

*   **Objective:** Verify Stripe.js client-side validation for incorrect card information.
*   **Steps:**
    1.  Follow steps 1-6 from Test Case 1.
    2.  In the Stripe Card Element:
        *   Attempt 1: Enter an obviously invalid card number (e.g., "1234").
        *   Attempt 2: Enter a valid format card number but with a past expiry date.
        *   Attempt 3: Enter a valid card number and future expiry date, but an incomplete CVC.
*   **Expected Frontend Behavior:**
    1.  For each attempt, Stripe.js (via the Card Element) should display real-time validation errors directly next to or within the input fields (e.g., "Your card number is invalid," "Your card's expiration date is in the past.").
    2.  The "Pay" button might be disabled by the form's logic if errors are present, or if clicked, the `stripe.confirmCardPayment()` call should ideally not be made by the form's submit handler if Stripe Elements indicate invalid inputs. If it is made, Stripe.js should return an immediate client-side error before hitting the Stripe API.

### Test Case 4: Webhook Signature Verification Failure (Simulated)

*   **Objective:** Ensure the backend correctly rejects webhook events with invalid signatures.
*   **Steps:** (This is an advanced test and may require custom tooling like Postman or cURL).
    1.  Construct a POST request to the backend webhook endpoint (`/api/payments/stripe-webhooks`).
    2.  Use a sample Stripe event payload (e.g., a `payment_intent.succeeded` JSON body).
    3.  Provide an invalid or missing `Stripe-Signature` header. This can be done by:
        *   Not including the header.
        *   Using an incorrect webhook signing secret to generate a signature.
        *   Altering the payload after the signature is generated but before sending.
*   **Expected Backend Behavior:**
    1.  The webhook handler attempts to verify the signature.
    2.  Signature verification fails.
    3.  The endpoint returns an HTTP `400 Bad Request` error.
    4.  No order status updates or other processing actions occur based on this invalid request.
    5.  Logs should indicate a signature verification failure.

### Test Case 5: Idempotency of `payment_intent.succeeded` Webhook

*   **Objective:** Verify that processing the same `payment_intent.succeeded` event multiple times does not lead to duplicate actions (e.g., multiple order confirmations, multiple inventory deductions).
*   **Steps:**
    1.  Complete a successful payment flow as in Test Case 1. Note the `event_id` from the Stripe CLI for the `payment_intent.succeeded` event.
    2.  Verify in the database that the order status is 'confirmed' (or 'processing').
    3.  Using the Stripe Dashboard (Test Mode -> Developers -> Events -> find the event) or the Stripe CLI (`stripe events resend <event_id>`), resend the *exact same* `payment_intent.succeeded` event to your webhook endpoint.
*   **Expected Backend Behavior:**
    1.  The webhook handler receives the resent event and successfully verifies its signature.
    2.  The handler retrieves the order associated with the PaymentIntent.
    3.  It checks the current `order_status`. Since the order is already 'confirmed' (or a subsequent state like 'processing'/'shipped'), it recognizes that this event has likely been processed.
    4.  The handler logs this (e.g., "Order already processed for PI. Idempotency check passed.") and returns a `200 OK` response to Stripe.
    5.  No duplicate order status updates, email notifications, or other critical actions occur. The database state remains consistent.

### Test Case 6 (Optional): 3D Secure / SCA Flow

*   **Objective:** Verify handling of payments requiring Strong Customer Authentication (SCA), like 3D Secure.
*   **Steps:**
    1.  Follow steps 1-6 from Test Case 1.
    2.  Use a Stripe test card that specifically triggers a 3D Secure authentication challenge (refer to Stripe documentation for such cards).
    3.  Enter valid expiry, CVC, and cardholder name.
    4.  Click "Pay".
*   **Expected Frontend Behavior:**
    1.  After clicking "Pay", Stripe.js should automatically trigger the 3D Secure flow, typically by displaying a modal or redirecting to a mock authentication page provided by Stripe for test cards.
    2.  User interacts with the mock authentication (e.g., clicks "Complete Authentication").
    3.  If authentication is successful, the modal closes/redirect returns, and `stripe.confirmCardPayment()` resolves successfully.
    4.  The flow then proceeds as in Test Case 1 (navigation to Order Confirmation, etc.).
    5.  If authentication fails, `stripe.confirmCardPayment()` returns an error, which should be displayed on the payment form.
*   **Expected Backend Behavior:**
    1.  Similar to Test Case 1. The `payment_intent.succeeded` webhook is only sent *after* the 3D Secure authentication is successfully completed by the user. The PaymentIntent status might go through intermediate states like `requires_action` before `succeeded`.

## 3. Data to Verify for Each Test Case

For each test case, the following areas should be checked:

*   **Frontend User Interface:**
    *   Correct display of messages (success, error, validation).
    *   Navigation flow (e.g., to order confirmation, or staying on payment page).
    *   Cart status (emptied after successful order).
    *   Button states (disabled during processing).
*   **Backend Database:**
    *   **`orders` table:** `order_status`, `payment_intent_id`, `payment_status`, `payment_gateway`, `order_total`.
    *   **`order_items` table:** Correct items, quantities, and prices recorded.
*   **Backend Application Logs:**
    *   Successful processing of requests.
    *   Webhook event reception and verification logs.
    *   Any error messages or stack traces.
    *   Idempotency handling logs.
*   **Stripe Dashboard (Test Mode):**
    *   PaymentIntent status (succeeded, failed, requires_action, etc.).
    *   Payment details (amount, currency, metadata).
    *   Associated events (e.g., `payment_intent.created`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.succeeded`).
    *   Webhook delivery attempts and success/failure logs from Stripe's perspective.
*   **Browser Developer Console:**
    *   Any client-side errors from Stripe.js or application logic.
    *   Network requests to backend and Stripe API (inspect payloads and responses).

This comprehensive testing plan should help ensure the Stripe integration is robust, handles various scenarios correctly, and maintains data integrity.
```
