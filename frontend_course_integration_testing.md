# Frontend Course Interface API Integration & Testing Plan (MVP)

This document describes how the React frontend components for Admin and Student course interfaces are integrated with their respective backend APIs. It also outlines a basic manual testing plan.

## I. API Integration - Conceptual Modifications

The following outlines how previously structured frontend components would be modified to integrate with backend APIs using the `apiClient` (assumed to be an Axios instance configured with base URL and interceptors for authentication tokens and `X-Cart-ID`).

### 1. Admin Interface API Integration

**`client/src/routing/ProtectedRoute.js` (Conceptual - from previous step)**
*   No API calls directly, but uses `useAuth()` (assumed AuthContext hook) to check `isAuthenticated` and `user.roles` to protect admin routes like `/admin/courses/*`.

**`client/src/pages/admin/courses/AdminCourseListPage.js`**
*   **Fetch Courses:**
    *   `fetchCourses(page)` function uses `await apiClient.get('/admin/courses', { params: { page, limit } });`.
    *   Called in `useEffect` on mount and on page change.
    *   Updates `courses` and `pagination` state. Manages `isLoading` and `error` states.
*   **Delete Course:**
    *   `handleDeleteCourse(courseId)` function:
        *   Shows `window.confirm()`.
        *   Calls `await apiClient.delete(`/admin/courses/${courseId}`);`.
        *   On success, calls `fetchCourses()` to refresh the list.
        *   Manages a local `isDeletingId` or general `isLoading` state and displays errors.

**`client/src/pages/admin/courses/AdminCourseEditPage.js`**
*   **State:** `course` (form data), `modules` (list), `lessons` (list for selected module), `categories` (for dropdown), `isLoadingSave`, `isLoadingDetails`, `errorSave`, `errorDetails`, `successMessage`.
*   **Fetch Course Details (Edit Mode):**
    *   `fetchCourseDetails()` (in `useEffect` if `courseId` is present):
        *   Calls `await apiClient.get(`/admin/courses/${courseId}`);`.
        *   Populates `course` state with response data. Sets `modules` from `response.data.modules`.
*   **Fetch Categories:**
    *   `fetchCategories()` (in `useEffect`): Calls `await apiClient.get('/catalog/categories');` (or a dedicated admin categories endpoint). Populates `categories` state.
*   **Course Form Submission (`handleSubmitCourse`):**
    *   If editing: `await apiClient.put(`/admin/courses/${courseId}`, courseData);`.
    *   If creating: `await apiClient.post('/admin/courses', courseData);`.
    *   Updates UI with success/error messages. Navigates on successful creation.
*   **Module/Lesson Sections:**
    *   These sections would fetch their respective data (e.g., modules via the course details endpoint, lessons via a new call if a module is selected: `apiClient.get(\`/admin/courses/${courseId}/modules/${moduleId}\`)` which should return lessons for that module).
    *   Buttons ("Add", "Edit", "Delete") trigger rendering of `ModuleForm` or `LessonForm`.

**`client/src/components/admin/courses/ModuleForm.js`**
*   **Form Submission (`handleSubmit`):**
    *   Receives `courseId` and optional `moduleData.id` (for edit).
    *   If editing: `await apiClient.put(\`/admin/courses/${courseId}/modules/${moduleData.id}\`, payload);`.
    *   If creating: `await apiClient.post(\`/admin/courses/${courseId}/modules\`, payload);`.
    *   Calls `onSave(savedModule)` prop on success.

**`client/src/components/admin/courses/LessonForm.js`**
*   **Form Submission (`handleSubmit`):**
    *   Receives `courseId`, `moduleId`, and optional `lessonData.id`.
    *   If editing: `await apiClient.put(\`/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonData.id}\`, payload);`.
    *   If creating: `await apiClient.post(\`/admin/courses/${courseId}/modules/${moduleId}/lessons\`, payload);`.
    *   Calls `onSave(savedLesson)` prop on success.

### 2. Student Interface API Integration

**`client/src/pages/courses/CourseListPage.js`**
*   **Fetch Published Courses (`fetchPublishedCourses`):**
    *   Uses `await apiClient.get('/courses/published', { params: { page, limit } });`.
    *   Updates `courses` and `pagination` state. Manages `isLoading` and `error`.

