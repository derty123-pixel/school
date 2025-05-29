# Frontend Admin Interface for Course Management (React MVP)

This document outlines the structure, components, and basic functionality of the MVP frontend admin interface for managing courses, modules, and lessons.

## 1. Admin Route Protection

Admin sections of the application are protected using a conceptual `ProtectedRoute` component.

*   **`client/src/routing/ProtectedRoute.js`:**
    *   **Purpose:** Wraps admin routes to ensure only authenticated users with appropriate roles can access them.
    *   **Logic:**
        1.  Checks if the user is authenticated (e.g., using an `AuthContext`). If not, redirects to a login page.
        2.  If `allowedRoles` prop is provided, checks if the authenticated user's roles (e.g., `user.roles` from `AuthContext`) include at least one of the allowed roles.
        3.  If roles are not sufficient, redirects to an "Unauthorized" page or the homepage.
        4.  If authenticated and authorized, renders the child components.
    *   **Usage (Conceptual - in App.js or router setup):**
        ```jsx
        // import ProtectedRoute from './routing/ProtectedRoute';
        // import AdminCourseListPage from './pages/admin/courses/AdminCourseListPage';
        // import AdminCourseEditPage from './pages/admin/courses/AdminCourseEditPage';
        // ...
        // <Route 
        //   path="/admin/courses" 
        //   element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseListPage /></ProtectedRoute>} 
        // />
        // <Route 
        //   path="/admin/courses/new" 
        //   element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseEditPage /></ProtectedRoute>} 
        // />
        // <Route 
        //   path="/admin/courses/:courseId/edit" 
        //   element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseEditPage /></ProtectedRoute>} 
        // />
        ```

## 2. Core Admin Components & Pages

### 2.1. `AdminCourseListPage.js`

*   **Location:** `client/src/pages/admin/courses/AdminCourseListPage.js`
*   **Route (Conceptual):** `/admin/courses`
*   **Purpose:** Displays a list of courses for administrators or instructors. Allows navigation to create a new course or edit/delete existing ones.
*   **Functionality:**
    *   **Data Fetching:** On mount, calls `GET /api/admin/courses` to fetch courses (with pagination). Backend API handles returning all courses for admins or only instructor's own courses.
    *   **Display:** Renders courses in a table showing title, instructor email, category name, and published status.
    *   **Actions per Course:**
        *   "Edit" button: Navigates to `/admin/courses/:courseId/edit`.
        *   "Delete" button: Prompts for confirmation, then calls `DELETE /api/admin/courses/:courseId`. Refreshes the list on success.
    *   **Create Course:** A "Create New Course" button navigates to `/admin/courses/new`.
    *   **State Management:** Uses local `useState` for `courses`, `isLoading`, `error`, and `pagination` details.
    *   **Error Handling & Loading:** Displays loading indicators and error messages.
    *   **Pagination:** Includes controls to navigate course pages.

### 2.2. `AdminCourseEditPage.js`

