# Public & Student Course APIs

This document describes the public-facing and student-specific API endpoints for accessing course information, enrolling in courses, and managing learning progress.

## 1. Public Course APIs

Base Path: `/api/courses`

These endpoints do not require authentication.

### 1.1. List Published Courses

*   **Endpoint:** `GET /published`
*   **Description:** Retrieves a paginated list of all courses that are marked as `is_published = TRUE`.
*   **Access:** Public
*   **Query Parameters:**
    *   `page` (integer, optional, default: 1): Page number for pagination.
    *   `limit` (integer, optional, default: 10): Number of courses per page.
    *   `categoryId` (UUID, optional): Filter courses by a specific category ID.
    *   `instructorId` (UUID, optional): Filter courses by a specific instructor ID.
*   **Success Response (200 OK):**
    ```json
    {
      "courses": [
        {
          "id": "course-uuid",
          "title": "Public Course Title",
          "slug": "public-course-title",
          "description": "Brief description of the course.",
          "level": "Beginner",
          "duration_estimate": "Approx. 3 hours",
          "cover_image_url": "https://example.com/cover.jpg",
          "instructor_name": "John Doe",
          "instructor_id": "instructor-uuid",
          "category_name": "Web Development",
          "course_price": 49.99 // (Present if linked to a product)
        }
        // ... other courses
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 2,
        "totalCourses": 15,
        "limit": 10
      }
    }
    ```
*   **Error Responses:** `400` (Bad Request - invalid query params), `500` (Internal Server Error).

### 1.2. View Single Published Course Details

*   **Endpoint:** `GET /published/:slug`
*   **Description:** Retrieves detailed information for a single published course, identified by its `slug`. Includes course modules and lessons. For lessons where `is_preview_allowed` is true, `content_url` and `text_content` are included; otherwise, they are null.
*   **Access:** Public
*   **URL Parameters:**
    *   `slug` (string): The unique slug of the course.
*   **Success Response (200 OK):**
    ```json
    {
      "id": "course-uuid",
      "title": "Public Course Title",
      "slug": "public-course-title",
      // ... other course fields (description, level, duration, instructor_name, category_name, course_price, product_id) ...
      "is_published": true,
      "modules": [
        {
          "id": "module-uuid",
          "title": "Module 1: Introduction",
          "description": "Overview of the module.",
          "module_order": 1,
          "lessons": [
            {
              "id": "lesson-uuid-1",
              "title": "Welcome Video",
              "slug": "welcome-video",
              "lesson_type": "video",
              "duration_minutes": 5,
              "lesson_order": 1,
              "is_preview_allowed": true,
              "content_url": "https://example.com/video1_preview.mp4", // Included if preview allowed
              "text_content": null
            },
            {
              "id": "lesson-uuid-2",
              "title": "Core Concepts (Text)",
              "slug": "core-concepts",
              "lesson_type": "text",
              "duration_minutes": 15,
              "lesson_order": 2,
              "is_preview_allowed": false,
              "content_url": null, // Not included if preview not allowed
              "text_content": null  // Not included if preview not allowed
            }
          ]
        }
        // ... other modules
      ]
    }
    ```
*   **Error Responses:** `400` (Bad Request - invalid slug format), `404` (Not Found - course not found or not published), `500`.

## 2. Student Course & Enrollment APIs

Base Path: `/api/courses` (Authenticated routes are differentiated by path segments like `/enroll` or `/enrolled`)

These endpoints require user authentication (JWT via `Authorization: Bearer <token>`). The `protect` middleware handles this.

### 2.1. Enroll in a Course

*   **Endpoint:** `POST /:courseId/enroll`
*   **Description:** Enrolls the authenticated user in the specified course.
*   **Access:** Private (Authenticated User)
*   **URL Parameters:**
    *   `courseId` (UUID): The ID of the course to enroll in.
*   **Request Body:** Empty.
*   **Logic:**
    1.  Checks if the course exists and is published.
    2.  (Future Monetization: This step would involve checking if payment is required and completed if `product_id` is set on the course. For current MVP, direct enrollment is allowed if published.)
    3.  Checks if the user is already enrolled; if so, returns a 409 error.
    4.  Creates an `enrollments` record for the user and course, with `progress_percent` initialized to 0.
*   **Success Response (201 Created):**
    ```json
    {
      "message": "Successfully enrolled in course.",
      "enrollment": {
        "id": "enrollment-uuid",
        "user_id": "user-uuid",
        "course_id": "course-uuid",
        "enrolled_at": "timestamp",
        "completed_at": null,
        "progress_percent": 0,
        "last_accessed_lesson_id": null
        // ... other enrollment fields ...
      }
    }
    ```
*   **Error Responses:** `400` (Bad Request - invalid courseId), `401` (Unauthorized), `404` (Not Found - course not found or not published), `409` (Conflict - already enrolled), `500`.

### 2.2. List Enrolled Courses

