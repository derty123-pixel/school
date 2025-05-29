# Future Development Plan (Post-MVP1)

This document outlines the next set of features and key tool considerations for the subsequent development phases of the eCommerce and Online Course Delivery platform. This plan builds upon the implemented MVP features (User Authentication, Product Catalog backend).

## 1. Next eCommerce Features (Post-MVP)

The following eCommerce functionalities are priorities for the next phase to build a transactable platform.

### 1.1. Shopping Cart

*   **Objective:** Allow users to select products and prepare for purchase.
*   **Key API Endpoints / Functionalities:**
    *   `POST /api/cart`: Add item to cart (product ID, quantity).
    *   `GET /api/cart`: View current user's cart.
    *   `PUT /api/cart/items/{cartItemId}`: Update quantity of an item in the cart.
    *   `DELETE /api/cart/items/{cartItemId}`: Remove item from cart.
    *   `DELETE /api/cart`: Clear the entire cart.
*   **Considerations:**
    *   **Persistence:**
        *   **Logged-in Users:** Cart persists in the database, associated with the user ID.
        *   **Guest Users:** Cart could be stored in session (if backend sessions are used, e.g., via Redis) or client-side (localStorage) with an option to merge with DB cart upon login. For stateless API approach, a temporary guest cart ID might be used.
    *   **Stock Check:** Re-validate product availability when adding to cart and before checkout.

### 1.2. Checkout Process

*   **Objective:** Enable users to finalize their purchase.
*   **Key API Endpoints / Functionalities (supporting a multi-step flow):**
    *   `POST /api/checkout/address`: Save/update shipping and billing addresses.
    *   `GET /api/checkout/shipping-options`: (Future) Get available shipping methods and costs.
    *   `POST /api/checkout/payment`: Initiate payment processing (details below).
    *   `POST /api/checkout/review`: Allow user to review order before final submission (may not need a separate API if handled client-side before place order).
*   **Considerations:**
    *   The checkout process will heavily interact with the Order Management and Payment Gateway components.
    *   Address validation and management.

### 1.3. Order Management (Initial - Phase 2)

*   **Objective:** Capture and store customer orders.
*   **Key API Endpoints / Functionalities:**
    *   `POST /api/orders`: Place an order (triggered after successful payment). This API will consolidate cart data, user details, shipping info, and payment confirmation into an order record.
    *   `GET /api/orders`: List orders for the authenticated user.
    *   `GET /api/orders/{orderId}`: Get details of a specific order for the authenticated user.
    *   (Admin) `GET /api/admin/orders`: List all orders.
    *   (Admin) `PUT /api/admin/orders/{orderId}/status`: Update order status.
*   **Database Schema (New Tables):**
    *   `orders` (order_id, user_id, total_amount, shipping_address, billing_address, order_status, payment_details_id, created_at, etc.)
    *   `order_items` (order_item_id, order_id, product_id, quantity, price_at_purchase, etc.)
    *   `order_status_history` (optional, for tracking status changes).
*   **Considerations:**
    *   Order status tracking (e.g., 'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded').
    *   Inventory deduction upon successful order placement (or payment confirmation).

### 1.4. Payment Gateway Integration

*   **Objective:** Securely process payments.
*   **Task:** This is a major sub-task involving:
    *   **Selection:** Finalize choice between Stripe and PayPal (PRD 4.4, 6.5), or implement both.
    *   **Integration:**
        *   Frontend: Integrate with selected gateway's SDK for payment element collection (e.g., Stripe Elements, PayPal JS SDK).
        *   Backend: Implement server-side logic for creating payment intents/orders, handling webhooks for payment confirmation, processing refunds.
    *   **Security:** Adhere to PCI compliance standards (especially if handling any card data directly, though client-side SDKs minimize this). The `Payment Service Interface` module will encapsulate this logic.