*   **Location:** `client/src/pages/admin/courses/AdminCourseEditPage.js`
*   **Routes (Conceptual):** `/admin/courses/new` (for create), `/admin/courses/:courseId/edit` (for update).
*   **Purpose:** A combined page for creating a new course or editing an existing one. It also serves as the container for managing the course's modules and lessons.
*   **Functionality:**
    *   **Mode Detection:** Uses `courseId` from URL to determine "edit" or "create" mode.
    *   **Data Fetching (Edit Mode):**
        *   Fetches full course details (including nested modules and their lessons) from `GET /api/admin/courses/:courseId`.
        *   Fetches categories from `GET /api/catalog/categories` for the course form dropdown.
    *   **Course Form Section (`CourseForm.js`):**
        *   Renders `CourseForm.js` for course details (title, description, instructor, category, etc.).
        *   `handleSaveCourse` function makes `POST` or `PUT` requests to `/api/admin/courses`. On new course creation, navigates to its edit page.
    *   **Module Management Section (Displayed in Edit Mode):**
        *   Lists existing modules for the course. Each module shows title, order.
        *   "Edit" button per module: Sets `editingModule` state and shows `ModuleForm`.
        *   "Delete" button per module: Calls `DELETE /api/admin/courses/:courseId/modules/:moduleId` after confirmation, then re-fetches course data.
        *   "Add New Module" button: Clears `editingModule` and shows `ModuleForm`.
        *   Conditionally renders `ModuleForm.js`.
        *   `handleSaveModule` callback (passed to `ModuleForm`): Makes `POST` or `PUT` requests to `/api/admin/courses/:courseId/modules[/:moduleId]`. Re-fetches course data on success.
    *   **Lesson Management Section (Displayed in Edit Mode when a module is selected):**
        *   Clicking a module in the list sets it as `selectedModule` and displays its lessons.
        *   Lists lessons for the `selectedModule`. Each lesson shows title, type, order.
        *   "Edit" button per lesson: Sets `editingLesson` state and shows `LessonForm`.
        *   "Delete" button per lesson: Calls `DELETE /api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId` after confirmation, then re-fetches course data.
        *   "Add New Lesson to [Module Title]" button: Clears `editingLesson` and shows `LessonForm`.
        *   Conditionally renders `LessonForm.js`.
        *   `handleSaveLesson` callback (passed to `LessonForm`): Makes `POST` or `PUT` requests to `/api/admin/courses/:courseId/modules/:moduleId/lessons[/:lessonId]`. Re-fetches course data on success.
    *   **State Management:** Uses local `useState` for course data, modules list, selected module, lessons list for selected module, categories list, form visibility flags (`showModuleForm`, `showLessonForm`), editing states (`editingModule`, `editingLesson`), loading states (`isLoadingData`, `isSubmittingCourse`, `isSubmittingModule`, `isSubmittingLesson`), and error/success messages.
*   **Styling:** Basic inline styles for structure.

### 2.3. `CourseForm.js`

*   **Location:** `client/src/components/admin/courses/CourseForm.js`
*   **Purpose:** A reusable presentational component for the course creation/edit form fields.
*   **Props:** `initialData`, `categories`, `onSubmit` (callback to `AdminCourseEditPage`), `isSubmitting`.
*   **Functionality:** Renders inputs for title, description, instructor ID, category, product ID, level, duration, cover image, and published status. Calls `onSubmit` with form data.

### 2.4. `ModuleForm.js`

*   **Location:** `client/src/components/admin/courses/ModuleForm.js`
*   **Purpose:** A reusable form for creating or editing a course module.
*   **Props:** `courseId`, `moduleData` (for editing), `onSave` (callback to `AdminCourseEditPage`), `onCancel` (callback), `isProcessing`.
*   **Functionality:** Renders inputs for module title, description, and order. Calls `onSave` with form data.

### 2.5. `LessonForm.js`

*   **Location:** `client/src/components/admin/courses/LessonForm.js`
*   **Purpose:** A reusable form for creating or editing a lesson within a module.
*   **Props:** `courseId`, `moduleId`, `lessonData` (for editing), `onSave` (callback), `onCancel`, `isProcessing`.
*   **Functionality:** Renders inputs for lesson title, type (dropdown), content URL (conditional), text content (conditional), duration, order, and preview status. Calls `onSave` with form data.

## 3. State Management Approach (MVP)

*   **Local Component State:** Primarily uses `useState` and `useEffect` within `AdminCourseListPage.js` and `AdminCourseEditPage.js` for managing form data, fetched lists, selections, loading indicators, and error messages.
*   **Data Flow:**
    *   `AdminCourseEditPage.js` fetches the comprehensive course object (including modules and their lessons).
    *   This data is used to populate the initial state for modules list and potentially lessons list when a module is selected.
    *   When `ModuleForm` or `LessonForm` successfully saves data (via API calls handled in `AdminCourseEditPage.js`), `AdminCourseEditPage.js` re-fetches the entire course data to ensure all lists (modules and lessons for the currently selected module) are up-to-date. This simplifies state synchronization for MVP.
*   **No Global Admin Context (for this MVP):** A dedicated global state management solution for the admin section is not implemented to keep complexity focused.

## 4. API Interaction

*   All backend communication uses the pre-configured `apiClient` (`client/src/utils/api.js`), which handles authentication tokens.
*   Error handling includes displaying messages from backend API responses. Loading states are managed for user feedback during API calls.

This MVP structure provides a functional UI for admins and instructors to manage the full lifecycle of courses, modules, and lessons.
```