*   **Endpoint:** `GET /enrolled`
*   **Description:** Retrieves a paginated list of courses the authenticated user is currently enrolled in.
*   **Access:** Private (Authenticated User)
*   **Query Parameters:**
    *   `page` (integer, optional, default: 1).
    *   `limit` (integer, optional, default: 10).
*   **Success Response (200 OK):**
    ```json
    {
      "courses": [
        {
          "id": "course-uuid",
          "title": "Enrolled Course Title",
          "slug": "enrolled-course-title",
          "cover_image_url": "https://example.com/cover.jpg",
          "level": "Intermediate",
          "duration_estimate": "Approx. 10 hours",
          "instructor_name": "Jane Instructor",
          "enrolled_at": "timestamp",
          "completed_at": null, // or timestamp if completed
          "progress_percent": 25,
          "last_accessed_lesson_id": "lesson-uuid-if-any"
        }
        // ... other enrolled courses
      ],
      "pagination": { /* ... pagination details ... */ }
    }
    ```
*   **Error Responses:** `401`, `500`.

### 2.3. View Enrolled Course (Full Content)

*   **Endpoint:** `GET /enrolled/:courseId`
*   **Description:** Retrieves full details for a course the authenticated user is enrolled in, including all modules and all lesson content (text, video URLs, etc.), regardless of `is_preview_allowed`. Also includes user's enrollment-specific details like progress.
*   **Access:** Private (Authenticated User, must be enrolled in the course)
*   **URL Parameters:**
    *   `courseId` (UUID): The ID of the enrolled course.
*   **Success Response (200 OK):**
    ```json
    {
      "id": "course-uuid",
      "title": "Enrolled Course Title",
      // ... all other course fields ...
      "instructor_name": "Jane Instructor",
      "category_name": "Data Science",
      "enrollment_details": { // User-specific enrollment data
          "progress_percent": 25,
          "last_accessed_lesson_id": "lesson-uuid-abc",
          "enrolled_at": "timestamp",
          "completed_at": null
      },
      "modules": [
        {
          "id": "module-uuid",
          "title": "Module 1: Full Content",
          // ... other module fields ...
          "lessons": [
            {
              "id": "lesson-uuid-1",
              "title": "Lesson 1 with Full Video",
              "slug": "lesson-1-video",
              "lesson_type": "video",
              "duration_minutes": 10,
              "lesson_order": 1,
              "is_preview_allowed": false, // This doesn't restrict access for enrolled user
              "content_url": "https://example.com/full_video_url.mp4", // Full content URL
              "text_content": null,
              "is_completed": true // Indicates if this user completed this lesson
            },
            // ... other lessons with full content and completion status
          ]
        }
      ]
    }
    ```
*   **Error Responses:** `401`, `403` (Forbidden - user not enrolled), `404` (Not Found - course does not exist), `500`.

### 2.4. Get Specific Lesson for Enrolled Student

*   **Endpoint:** `GET /enrolled/:courseId/lessons/:lessonId`
*   **Description:** Retrieves the full content for a specific lesson within a course the user is enrolled in. Updates the `last_accessed_lesson_id` for the user's enrollment in this course.
*   **Access:** Private (Authenticated User, must be enrolled)
*   **URL Parameters:**
    *   `courseId` (UUID): The ID of the course.
    *   `lessonId` (UUID): The ID of the lesson.
*   **Success Response (200 OK):**
    ```json
    {
      "id": "lesson-uuid",
      "title": "Specific Lesson Title",
      "slug": "specific-lesson-slug",
      "lesson_type": "text",
      "content_url": null,
      "text_content": "<p>This is the full text content of the lesson.</p>",
      "duration_minutes": 20,
      "lesson_order": 1,
      "is_preview_allowed": false,
      "is_completed": false // User's completion status for this lesson
      // ... other lesson fields ...
    }
    ```
*   **Error Responses:** `401`, `403` (not enrolled), `404` (course or lesson not found), `500`.

### 2.5. Mark Lesson as Complete

*   **Endpoint:** `POST /enrolled/:courseId/lessons/:lessonId/complete`
*   **Description:** Marks a specific lesson as completed for the authenticated user within their enrollment for the course. Recalculates and updates the overall `progress_percent` for the course enrollment.
*   **Access:** Private (Authenticated User, must be enrolled)
*   **URL Parameters:**
    *   `courseId` (UUID): The ID of the course.
    *   `lessonId` (UUID): The ID of the lesson to mark complete.
*   **Request Body:** Empty.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Lesson marked as complete.",
      "progress_percent": 30, // Updated overall course progress
      "course_completed_at": null, // Timestamp if course completion reached 100%
      "lesson_id": "lesson-uuid",
      "completed": true
    }
    ```
*   **Error Responses:** `401`, `403` (not enrolled), `404` (course or lesson not found), `500`.

This suite of APIs provides the necessary functionality for users to discover, enroll in, and progress through online courses.
```