*   **Key API Endpoints (within Payment Service Interface or Order module):**
    *   `POST /api/payments/create-intent`: Create a payment intent with the gateway.
    *   Webhook endpoint for gateway notifications (e.g., `/api/webhooks/stripe`, `/api/webhooks/paypal`).

## 2. Initial Online Course Delivery Features

Parallel to eCommerce enhancements, foundational course delivery features will be developed.

### 2.1. Course Management (Admin)

*   **Objective:** Allow administrators/instructors to create and structure courses.
*   **Key API Endpoints / Functionalities:**
    *   `POST /api/courses`: Create a new course (title, description, instructor_id (user_id), category_id, featured_image_url).
    *   `GET /api/courses/{courseId}/structure` (Admin): Get detailed structure of a course for editing.
    *   `PUT /api/courses/{courseId}`: Update course details.
    *   `POST /api/courses/{courseId}/modules`: Create a new module within a course.
    *   `PUT /api/courses/{courseId}/modules/{moduleId}`: Update a module.
    *   `POST /api/courses/{courseId}/modules/{moduleId}/lessons`: Create a new lesson within a module.
    *   `PUT /api/courses/{courseId}/modules/{moduleId}/lessons/{lessonId}`: Update a lesson (content, video URL, etc.).
*   **Database Schema (New Tables):**
    *   `courses` (course_id, title, description, instructor_id FK to users, course_category_id FK to a new `course_categories` table or reuse `product_categories`, enrollment_count, created_at, etc.)
    *   `course_modules` (module_id, course_id, title, order, etc.)
    *   `course_lessons` (lesson_id, module_id, title, content_type (video, text, quiz), content_url/text, order, etc.)
    *   `instructors` (optional, could be a role on users table, or a separate table if more instructor-specific data is needed).

### 2.2. Course Consumption (Student)

*   **Objective:** Allow students to discover, enroll in, and consume course content.
*   **Key API Endpoints / Functionalities:**
    *   `GET /api/courses`: List all available/published courses (searchable, filterable).
    *   `GET /api/courses/{courseId}`: View course details (syllabus, instructor, reviews - future).
    *   `POST /api/courses/{courseId}/enroll`: Enroll the authenticated user in a course.
    *   `GET /api/users/me/courses`: List courses the authenticated user is enrolled in.
    *   `GET /api/courses/{courseId}/content`: Get the structured content (modules, lessons) for an enrolled course.
    *   `GET /api/courses/{courseId}/lessons/{lessonId}`: Get specific lesson content.
    *   `POST /api/courses/{courseId}/lessons/{lessonId}/complete`: Mark a lesson as complete.
*   **Database Schema (New Tables):**
    *   `student_enrollments` (enrollment_id, user_id, course_id, enrollment_date, completion_date - nullable).
    *   `student_progress` (progress_id, user_id, course_id, lesson_id, completed_at).

### 2.3. Video Integration Strategy

*   **Guidance:** As per PRD 6.5, avoid self-hosting video streaming infrastructure.
*   **Plan:**
    *   Integrate with dedicated platforms like Vimeo, Wistia, Mux, or AWS MediaServices.
    *   The `course_lessons` table's `content_url` will store the video ID or URL from the chosen platform.
    *   The frontend will use the respective platform's player SDK for embedding and playback.
    *   Backend might need to securely serve video URLs/tokens if private videos are used.

## 3. Revisit Key Tool Choices (for Next Phase)

As the application grows, integrating these tools becomes more critical.

### 3.1. Content Delivery Network (CDN)

*   **Choices:**
    *   **Cloudflare:** Good general-purpose CDN, often has a generous free tier, works well regardless of hosting.
    *   **AWS CloudFront:** Tightly integrated if using AWS for hosting (e.g., S3 for static assets, EC2/ECS for backend).
    *   **Vercel/Netlify CDNs:** If frontend is hosted on these platforms, they provide excellent CDN capabilities out-of-the-box for frontend assets.
