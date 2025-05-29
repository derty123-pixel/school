# Frontend Stripe.js & Elements Integration for Checkout

This document details how Stripe.js and Stripe Elements are integrated into the React frontend checkout flow to collect payment information securely, handle client-side payment confirmation with Stripe, and then synchronize with the backend for order finalization, where webhooks are the primary source of truth for payment-related status updates.

## 1. Dependencies

*   **`@stripe/stripe-js`**: Core Stripe.js library.
*   **`@stripe/react-stripe-js`**: React specific wrapper components and hooks.

## 2. `CheckoutContext.js` for Stripe

*   **State:** Manages `stripePromise`, `stripe` (Stripe object), `clientSecret`, `isPreparingPayment` (for creating pending order & fetching client secret), `isProcessingOrder` (for when client is awaiting backend status after Stripe.js success), `stripeError`, `placedOrderId`, and `placedOrderDetails`. The `orderSummary` stores `orderId` (of the pending order).
*   **Actions:**
    *   `preparePayment(cartContextState)`: Creates a pending order via `POST /api/orders/from-cart` to get `orderId`, then initializes Stripe.js, and calls `POST /api/payments/create-payment-intent` with `orderId` to fetch `clientSecret`. Updates context state with `orderId`, `clientSecret`, `stripeInstance`, and `stripePromiseInstance`.
    *   `fetchOrderStatusAfterClientPayment(orderId)`: (Previously `confirmOrderOnBackend`) Called *after* successful client-side Stripe payment confirmation. Calls `POST /api/orders/{orderId}/confirm-payment` (which now just fetches the latest order status from the backend). Updates context state with `placedOrderId` and `placedOrderDetails`.
    *   `setStripeError(errorMessage)` / `clearStripeError()`: Manage Stripe-specific error messages.
    *   `resetCheckoutState()`: Resets the checkout context, called after successful navigation to order confirmation.

## 3. `StripePaymentForm.js` Component

*   **Purpose:** Securely collects card details using Stripe Elements and handles the client-side payment confirmation with Stripe.
*   **Key Features:**
    *   Uses `useStripe()` and `useElements()` hooks.
    *   Renders Stripe's `CardElement`.
    *   **Payment Submission (`handleSubmit`):**
        1.  Calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card: CardElement, ... } })`.
        2.  **On `confirmCardPayment` Success (`paymentIntent.status === 'succeeded'`):** Calls `onPaymentSuccess(paymentIntent)` prop.
        3.  **On `confirmCardPayment` Failure:** Sets error in `CheckoutContext` via `setStripeError` and calls `onPaymentFailure(error)` prop.
*   **Props:** `clientSecret`, `onPaymentSuccess`, `onPaymentFailure`.

## 4. `CheckoutPage.js` Orchestration

*   **Payment Preparation:**
    *   When the user reaches the payment step, `CheckoutPage` calls `preparePayment(cartState)` from `CheckoutContext`.
*   **Rendering Payment Form:**
    *   Uses the `<Elements>` provider, passing `stripe={checkoutState.stripePromise}` and `options={{ clientSecret: checkoutState.clientSecret }}`.
    *   `StripePaymentForm` is rendered within, receiving `clientSecret`, `onPaymentSuccess`, and `onPaymentFailure` as props.
*   **Handling Callbacks from `StripePaymentForm`:**
    *   **`handlePaymentSuccess(paymentIntent)`:**
        1.  Logs client-side Stripe success.
        2.  Calls `fetchOrderStatusAfterClientPayment(orderSummary.orderId)` (from `CheckoutContext`). This action makes the `POST /api/orders/{orderId}/confirm-payment` call to the backend to get the latest order status.
        3.  **After `fetchOrderStatusAfterClientPayment` succeeds:**
            *   The returned `latestOrderDetails` (which might have been updated by a webhook) is used for the confirmation page.
            *   Calls `reloadCartAfterOrder()` (from `CartContext`) to clear/reset the user's cart.
            *   Navigates to `OrderConfirmationPage` with `latestOrderDetails`.
            *   Calls `resetCheckoutState()`.
        4.  If `fetchOrderStatusAfterClientPayment` fails, an error is set in `CheckoutContext` and displayed.
    *   **`handlePaymentFailure(stripeJsError)`:**
        *   Logs the Stripe.js payment failure. The error is already set in `checkoutState.stripeError` by `StripePaymentForm`.
*   **UI Feedback:**
    *   Displays "Preparing payment options..." when `checkoutState.isPreparingPayment` is true.
    *   Displays "Processing Order..." or similar when `checkoutState.isProcessingOrder` (during `fetchOrderStatusAfterClientPayment`) is true.
    *   Displays `checkoutState.stripeError` or `checkoutState.error`.

## 5. Overall Post-Payment Flow Summary

1.  **User reaches payment step on `CheckoutPage.js`.**
2.  `CheckoutPage.js` calls `preparePayment()`:
    *   `CheckoutContext`: `POST /api/orders/from-cart` (creates pending order, gets `orderId`).
    *   `CheckoutContext`: Initializes Stripe.js.
    *   `CheckoutContext`: `POST /api/payments/create-payment-intent` with `orderId` (gets `clientSecret`).
    *   `CheckoutContext`: Updates state with `stripePromise`, `stripe` instance, `clientSecret`, and `orderId`.
3.  `CheckoutPage.js` renders `StripePaymentForm` within `<Elements>` provider.
4.  User submits payment in `StripePaymentForm.js`.
5.  `StripePaymentForm.js` calls `stripe.confirmCardPayment()`.
    *   **If Stripe.js confirms payment successfully (`paymentIntent.status === 'succeeded'`):** `onPaymentSuccess(paymentIntent)` callback is triggered.
    *   **If Stripe.js fails:** `onPaymentFailure(error)` callback is triggered; error displayed.
6.  `CheckoutPage.js`'s `handlePaymentSuccess(paymentIntent)` callback is executed:
    *   Calls `fetchOrderStatusAfterClientPayment(orderSummary.orderId)`.
        *   `CheckoutContext`: `POST /api/orders/{orderId}/confirm-payment` (backend fetches and returns current order status).
        *   `CheckoutContext`: Updates state with `placedOrderDetails`.
    *   Calls `reloadCartAfterOrder()` (from `CartContext`).
    *   Calls `resetCheckoutState()`.
    *   Navigates to `OrderConfirmationPage` with `placedOrderDetails`.
7.  **Backend Stripe Webhook (`payment_intent.succeeded`):**
    *   Independently receives the success event from Stripe.
    *   **Updates the order status to 'confirmed' or 'processing'. This is the authoritative update.**
    *   (Future: Triggers emails, inventory deduction, etc.)
8.  `OrderConfirmationPage.js` displays order details. The status shown will be the one fetched by `fetchOrderStatusAfterClientPayment`, which ideally reflects the webhook update if the webhook was fast. If not, it might initially show 'pending_payment' (or whatever status was current before webhook processing), but a subsequent refresh or visit to order history would show the webhook-updated status.

This refined flow makes the Stripe webhook the source of truth for payment success impacting order status, while the client-side confirmation provides immediate feedback and fetches the latest known status for the user.
```
