# Course & Content Management Admin APIs

This document describes the Admin-facing API endpoints for managing courses, course modules, and lessons. These APIs are intended for use by users with 'admin' or 'instructor' roles.

## 1. Authorization & Roles

*   **Authentication:** All endpoints require authentication (`JWT` via `Authorization: Bearer <token>`). The `protect` middleware handles this.
*   **Authorization:** Endpoints are protected by an `authorize(rolesArray)` middleware.
    *   Generally, `['admin', 'instructor']` roles are allowed.
    *   **Ownership:** For instructors, most operations (update, delete, managing modules/lessons) are restricted to courses they own (i.e., where `course.instructor_id === req.user.id`). Admins typically have unrestricted access. This logic is enforced in the service layer.

## 2. Slug Generation

*   **Courses:** Slugs are generated from the course `title`. The system attempts to create a unique slug. If a direct slugified version of the title conflicts, a counter is appended (e.g., `my-course-title-1`).
*   **Lessons:** Slugs are generated from the lesson `title` and must be unique *within the parent module*.

## 3. API Endpoints

### 3.1. Course Management

Base Path: `/api/admin/courses`

#### 3.1.1. Create Course

*   **Endpoint:** `POST /`
*   **Protection:** `admin`, `instructor`
*   **Request Body (JSON):**
    ```json
    {
      "title": "Introduction to Advanced Web Development",
      "description": "A comprehensive course on modern web dev techniques.",
      "instructor_id": "uuid-of-instructor" // Optional: Admin can set. If instructor creates, defaults to self. If admin creates and omits, defaults to admin's ID.
      "category_id": "uuid-of-course-category", // Optional
      "product_id": "uuid-of-linked-product", // Optional: If course is sold via a product entry
      "level": "Intermediate",
      "duration_estimate": "Approx. 10 hours",
      "cover_image_url": "https://example.com/image.jpg", // Optional
      "is_published": false // Optional, defaults to false
    }
    ```
*   **Response (201 Created):** The newly created course object.
*   **Notes:** Slug is auto-generated.

#### 3.1.2. List Courses (Admin/Instructor View)

*   **Endpoint:** `GET /`
*   **Protection:** `admin`, `instructor`
*   **Query Parameters:**
    *   `page` (integer, optional, default: 1)
    *   `limit` (integer, optional, default: 10)
*   **Response (200 OK):** Paginated list of courses.
    *   Admins see all courses.
    *   Instructors see only courses where they are the `instructor_id`.
    ```json
    {
      "courses": [ /* ...array of course objects... */ ],
      "pagination": { "currentPage": 1, "totalPages": 1, "totalCourses": 5, "limit": 10 }
    }
    ```

#### 3.1.3. Get Course Details (Admin View)

*   **Endpoint:** `GET /:courseId`
*   **Protection:** `admin`, `instructor` (instructor must own the course)
*   **URL Parameters:** `courseId` (UUID)
*   **Response (200 OK):** Full course object, including an array of its `modules`, and each module including an array of its `lessons`.
    ```json
    {
      "id": "course-uuid",
      "title": "Course Title",
      // ... other course fields ...
      "instructor_email": "instructor@example.com",
      "category_name": "Category Name",
      "modules": [
        {
          "id": "module-uuid",
          "title": "Module 1",
          // ... other module fields ...
          "lessons": [
            {
              "id": "lesson-uuid",
              "title": "Lesson 1.1",
              // ... other lesson fields ...
            }
          ]
        }
      ]
    }
    ```

#### 3.1.4. Update Course

*   **Endpoint:** `PUT /:courseId`
*   **Protection:** `admin`, `instructor` (instructor must own the course)
*   **URL Parameters:** `courseId` (UUID)
*   **Request Body (JSON):** Fields to update (subset of create payload).
    *   If `title` changes, `slug` may be regenerated.
    *   Admin can change `instructor_id`. Instructors cannot.
*   **Response (200 OK):** The updated course object.

#### 3.1.5. Delete Course

