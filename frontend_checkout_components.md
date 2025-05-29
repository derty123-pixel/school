# Frontend Checkout Flow Components (React - MVP Structure)

This document outlines the structure and expected props/interactions for the initial set of React components created for the checkout user interface. These components provide the basic JSX structure and placeholders for functionality.

## 1. `CheckoutSteps.js`

*   **Location:** `client/src/components/checkout/CheckoutSteps.js`
*   **Purpose:** Displays the steps in the checkout process (e.g., Shipping, Billing, Review) and highlights the current active step.
*   **JSX Structure:**
    *   Renders a list of steps horizontally.
    *   Applies different styling to the current active step.
*   **Props:**
    *   `currentStep` (string/number): An identifier for the currently active step.
    *   `steps` (array of objects): An array defining the steps. Each object should have at least `id` (unique identifier for the step) and `name` (display name of the step). Example: `[{ id: 'shipping', name: 'Shipping Address' }, ...]`.
*   **Interactions:**
    *   Currently, steps are not clickable for navigation, but this could be an enhancement.
*   **Styling:** Basic inline styles for layout and highlighting the active step.

## 2. `AddressForm.js`

*   **Location:** `client/src/components/checkout/AddressForm.js`
*   **Purpose:** A reusable form for collecting address details (shipping or billing). Includes basic client-side validation.
*   **JSX Structure:**
    *   A standard HTML `<form>` element.
    *   Input fields for full name, street address, apartment (optional), city, state/province, ZIP/postal code, country, and phone number (optional).
    *   Displays validation error messages next to fields if they occur.
    *   A submit button.
*   **Props:**
    *   `title` (string): A title for the form section (e.g., "Shipping Address", "Billing Address").
    *   `initialAddress` (object, optional): An object to pre-fill the address form fields. Defaults to empty strings.
    *   `onSubmitAddress` (function): A callback function executed when the form is submitted with valid data. It receives the address object (containing all form field values) as an argument.
    *   `submitButtonText` (string, optional): Text for the submit button (e.g., "Continue", "Save Address"). Defaults to "Continue".
*   **Interactions:**
    *   **Input Change:** Updates local component state for the respective address field.
    *   **Submit:** Validates the form. If valid, calls the `onSubmitAddress(address)` prop. Otherwise, displays error messages.
*   **Styling:** Basic inline styles for layout, labels, inputs, and error messages.

## 3. `OrderSummary.js`

*   **Location:** `client/src/components/checkout/OrderSummary.js`
*   **Purpose:** Displays a summary of the items in the cart, including product names, quantities, line totals, subtotal, and order total. Placeholder text for shipping and taxes.
*   **JSX Structure:**
    *   A section title (e.g., "Order Summary").
    *   Lists each item from the cart, showing name, quantity, and calculated line total.
    *   Displays subtotal.
    *   Displays "TBD" for shipping and taxes.
    *   Displays the final order total.
*   **Props:**
    *   `cart` (object): The cart object, expected to be similar to the one used by `CartPage.js` (containing `items`, `subtotal`, `total`). It can be passed down from `CheckoutPage.js` which might get it from `useCart()` context.
*   **Interactions:**
    *   Primarily for display; no direct user interactions to modify the order summary itself within this component.
*   **Styling:** Basic inline styles for layout and text formatting.

## 4. `CheckoutPage.js`

*   **Location:** `client/src/pages/CheckoutPage.js`
*   **Purpose:** Manages the overall multi-step checkout process. It conditionally renders different components based on the current checkout step.
*   **JSX Structure:**
    *   Displays a main title (e.g., "Checkout").
    *   Renders the `CheckoutSteps` component to show progress.
    *   Uses a flex layout to display form/review content on one side and the `OrderSummary` on the other (for wider screens).
    *   **Shipping Step:** Renders `AddressForm` for shipping address.
    *   **Billing Step:** Renders `AddressForm` for billing address (can be skipped if "same as shipping" is checked).
    *   **Review Step:** Displays collected shipping and billing addresses, a placeholder for payment method selection, and allows the user to place the order.
    *   Navigation buttons ("Back", "Place Order" or specific "Continue" buttons handled by `AddressForm`).
    *   A checkbox for "My billing address is the same as my shipping address."
*   **Local State:**
    *   `currentStep` (string): Tracks the active checkout step (e.g., 'shipping', 'billing', 'review').
    *   `shippingAddress` (object | null): Stores the collected shipping address.
    *   `billingAddress` (object | null): Stores the collected billing address.
    *   `useShippingForBilling` (boolean): Tracks if the billing address should be the same as shipping.
*   **Props (Conceptual/Context Usage):**
    *   Uses `useCart()` hook to access cart state (`cartState`) for displaying `OrderSummary` and for order placement logic.
    *   Uses `clearCartItems` action from `useCart()` (conceptually, after successful order placement).
*   **Interactions:**
    *   **Address Form Submission:** Updates `shippingAddress` or `billingAddress` state and proceeds to the next step.
    *   **"Use shipping for billing" Checkbox:** Toggles `useShippingForBilling` state. If checked when submitting shipping, it skips the billing step.
    *   **"Back" Button:** Navigates to the previous checkout step.
    *   **"Place Order" Button (Review Step):**
        *   Currently simulates order placement by showing an alert and navigating to `/order-confirmation` with simulated order details.
        *   In a full implementation, this would trigger an API call to the backend to create the order, then on success, clear the cart (using `clearCartItems` from context) and navigate.
*   **Styling:** Basic inline styles for layout.

## 5. `OrderConfirmationPage.js`

*   **Location:** `client/src/pages/OrderConfirmationPage.js`
*   **Purpose:** Displays a "Thank You" message and a summary of the order after it has been successfully placed.
*   **JSX Structure:**
    *   A prominent "Thank You" message.
    *   Displays the order number.
    *   Shows a summary of items ordered and the total amount paid.
    *   Displays the shipping address.
    *   Provides links to "Continue Shopping" (e.g., homepage) and potentially "View Order History" (future).
*   **Props:**
    *   Relies on `location.state.orderDetails` (passed via `navigate` from `CheckoutPage.js`) to receive the order details to display. If `orderDetails` is not found, it shows a generic message.
*   **Interactions:**
    *   Links for navigation.
*   **Styling:** Basic inline styles for layout and a confirmation message appearance.

These components establish the structural framework for the checkout process. Subsequent tasks will involve integrating them with cart and user contexts, implementing form validation more robustly, and making API calls to the backend for order placement and payment processing.
```