*   **Priority:** High, especially once the React frontend for product catalog and user auth is deployed. It will significantly improve global load times for static assets (images, JS/CSS bundles).

### 3.2. Message Queue System

*   **Objective:** Handle asynchronous tasks like email notifications, report generation, and potentially video processing queues (PRD 5.2).
*   **Choices for Node.js/PostgreSQL stack:**
    *   **RabbitMQ:** Robust, mature, feature-rich, protocol-based (AMQP). Good for complex routing. Requires separate hosting/management.
    *   **Redis (as a simple queue):** Can be used for simpler background jobs using lists (e.g., BullMQ library for Node.js). Already considered for session/cache.
    *   **AWS SQS (Simple Queue Service):** Fully managed, highly scalable, good if deploying on AWS.
    *   **Google Pub/Sub:** Similar to SQS if on GCP.
*   **Initial Recommendation:** For MVP+1, if already using Redis for caching/sessions, BullMQ with Redis could be a lean way to introduce background jobs for email notifications. If heavier asynchronous processing is anticipated soon or deploying on AWS, SQS is a strong contender.
*   **Priority:** Medium. Becomes important once order confirmations, course enrollment emails, etc., are implemented.

### 3.3. Logging & Monitoring

*   **Objective:** Centralized logging for debugging and application performance monitoring (APM) (PRD 5.5, 6.5).
*   **Choices:**
    *   **ELK Stack (Elasticsearch, Logstash, Kibana):** Powerful, flexible, but can be complex to set up and manage.
    *   **Prometheus & Grafana:** Excellent for metrics and monitoring, often paired with other logging solutions.
    *   **Sentry:** Primarily error tracking, but also offers performance monitoring. Good developer experience.
    *   **Cloud Provider Tools:** AWS CloudWatch, Google Cloud Logging/Monitoring. Integrated with cloud services.
    *   **Simpler Libraries:** Winston/Pino for structured logging in Node.js, outputting to console/files, which can then be ingested by a log management system.
*   **Initial Plan:**
    1.  Implement structured logging (e.g., using Winston or Pino) in the Node.js application, outputting JSON logs.
    2.  If deploying on AWS, configure CloudWatch Logs to collect logs.
    3.  For error tracking, Sentry is relatively easy to integrate and provides immediate value.
*   **Priority:** Medium to High. Structured logging should be implemented soon. Full APM can follow.

### 3.4. Secrets Management

*   **Objective:** Securely manage API keys, database credentials, JWT secrets (PRD 5.4, 6.5).
*   **Current State:** Likely using `.env` files, which is acceptable for local development but not ideal for production.
*   **Choices:**
    *   **HashiCorp Vault:** Comprehensive secrets management, strong security features. Can be self-hosted or cloud version.
    *   **AWS Secrets Manager / Google Secret Manager:** Integrated with cloud provider IAM and services.
    *   **Hosting Platform Provided Secrets:** Many PaaS (Heroku, Vercel for serverless functions, etc.) provide secure environment variable management.
*   **Plan:**
    *   For initial deployments (especially if using PaaS or serverless functions), leverage the hosting platform's built-in secrets/environment variable management.
    *   If deploying to VMs/Kubernetes, AWS Secrets Manager (if on AWS) or HashiCorp Vault should be planned.
*   **Priority:** High, as soon as first production-like deployment is planned.

## 4. Frontend Development

*   **Acknowledgement:** With backend APIs for User Authentication and Product Catalog now available, a very high priority is the parallel development of the React frontend.
*   **Key Areas:**
    *   User registration and login forms.
    *   Product listing pages, product detail pages.
    *   User account dashboard (view profile, order history - once orders are implemented).
    *   Integration with a state management solution (Redux, Zustand, Context API).
    *   Styling and responsive design.

This plan provides a roadmap for evolving the platform, balancing new feature development with the necessary operational tooling for a robust application.
```