*   **Endpoint:** `DELETE /:courseId`
*   **Protection:** `admin`, `instructor` (instructor must own the course)
*   **URL Parameters:** `courseId` (UUID)
*   **Response (200 OK):**
    ```json
    { "message": "Course and its associated content deleted successfully." }
    ```
*   **Notes:** Deletion is hard delete. `ON DELETE CASCADE` in DB schema handles deletion of associated modules and lessons. Enrollments related to the course are also cascaded.

### 3.2. Module Management

Base Path: `/api/admin/courses/:courseId/modules`

#### 3.2.1. Create Module

*   **Endpoint:** `POST /`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID)
*   **Request Body (JSON):**
    ```json
    {
      "title": "Module 1: Getting Started",
      "description": "Introduction to the topic.", // Optional
      "module_order": 1 // Optional: If omitted, appends as last module.
    }
    ```
*   **Response (201 Created):** The newly created module object.

#### 3.2.2. List Modules for a Course

*   **Endpoint:** `GET /`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID)
*   **Response (200 OK):** Array of module objects for the specified course, ordered by `module_order`.

#### 3.2.3. Get Module Details

*   **Endpoint:** `GET /:moduleId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID)
*   **Response (200 OK):** The specified module object.

#### 3.2.4. Update Module

*   **Endpoint:** `PUT /:moduleId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID)
*   **Request Body (JSON):** Fields to update (title, description, module_order).
*   **Response (200 OK):** The updated module object.

#### 3.2.5. Delete Module

*   **Endpoint:** `DELETE /:moduleId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID)
*   **Response (200 OK):**
    ```json
    { "message": "Module deleted successfully." }
    ```
*   **Notes:** `ON DELETE CASCADE` in DB schema handles deletion of associated lessons.

### 3.3. Lesson Management

Base Path: `/api/admin/courses/:courseId/modules/:moduleId/lessons`

#### 3.3.1. Create Lesson

*   **Endpoint:** `POST /`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID)
*   **Request Body (JSON):**
    ```json
    {
      "title": "First Steps in X",
      "lesson_type": "video", // 'video', 'text', 'quiz', 'document'
      "content_url": "https://vimeo.com/123456", // If video/document
      "text_content": "Detailed explanation here...", // If text
      "duration_minutes": 10, // Optional
      "lesson_order": 1, // Optional: If omitted, appends as last lesson in module.
      "is_preview_allowed": false // Optional, defaults to false
    }
    ```
*   **Response (201 Created):** The newly created lesson object.
*   **Notes:** Slug is auto-generated (unique within the module).

#### 3.3.2. List Lessons for a Module

*   **Endpoint:** `GET /`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID)
*   **Response (200 OK):** Array of lesson objects for the specified module, ordered by `lesson_order`.

#### 3.3.3. Get Lesson Details

*   **Endpoint:** `GET /:lessonId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID), `lessonId` (UUID)
*   **Response (200 OK):** The specified lesson object.

#### 3.3.4. Update Lesson

*   **Endpoint:** `PUT /:lessonId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID), `lessonId` (UUID)
*   **Request Body (JSON):** Fields to update. If `title` changes, `slug` may be regenerated.
*   **Response (200 OK):** The updated lesson object.

#### 3.3.5. Delete Lesson

*   **Endpoint:** `DELETE /:lessonId`
*   **Protection:** `admin`, `instructor` (must own parent course)
*   **URL Parameters:** `courseId` (UUID), `moduleId` (UUID), `lessonId` (UUID)
*   **Response (200 OK):**
    ```json
    { "message": "Lesson deleted successfully." }
    ```

## 4. Input Validation

*   All POST and PUT endpoints include input validation using `express-validator`.
*   UUIDs in path parameters are validated.
*   Required fields are checked.
*   Data types are generally checked (e.g., boolean for `is_published`, integer for `lesson_order`).
*   `lesson_type` is validated against the allowed ENUM values.

This set of APIs provides comprehensive administrative control over the course structure and content.
```
