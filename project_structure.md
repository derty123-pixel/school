# Project Structure Definition

This document outlines the initial project structure for the monolithic application, designed with modularity in mind, based on the selected technology stack (Node.js/Express.js backend, React frontend, PostgreSQL database) and the Product Requirements Document (PRD).

## 1. Top-Level Directory Structure

The project will adopt a top-level structure that separates client (frontend) and server (backend) concerns:

```
/project-root
  /client           # React Frontend application
    /public         # Static assets (index.html, favicons, etc.)
    /src            # Frontend source code
      /components   # Reusable UI components
      /pages        # Top-level page components
      /features     # Feature-specific modules (e.g., auth, products, courses)
      /services     # API interaction services
      /store        # State management (e.g., Redux, Zustand)
      /hooks        # Custom React hooks
      /utils        # Utility functions
      /assets       # Images, fonts, etc.
      App.js        # Main React application component
      index.js      # Entry point for React application
    package.json    # Frontend dependencies and scripts
    README.md       # Frontend specific documentation
    ...             # Other frontend config (e.g., .env, jsconfig.json)

  /server           # Node.js/Express.js Backend application
    /src            # Backend source code (detailed below)
    package.json    # Backend dependencies and scripts
    .env.example    # Example environment variables
    Dockerfile      # Optional: for containerizing the backend
    README.md       # Backend specific documentation
    ...             # Other backend config (e.g., tsconfig.json, .eslintrc.js)

  .gitignore        # Git ignore rules for the whole project
  package.json      # Root-level scripts (e.g., concurrently, husky)
  README.md         # Main project README
  ...               # Other root config files (e.g., prettier.config.js)
```

This separation allows for independent development workflows, dependency management, and build processes for the frontend and backend, while still being part of a single cohesive project.

## 2. Backend (`server`) Directory Structure

The backend will follow a modular structure within the `/server/src` directory, emphasizing clear separation of concerns for each logical module as outlined in PRD 5.1.

```
/server/src
  /config             # Database config, environment variables, CORS, API keys, etc.
    database.js       # Database connection setup (PostgreSQL)
    environment.js    # Environment variable management (e.g., using dotenv)
    index.js          # Exports all configurations

  /core               # Core functionalities: server setup, error handling, logging
    errorHandler.js   # Global error handling middleware
    logger.js         # Logging configuration (e.g., Winston, Pino)
    serverSetup.js    # Express app initialization, global middleware setup

  /middlewares        # Custom global or shared Express middlewares
    authenticate.js   # JWT/OAuth authentication middleware
    authorize.js      # Role-based access control middleware
    requestLogger.js  # Middleware for logging incoming requests

  /modules            # Logical business modules
    /user_management
      /controllers    # HTTP request handlers (Express controllers)
      /services       # Business logic layer
      /routes         # API endpoint definitions for this module
      /models         # Database models/schemas (e.g., User model for PostgreSQL)
      /validators     # Input validation schemas/rules (e.g., Joi, express-validator)
      /tests          # Unit/integration tests for this module
    /product_catalog
      # (similar structure: controllers, services, routes, models, validators, tests)
      ...
    /order_management
      # (similar structure)
      ...
    /course_management
      # (similar structure)
      ...
    /payment_service_interface
      /controllers    # May be minimal; primarily webhook handlers
      /services       # Logic for interacting with external payment gateways (Stripe, PayPal)
      /routes         # Endpoints for payment initiation, webhooks, etc.
      /tests
      ...

  /shared             # Shared utilities, constants, or types across modules
    /utils            # Common utility functions
    /constants        # Application-wide constants
    /types            # Shared TypeScript types/interfaces (if using TypeScript)

  app.js              # Main Express application instance, mounts module routes and core middleware
  server.js           # HTTP server startup logic (binds to port, starts listening)
```

**Key aspects of the backend structure:**
*   **Modularity:** The `/modules` directory is central, with each sub-directory representing a distinct business capability.
*   **Separation of Concerns:** Within each module, responsibilities are further divided (controllers for HTTP layer, services for business logic, models for data access).
*   **Clear Entry Points:** `app.js` assembles the application, and `server.js` starts it.
*   **Testability:** The structure facilitates testing by allowing modules and their components to be tested in isolation.

## 3. Logical Modules Definition (PRD 5.1)

The initial logical modules for the backend are:

*   **User Management:**
    *   **Primary Responsibility:** Handles user registration, login, authentication (JWT/OAuth 2.0), authorization (RBAC), profile management, password recovery, and related user account functionalities.
*   **Product Catalog:**
    *   **Primary Responsibility:** Manages all product information, including CRUD operations for products, product details (descriptions, images, pricing), categories, variations, and inventory tracking.
*   **Order Management:**
    *   **Primary Responsibility:** Manages the lifecycle of customer orders. This includes shopping cart operations (if backend-driven), order creation, payment processing coordination, order status tracking, fulfillment workflows, and handling returns or cancellations. It interacts heavily with `Product Catalog` (inventory) and `Payment Service Interface`.
*   **Course Management:**
    *   **Primary Responsibility:** Manages online course content and learning activities. This includes course creation, syllabus management, instructor details, lesson organization, video content integration, student enrollment, progress tracking, and assessment administration.
*   **Payment Service Interface:**
    *   **Primary Responsibility:** Provides an abstraction layer for interacting with external payment gateways (e.g., Stripe, PayPal). It handles initiating payments, processing payment confirmations and webhooks, and ensuring secure management of payment-related data, localizing PCI DSS compliance concerns.

## 4. Inter-Module Communication (Backend Monolith)

Within the monolithic backend, modules will communicate primarily through **direct function/method calls via well-defined service layers.**

**Justification:**

*   **Simplicity and Performance:** Direct method calls between services are the most straightforward and performant for a monolith, avoiding network latency or the complexity of an internal event bus for synchronous, tightly coupled operations.
*   **Alignment with PRD 5.1:** This approach directly implements the "well-defined internal APIs or service layers" stipulated in the PRD. Each module's service layer will expose a clear public interface (a set of methods/functions) for other modules to consume.
*   **Strong Typing & Maintainability:** If using TypeScript (recommended), service layer interfaces provide strong typing, enhancing code quality, refactorability, and enabling compile-time checks for inter-module calls. This improves overall maintainability.
*   **Clear Boundaries:** Modules interact through designated service entry points. For example, `OrderManagementService` might call methods on `ProductCatalogService` or `PaymentInterfaceService`. Controllers within a module primarily orchestrate calls to their own module's services, which then may delegate to other services if necessary.
*   **Testability:** Service layers can be easily mocked or stubbed, facilitating unit and integration testing of individual modules in isolation.
*   **Path to Microservices:** This clear separation of logic via service layers means that if a module (e.g., `PaymentServiceInterface`) is later extracted into a microservice, its existing service interface provides a strong foundation for defining the microservice's API contract. The calling modules would then be updated to use network calls (e.g., HTTP or gRPC) instead of direct method invocations, but the logical decoupling is already in place.

**Example Flow:**
When a user places an order:
1.  The `Order Management` controller receives the request.
2.  It calls the `Order Management` service.
3.  The `Order Management` service might:
    a.  Call the `Product Catalog` service to verify stock levels.
    b.  Call the `Payment Service Interface` service to process the payment.
    c.  If successful, create order records using its own models.
    d.  Call the `Product Catalog` service again to update stock levels.

This structure provides a robust foundation for the initial monolithic build, ensuring modularity and maintainability while paving the way for potential future microservice extraction.
```