**`client/src/pages/courses/CourseDetailPage.js`**
*   **Fetch Course Details (`fetchCourseDetails`):**
    *   Uses `await apiClient.get(`/courses/published/${slug}`);`. Populates `course` state.
*   **Enroll Button (`handleEnroll`):**
    *   Checks `isAuthenticated` from `useAuth()`. If not, redirects to login.
    *   Calls `await apiClient.post(`/courses/${course.id}/enroll`);`.
    *   On success, updates UI (e.g., sets local `isEnrolled` state to true), shows alert, navigates to learning page.
    *   Handles errors (e.g., already enrolled).

**`client/src/pages/user/MyCoursesPage.js`**
*   **Fetch Enrolled Courses (`fetchEnrolledCourses`):**
    *   Requires `isAuthenticated`.
    *   Uses `await apiClient.get('/courses/enrolled', { params: { page, limit } });`.
    *   Updates `enrolledCourses` and `pagination` state.

**`client/src/pages/learning/LessonView.js`**
*   **Fetch Lesson & Course Structure (`fetchLessonDetails`):**
    *   Requires `isAuthenticated`.
    *   `await apiClient.get(\`/courses/enrolled/${courseId}/lessons/${lessonId}\`);` for lesson content.
    *   `await apiClient.get(\`/courses/enrolled/${courseId}\`);` for course structure (modules/lessons list for navigation). This could be optimized.
*   **Mark as Complete (`handleMarkAsComplete`):**
    *   Calls `await apiClient.post(\`/courses/enrolled/${courseId}/lessons/${lessonId}/complete\`);`.
    *   On success, updates local `lesson.is_completed` state, potentially navigates to next lesson.

## II. Basic Manual Testing Plan

### General Prerequisites:

*   Backend server is running with all course-related APIs.
*   Frontend development server is running.
*   Stripe (if course is paid) and other relevant services are in test mode.
*   Test user accounts with different roles ('admin', 'instructor', 'student') are available.
*   Stripe CLI for webhook forwarding (if testing payment-dependent enrollment).
*   `apiClient` is correctly configured with the backend URL and handles auth tokens.

### A. Admin Interface Test Flows

**A1: Admin - Full Course Creation Lifecycle**
*   **Preconditions:** Logged in as 'admin'. At least one course category exists.
*   **Steps:**
    1.  Navigate to `/admin/courses`. Verify list page loads (might be empty).
    2.  Click "Create New Course".
    3.  Fill in all course details (title, description, select category, set level, duration, cover URL, instructor ID - can be self admin ID or another). Keep "Is Published" unchecked.
    4.  Submit the course form.
        *   **Expected:** Redirect to edit page for the new course (`/admin/courses/:newCourseId/edit`). Success message.
    5.  On the edit page, add a new module (e.g., "Module 1: Introduction").
        *   **Expected:** Module appears in the modules list on the page after save.
    6.  For "Module 1", add a new lesson (e.g., "Lesson 1.1: Welcome", type 'text', add some content).
        *   **Expected:** Lesson appears under Module 1.
    7.  Add another lesson (e.g., "Lesson 1.2: Basics", type 'video', add a placeholder video URL).
        *   **Expected:** Lesson appears.
    8.  Edit "Module 1" details (e.g., change title or order).
        *   **Expected:** Module list updates.
    9.  Edit "Lesson 1.1" details (e.g., change content or title).
        *   **Expected:** Lesson details update.
    10. Go back to the Course Details form section on the edit page. Check "Is Published" and save.
        *   **Expected:** Success message. Course status updates.
    11. Navigate back to `/admin/courses`.
        *   **Expected:** The new course is listed with status "Published".
*   **Verification:** Check database for correct entries in `courses`, `course_modules`, `lessons`. Check slugs.

