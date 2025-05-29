# Product Catalog API (MVP)

This document describes the API endpoints for the Product Catalog Module (MVP), built with Node.js/Express.js and PostgreSQL. This module handles product categories, products, and basic inventory.

## 1. Dependencies

No new dependencies are added beyond those already included for the User Authentication module (`express`, `pg`, `bcryptjs`, `jsonwebtoken`, `express-validator`, `dotenv`, `cors`).

## 2. Environment Variables

No new specific environment variables are required for this module beyond the existing ones for database connection and JWT. For admin access, ensure an 'admin' role exists and a user has this role. You might want to define `DEFAULT_ADMIN_ROLE_ID` if you automate admin user creation or role assignment.

## 3. API Protection

*   **Authentication:** Uses JWT Bearer tokens via the `protect` middleware.
*   **Authorization:** Admin-only routes are protected by the `authorize('admin')` middleware, which checks if the authenticated user has the 'admin' role.

## 4. API Endpoints

All endpoints for this module are prefixed with `/api/catalog`.

### 4.1. Category Management

#### 4.1.1. Create Category

*   **Endpoint:** `POST /api/catalog/categories`
*   **Description:** Creates a new product category.
*   **Access:** Private (Admin only)
*   **Headers:** `Authorization: Bearer <admin_jwt_token>`
*   **Request Body (JSON):**
    ```json
    {
      "name": "Electronics",
      "description": "Gadgets and electronic devices",
      "parent_category_id": null 
      // or "valid-uuid-of-parent-category" for subcategory
    }
    ```
*   **Validation:**
    *   `name`: Required, string, unique.
    *   `description`: Optional, string.
    *   `parent_category_id`: Optional, valid UUID if provided.
