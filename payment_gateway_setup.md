# Payment Gateway Setup: Stripe

This document outlines the confirmation of Stripe as the chosen payment gateway provider and the necessary setup requirements for its integration.

## 1. Payment Provider Confirmation

*   **Provider:** **Stripe**
*   **Rationale:** Stripe is selected as the primary payment gateway for the MVP based on the PRD's options (which include Stripe and PayPal). Stripe is chosen for its comprehensive developer tools, excellent documentation, ease of integration (especially with Stripe Elements for PCI compliance), and robust API. It's well-suited for custom eCommerce platforms.

## 2. Stripe Account and API Key Requirements

To integrate Stripe, the following setup is necessary:

1.  **Create a Stripe Account:**
    *   Sign up for a Stripe account at [stripe.com](https://stripe.com).
    *   Initially, development and testing will be done using **Test Mode**.

2.  **Obtain API Keys (Test Mode):**
    *   From the Stripe Dashboard (in Test Mode), you will need to retrieve two essential API keys:
        *   **Test Publishable Key:**
            *   Looks like `pk_test_xxxxxxxxxxxxxx`.
            *   This key is used on the **frontend** with Stripe.js to initialize Stripe and interact with Stripe Elements. It is safe to expose this key in client-side code.
        *   **Test Secret Key:**
            *   Looks like `sk_test_xxxxxxxxxxxxxx`.
            *   This key is used on the **backend** for making API calls to Stripe (e.g., creating PaymentIntents, handling webhooks, managing customers, processing refunds).
            *   **Crucial:** The Secret Key must be kept confidential and secure.

3.  **Secure Storage of API Keys:**
    *   **Publishable Key (Frontend):** Can be embedded directly in frontend JavaScript code or loaded via an environment variable specific to the frontend build process (e.g., `REACT_APP_STRIPE_PUBLISHABLE_KEY`).
    *   **Secret Key (Backend):**
        *   Must **NEVER** be exposed in frontend code or committed to version control.
        *   It should be stored as an **environment variable** on the backend server (e.g., `STRIPE_SECRET_KEY`).
        *   The Node.js application will access it via `process.env.STRIPE_SECRET_KEY`.

4.  **Live Mode Keys:**
    *   After thorough testing in Test Mode, you will need to switch to **Live Mode** in the Stripe Dashboard and obtain a separate set of Live Publishable and Live Secret keys for production use. The same security precautions apply.

## 3. Backend Integration: Stripe Node.js SDK

*   **SDK Installation:** The official Stripe Node.js SDK (`stripe`) needs to be added as a dependency to the backend application.
*   **`package.json` Update:** This has been done by adding the following line to the `dependencies` section of `server/package.json`:
    ```json
    "stripe": "^14.10.0" 
    ```
    *(The version `^14.10.0` is a placeholder for a recent stable version at the time of writing; always check for the latest recommended version on npm or Stripe's documentation.)*
*   **Initialization:** The SDK will be initialized in the backend code using the Stripe Secret Key:
    ```javascript
    // Example in a backend service file (e.g., payment.service.js)
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    ```

## 4. Frontend Integration Plan: Stripe.js and Stripe Elements

*   **Stripe.js:**
    *   The Stripe.js library will be loaded on the frontend. This can be done by including a `<script src="https://js.stripe.com/v3/"></script>` tag in the main HTML file (`public/index.html`) or by installing the `@stripe/stripe-js` npm package.
*   **Stripe Elements:**
    *   For PCI compliance and a customizable user experience, **Stripe Elements** will be used to create secure payment input fields (for card number, expiry, CVC, etc.) directly within the frontend application's checkout form.
    *   Stripe Elements host these fields in iframes, so sensitive payment information is sent directly to Stripe's servers, not touching the application's backend, which significantly simplifies PCI compliance.
    *   The frontend will use the **Publishable Key** to initialize Stripe.js and create Elements instances.
*   **Payment Flow (High-Level):**
    1.  Frontend: Collect payment details using Stripe Elements.
    2.  Frontend: Create a PaymentMethod or tokenize card details using Stripe.js.
    3.  Frontend: Send this PaymentMethod ID (or token) along with order details to the backend.
    4.  Backend: Use the PaymentMethod ID and the Stripe Secret Key to create and confirm a PaymentIntent (or Charge, depending on the integration chosen).

## 5. Webhooks (Future Consideration)

*   For robust payment processing, especially for asynchronous payment methods or to handle events like disputes or successful payouts, Stripe Webhooks will need to be implemented on the backend.
*   This involves creating an API endpoint that Stripe can send events to, and verifying these events using a webhook signing secret provided by Stripe.

This setup provides the foundation for integrating Stripe into the application for payment processing.
```