**A2: Instructor - Course Management (Own Courses)**
*   **Preconditions:** Logged in as 'instructor'. Instructor has at least one course assigned (or create one as admin and assign).
*   **Steps:**
    1.  Navigate to `/admin/courses`.
        *   **Expected:** Only courses where logged-in user is instructor are listed.
    2.  Attempt to edit a course they own.
        *   **Expected:** Edit page loads, all fields editable (except perhaps instructor_id unless admin features are merged).
    3.  Attempt to add/edit/delete modules and lessons for their own course.
        *   **Expected:** Operations succeed.
    4.  (If possible with test setup) Try to access edit page of a course they *don't* own via direct URL.
        *   **Expected:** Unauthorized error or redirect. Backend API should prevent actual data loading/modification.
    5.  Attempt to delete a course they own.
        *   **Expected:** Deletion succeeds after confirmation.

**A3: Admin/Instructor - Deletion Cascade**
*   **Preconditions:** Logged in as 'admin' or 'instructor'. A course with modules and lessons exists.
*   **Steps:**
    1.  Delete a lesson.
        *   **Expected:** Lesson is removed from list. Database confirms.
    2.  Delete a module (that had lessons).
        *   **Expected:** Module and its lessons are removed. Database confirms.
    3.  Delete a course.
        *   **Expected:** Course, its modules, and their lessons are removed. Database confirms.

### B. Student Interface Test Flows

**B1: Public - Course Discovery**
*   **Preconditions:** No user logged in. At least one course is "Published".
*   **Steps:**
    1.  Navigate to `/courses`.
        *   **Expected:** List of published courses is displayed. Pagination works if many courses.
    2.  Click on a course card.
        *   **Expected:** Navigates to `/courses/:slug`. Course details, modules, and lessons are displayed. Only lessons marked `is_preview_allowed` should show content (or links to it). Non-previewable lessons show titles/metadata only.
    3.  Attempt to access "My Courses" or a `/learn/...` URL.
        *   **Expected:** Redirected to login page by `ProtectedRoute`.

**B2: Student - Enrollment and Course Access**
*   **Preconditions:** Logged in as 'student'. A published course (preferably free for easy testing, or payment flow needs to be conceptually bypassed/mocked for this test if course is linked to a product).
*   **Steps:**
    1.  Navigate to a course detail page (`/courses/:slug`) for a course they are NOT yet enrolled in.
    2.  Click the "Enroll" button.
        *   **Expected:** "Enrolling..." state. Then success message/alert. UI might change to "Go to Course" or navigate to `/learn/:courseId`.
    3.  Navigate to `/my-courses`.
        *   **Expected:** The newly enrolled course is listed, showing 0% progress.
    4.  Click "Start Learning" (or similar) on the course card in "My Courses".
        *   **Expected:** Navigates to the first lesson or course overview within the learning interface (e.g., `/learn/:courseId` or `/learn/:courseId/lessons/:firstLessonId`).
    5.  From `LessonView`:
        *   View lesson content.
        *   Click "Mark as Complete".
            *   **Expected:** UI updates (e.g., button changes to "Completed", or a checkmark appears). Progress might update if displayed. (Alert for now).
        *   Navigate to the next lesson.
            *   **Expected:** Next lesson content loads. `last_accessed_lesson_id` should update in DB.
    6.  Complete all lessons in the course.
        *   **Expected:** Progress on "My Courses" page shows 100%. `enrollments.completed_at` in DB is set.
    7.  Revisit the course detail page (`/courses/:slug`).
        *   **Expected:** Button shows "Go to Course" or similar, not "Enroll".
    8.  Attempt to enroll again in the same course.
        *   **Expected:** Backend API should return an error (e.g., 409 Conflict), which is displayed to the user.

**B3: Student - Access Control**
*   **Preconditions:** Logged in as 'student'. One course user is enrolled in, one they are not.
*   **Steps:**
    1.  Attempt to navigate directly to a `LessonView` URL (`/learn/:courseId/lessons/:lessonId`) for a course they are *not* enrolled in.
        *   **Expected:** `ProtectedRoute` (or backend API response) prevents access, possibly showing an error or redirecting.
    2.  On a public course detail page (`/courses/:slug`) for a course they are *not* enrolled in, verify that lesson content (if any lessons are listed) is only shown for `is_preview_allowed = true` lessons.
        *   **Expected:** Non-previewable lessons only show titles/metadata.

This testing plan covers the core functionalities for both admin and student interfaces regarding course management and consumption. Each step implies verifying UI changes, API call success (via network tab if needed), and conceptual backend data integrity.
```