*   **Success Response (201 Created):**
    ```json
    {
      "message": "Category created successfully.",
      "category": {
        "id": "generated-uuid",
        "name": "Electronics",
        "description": "Gadgets and electronic devices",
        "parent_category_id": null,
        "created_at": "timestamp",
        "updated_at": "timestamp"
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Validation errors.
    *   `401 Unauthorized`: Invalid or missing token.
    *   `403 Forbidden`: User is not an admin.
    *   `409 Conflict`: Category name already exists.
    *   `500 Internal Server Error`.

#### 4.1.2. List Categories

*   **Endpoint:** `GET /api/catalog/categories`
*   **Description:** Retrieves a list of all product categories.
*   **Access:** Public
*   **Success Response (200 OK):**
    ```json
    [
      {
        "id": "uuid1",
        "name": "Electronics",
        "description": "Gadgets and electronic devices",
        "parent_category_id": null,
        "created_at": "timestamp",
        "updated_at": "timestamp"
      },
      {
        "id": "uuid2",
        "name": "Books",
        "description": "Various genres of books",
        "parent_category_id": null,
        "created_at": "timestamp",
        "updated_at": "timestamp"
      }
    ]
    ```
*   **Error Responses:**
    *   `500 Internal Server Error`.

#### 4.1.3. Get Category By ID

*   **Endpoint:** `GET /api/catalog/categories/{categoryId}`
*   **Description:** Retrieves a single category by its ID.
*   **Access:** Public
*   **URL Parameters:**
    *   `categoryId` (UUID): The ID of the category to retrieve.
*   **Success Response (200 OK):**
    ```json
    {
        "id": "uuid1",
        "name": "Electronics",
        "description": "Gadgets and electronic devices",
        "parent_category_id": null,
        "created_at": "timestamp",
        "updated_at": "timestamp"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid categoryId format (not UUID).
    *   `404 Not Found`: Category with the given ID not found.
    *   `500 Internal Server Error`.

### 4.2. Product Management

#### 4.2.1. Create Product

*   **Endpoint:** `POST /api/catalog/products`
*   **Description:** Creates a new product and its initial inventory record.
*   **Access:** Private (Admin only)
*   **Headers:** `Authorization: Bearer <admin_jwt_token>`
*   **Request Body (JSON):**
    ```json
    {
      "name": "Laptop Pro 15 inch",
      "sku": "LP15-2023-001",
      "description": "High performance laptop for professionals.",
      "price": 1299.99,
      "category_id": "uuid-of-electronics-category",
      "image_urls": "[{\"url\": \"path/to/image1.jpg\", \"alt_text\": \"Laptop front view\"}]", // JSON string or actual JSON array/object
      "initial_quantity": 50 
    }
    ```
*   **Validation:**
    *   `name`, `sku`, `price`, `category_id`: Required.
    *   `sku`: Unique.
    *   `price`: Non-negative number.
    *   `category_id`: Valid UUID of an existing category.
    *   `image_urls`: Optional, JSON.
    *   `initial_quantity`: Optional, non-negative integer.
*   **Success Response (201 Created):**
    ```json
    {
      "message": "Product created successfully.",
      "product": {
        "id": "generated-uuid",
        "name": "Laptop Pro 15 inch",
        "sku": "LP15-2023-001",
        // ... other product fields ...
        "is_published": false, // Default for new products
        "inventory": {
          "id": "inventory-uuid",
          "product_id": "generated-uuid",
          "quantity_available": 50,
          "last_restocked_at": "timestamp" 
        }
      }
    }
    ```
*   **Error Responses:** Refer to Create Category errors, plus:
    *   `400 Bad Request`: Invalid `category_id` (category does not exist).
    *   `409 Conflict`: Product with the same SKU already exists.

#### 4.2.2. Get Product List

*   **Endpoint:** `GET /api/catalog/products`
*   **Description:** Retrieves a paginated list of (published) products. Can be filtered by `category_id`.
*   **Access:** Public
*   **Query Parameters:**
    *   `page` (integer, optional, default: 1): Page number.
    *   `limit` (integer, optional, default: 10): Number of items per page.
    *   `category_id` (UUID, optional): Filter products by category ID.
*   **Success Response (200 OK):**
    ```json
    {
      "products": [
        {
          "id": "uuid",
          "name": "Laptop Pro 15 inch",
          "sku": "LP15-2023-001",
          "description": "High performance laptop for professionals.",
          "price": 1299.99,
          "category_id": "uuid-of-electronics-category",
          "category_name": "Electronics",
          "image_urls": [{ "url": "path/to/image1.jpg", "alt_text": "Laptop front view" }],
          "is_published": true,
          "created_at": "timestamp",
          "updated_at": "timestamp",
          "quantity_available": 50
        }
        // ... other products
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalProducts": 48,
        "limit": 10
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid query parameter format.
    *   `500 Internal Server Error`.

#### 4.2.3. Get Single Product

*   **Endpoint:** `GET /api/catalog/products/{productId}`
*   **Description:** Retrieves details for a single product.
    *   Public users see only published products.
    *   Admin users (identified by a valid admin JWT) can see unpublished products too.
*   **Access:** Public (with conditional admin access for unpublished items)
*   **Headers (Optional for Admin):** `Authorization: Bearer <admin_jwt_token>`
*   **URL Parameters:**
    *   `productId` (UUID): The ID of the product.
*   **Success Response (200 OK):**
    ```json
    {
      "id": "uuid",
      "name": "Laptop Pro 15 inch",
      // ... all product fields ...
      "category_name": "Electronics",
      "quantity_available": 50,
      "low_stock_threshold": 10, // Visible to admin, or if public view is configured for it
      "last_restocked_at": "timestamp"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid `productId` format.
    *   `404 Not Found`: Product not found or not available for public view.
    *   `500 Internal Server Error`.

#### 4.2.4. Update Product

*   **Endpoint:** `PUT /api/catalog/products/{productId}`
*   **Description:** Updates details of an existing product.
*   **Access:** Private (Admin only)
*   **Headers:** `Authorization: Bearer <admin_jwt_token>`
*   **URL Parameters:** `productId` (UUID).
*   **Request Body (JSON):** Contains fields to update (e.g., name, price, description, is_published, etc.).
    ```json
    {
      "name": "Laptop Pro 15 inch (2024 Edition)",
      "price": 1349.99,
      "is_published": true
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Product updated successfully.",
      "product": { /* ... updated product object with inventory ... */ }
    }
    ```
*   **Error Responses:** Similar to Create Product, plus `404 Not Found`.

#### 4.2.5. Delete Product

*   **Endpoint:** `DELETE /api/catalog/products/{productId}`
*   **Description:** Deletes a product and its associated inventory (due to CASCADE).
*   **Access:** Private (Admin only)
*   **Headers:** `Authorization: Bearer <admin_jwt_token>`
*   **URL Parameters:** `productId` (UUID).
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Product deleted successfully.",
      "id": "deleted-product-uuid"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid `productId`.
    *   `401 Unauthorized`, `403 Forbidden`.
    *   `404 Not Found`.
    *   `500 Internal Server Error`.

### 4.3. Inventory Management

#### 4.3.1. Update Stock

*   **Endpoint:** `PUT /api/catalog/products/{productId}/inventory`
*   **Description:** Updates the stock quantity or low stock threshold for a product.
*   **Access:** Private (Admin only)
*   **Headers:** `Authorization: Bearer <admin_jwt_token>`
*   **URL Parameters:** `productId` (UUID).
*   **Request Body (JSON):**
    ```json
    {
      "quantity_available": 75, // New total quantity
      "low_stock_threshold": 15 
      // Provide at least one field
    }
    ```
*   **Validation:**
    *   `quantity_available`: Optional, non-negative integer.
    *   `low_stock_threshold`: Optional, non-negative integer.
    *   At least one field must be provided.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Inventory updated successfully.",
      "inventory": {
        "id": "inventory-uuid",
        "product_id": "product-uuid",
        "quantity_available": 75,
        "low_stock_threshold": 15,
        "last_restocked_at": "timestamp", // Or updated_at if only threshold changed
        "updated_at": "timestamp"
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., negative quantity, no fields).
    *   `401 Unauthorized`, `403 Forbidden`.
    *   `404 Not Found`: Product or inventory record not found.
    *   `500 Internal Server Error`.

## 5. Testing

1.  **Prerequisites:**
    *   User Authentication API is running and accessible.
    *   Obtain a JWT for an 'admin' user by registering/logging in and ensuring the user has the 'admin' role in the `user_roles` table. The 'admin' role must exist in the `roles` table.
2.  **Tools:** Use Postman, Insomnia, or cURL.
3.  **Admin Operations:** For admin-only endpoints, include the JWT in the `Authorization` header: `Bearer <your_admin_jwt_token>`.
4.  **Workflow:**
    *   Create categories first.
    *   Then create products, assigning them to existing categories.
    *   Test public GET endpoints for categories and products.
    *   Test admin updates and deletes.
    *   Test inventory updates.

This API provides foundational product and category management. Future enhancements could include advanced search/filtering, image uploads, variant management, and more detailed inventory tracking.
```
