# User Authentication API (MVP)

This document describes the API endpoints for User Authentication and Basic Account Management (MVP), built with Node.js/Express.js and PostgreSQL.

## 1. Authentication Mechanism

*   **Mechanism:** **JSON Web Tokens (JWT)**
*   **Rationale:** JWTs are chosen for the MVP due to their stateless nature, which aligns well with scalable backend services, and their relative simplicity to implement for a monolithic application. They allow clients to securely transmit identity information after successful login. OAuth 2.0 could be considered for future iterations, especially for third-party authentication.

## 2. Dependencies Added

The following npm packages are required for this module. They should be listed in `server/package.json`:

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.10.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```
*   `express`: Web framework.
*   `pg`: PostgreSQL client for Node.js.
*   `bcryptjs`: For hashing passwords.
*   `jsonwebtoken`: For creating and verifying JWTs.
*   `express-validator`: For validating incoming request data.
*   `dotenv`: For loading environment variables from a `.env` file.
*   `cors`: For enabling Cross-Origin Resource Sharing.
*   `nodemon` (devDependency): For automatically restarting the server during development.

## 3. Environment Variables

Ensure the following environment variables are set in a `.env` file in the `/server` directory:

```env
# Server Configuration
PORT=3001

# Database Configuration (PostgreSQL)
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=1h # e.g., 1h, 7d, 30m

# Default Role ID for new users (ensure this UUID exists in your 'roles' table)
# Example: Get from psql using `SELECT id FROM roles WHERE role_name = 'student';`
DEFAULT_STUDENT_ROLE_ID=your_actual_student_role_uuid 
```
**Important:** Replace placeholder values (like `your_db_user`, `your_super_secret_jwt_key...`, `your_actual_student_role_uuid`) with your actual configuration values. The `DEFAULT_STUDENT_ROLE_ID` must be a valid UUID of a role (e.g., 'student') that exists in your `roles` table. You can create this role using SQL, for example:
`INSERT INTO roles (id, role_name, description) VALUES ('valid-uuid-for-student', 'student', 'Student role');`

## 4. API Endpoints

All endpoints are prefixed with `/api`.

### 4.1. User Registration

*   **Endpoint:** `POST /api/auth/register`
*   **Description:** Registers a new user on the platform. Assigns a default role (e.g., 'student').
*   **Access:** Public
*   **Request Body (JSON):**
    ```json
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "password": "password123"
    }
    ```
*   **Validation:**
    *   `firstName`: Required, string.
    *   `lastName`: Required, string.
    *   `email`: Required, valid email format, unique.
    *   `password`: Required, minimum 6 characters.
*   **Success Response (201 Created):**
    ```json
    {
      "message": "User registered successfully.",
      "user": {
        "id": "generated-uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "roles": ["student"], // Array of role names
        "isActive": true,
        "createdAt": "timestamp"
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors (e.g., missing fields, invalid email).
        ```json
        {
          "errors": [
            { "type": "field", "value": "", "msg": "Password must be 6 or more characters", "path": "password", "location": "body" }
          ]
        }
        ```
    *   `409 Conflict`: User already exists with this email.
        ```json
        { "message": "User already exists with this email." }
        ```
    *   `500 Internal Server Error`: Server-side issue.

### 4.2. User Login

*   **Endpoint:** `POST /api/auth/login`
*   **Description:** Authenticates an existing user and returns a JWT.
*   **Access:** Public
*   **Request Body (JSON):**
    ```json
    {
      "email": "john.doe@example.com",
      "password": "password123"
    }
    ```
*   **Validation:**
    *   `email`: Required, valid email format.
    *   `password`: Required.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Login successful.",
      "token": "your_jwt_token_here",
      "user": {
        "id": "user-uuid",
        "email": "john.doe@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "roles": ["student"] // Array of role names
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors.
    *   `401 Unauthorized`: Invalid credentials (email not found or password doesn't match).
        ```json
        { "message": "Invalid credentials." }
        ```
    *   `403 Forbidden`: User account is inactive.
        ```json
        { "message": "User account is inactive." }
        ```
    *   `500 Internal Server Error`: Server-side issue.

### 4.3. Get User Profile

*   **Endpoint:** `GET /api/users/me`
*   **Description:** Retrieves the profile of the currently authenticated user.
*   **Access:** Private (Requires JWT Authentication)
*   **Headers:**
    *   `Authorization`: `Bearer your_jwt_token_here`
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Profile fetched successfully.",
      "user": {
        "id": "user-uuid",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "profile_picture_url": null,
        "is_active": true,
        "last_login_at": "timestamp",
        "created_at": "timestamp",
        "updated_at": "timestamp",
        "roles": ["student"] // Array of role names
      }
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: No token provided, token invalid, or token expired.
        ```json
        { "message": "Not authorized, no token." } 
        // or { "message": "Not authorized, token failed." }
        // or { "message": "Token expired. Please log in again." }
        ```
    *   `404 Not Found`: User associated with the token not found in DB (rare, if user deleted after token issuance).
    *   `500 Internal Server Error`: Server-side issue.


## 5. Running and Testing

1.  **Database Setup:**
    *   Ensure PostgreSQL is running.
    *   Create your database and run the `phase1_schema.sql` to set up tables.
    *   **Crucially, insert a default role (e.g., 'student') into the `roles` table and copy its UUID into the `DEFAULT_STUDENT_ROLE_ID` environment variable in your `.env` file.**
        *   Example SQL to create a role and get its ID:
          ```sql
          -- Generate a UUID if you don't have one
          -- SELECT uuid_generate_v4(); 
          -- Use the generated UUID below
          INSERT INTO roles (id, role_name, description) 
          VALUES ('your-chosen-uuid-for-student-role', 'student', 'Student User Role'); 
          ```

2.  **Install Dependencies:**
    Navigate to the `/server` directory:
    ```bash
    cd path/to/your/project/server
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env` file in the `/server` directory with your database credentials, JWT secret, and the `DEFAULT_STUDENT_ROLE_ID`. See section 3 for details.

4.  **Start the Server:**
    ```bash
    npm run dev 
    # Or npm start for production mode (without nodemon)
    ```
    The server should start on the port specified in your `.env` (e.g., 3001).

5.  **Testing with API Client (e.g., Postman, Insomnia, curl):**

    *   **Register User:**
        *   Method: `POST`
        *   URL: `http://localhost:3001/api/auth/register`
        *   Body (raw, JSON):
            ```json
            {
              "firstName": "Test",
              "lastName": "User",
              "email": "test@example.com",
              "password": "password1234"
            }
            ```

    *   **Login User:**
        *   Method: `POST`
        *   URL: `http://localhost:3001/api/auth/login`
        *   Body (raw, JSON):
            ```json
            {
              "email": "test@example.com",
              "password": "password1234"
            }
            ```
        *   Copy the `token` from the response for the next request.

    *   **Get User Profile:**
        *   Method: `GET`
        *   URL: `http://localhost:3001/api/users/me`
        *   Headers:
            *   `Authorization`: `Bearer <your_copied_jwt_token>`

This setup provides the basic authentication flow for the application. Further enhancements can include password reset, email verification, OAuth 2.0 integration, and more granular role/permission management.
```
