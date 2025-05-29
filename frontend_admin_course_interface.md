# Frontend Admin Interface for Course Management (React MVP)

This document outlines the structure, components, and basic functionality of the MVP frontend admin interface for managing courses, modules, and lessons.

## 1. Admin Route Protection

Admin sections of the application are protected using a conceptual `ProtectedRoute` component.

*   **`client/src/routing/ProtectedRoute.js` (Conceptual Structure):**
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
    *   **Display:** Renders courses in a table showing title, instructor email (from joined user data), category name (from joined category data), and published status.
    *   **Actions per Course:**
        *   "Edit" button: Navigates to `/admin/courses/:courseId/edit`.
        *   "Delete" button: Prompts for confirmation, then calls `DELETE /api/admin/courses/:courseId`. Refreshes the list on success.
    *   **Create Course:** A "Create New Course" button navigates to `/admin/courses/new`.
    *   **State Management:** Uses local `useState` for `courses`, `isLoading`, `error`, and `pagination` details.
    *   **Error Handling:** Displays error messages if fetching or deletion fails.
    *   **Loading State:** Shows loading indicators during data fetching.
    *   **Pagination:** Includes basic controls to navigate between pages of courses.

### 2.2. `AdminCourseEditPage.js`

*   **Location:** `client/src/pages/admin/courses/AdminCourseEditPage.js`
*   **Routes (Conceptual):** `/admin/courses/new` (for create), `/admin/courses/:courseId/edit` (for update).
*   **Purpose:** A combined page for creating a new course or editing an existing one. It also serves as the container for managing the course's modules and lessons.
*   **Functionality:**
    *   **Mode Detection:** Checks for `courseId` in URL parameters to determine if it's in "edit" or "create" mode.
    *   **Data Fetching (Edit Mode):** If `courseId` is present, calls `GET /api/admin/courses/:courseId` to fetch course details (including its modules and lessons as nested data). Also fetches available categories (e.g., from `GET /api/catalog/categories`) for a dropdown. (Fetching users for instructor selection is noted as TBD).
    *   **Course Form Section:**
        *   Form fields for: title, description, instructor ID (manual input for admin for now), category (dropdown), linked product ID (optional), level, duration estimate, cover image URL, and `is_published` (checkbox).
        *   `slug` is displayed as read-only in edit mode (as it's managed by the backend).
        *   **Submit:**
            *   For new course: `POST /api/admin/courses`. On success, navigates to the edit page for the newly created course (`/admin/courses/:newCourseId/edit`) to allow immediate module/lesson management.
            *   For existing course: `PUT /api/admin/courses/:courseId`. On success, shows a success message and optionally re-fetches course data.
    *   **Module Management Section (Displayed in Edit Mode):**
        *   Lists existing modules for the course (fetched with course details).
        *   Each module entry shows title, order, and "Edit"/"Delete" buttons (placeholder actions for now, would trigger `ModuleForm`).
        *   "Add New Module" button (placeholder action, would trigger `ModuleForm` for creation).
    *   **Lesson Management Section (Displayed in Edit Mode - Placeholder):**
        *   Intended to list lessons for a selected module.
        *   "Add New Lesson" button for the selected module (placeholder, would trigger `LessonForm`).
        *   Lesson items would have "Edit"/"Delete" buttons (placeholder).
    *   **State Management:** Uses local `useState` for `course` data, `modules` list, `categories` list, `isLoading`, `isFetchingDetails`, `error`, and `successMessage`.
    *   **Error/Success Handling:** Displays messages for API call outcomes.
*   **Styling:** Basic inline styles for structure.

### 2.3. `ModuleForm.js` (Conceptual Integration)

*   **Location:** `client/src/components/admin/courses/ModuleForm.js`
*   **Purpose:** A reusable form (likely rendered as a modal or inline section within `AdminCourseEditPage.js`) for creating or editing a course module.
*   **Functionality:**
    *   Takes `courseId`, optional `moduleData` (for editing), `onSave` callback, and `onCancel` callback as props.
    *   Form fields for module `title`, `description`, and `module_order`.
    *   **Submit:**
        *   For new module: `POST /api/admin/courses/:courseId/modules`.
        *   For existing module: `PUT /api/admin/courses/:courseId/modules/:moduleId`.
    *   Calls `onSave(savedModuleData)` on success, allowing `AdminCourseEditPage` to update its list of modules. Calls `onCancel` to hide the form.
    *   Manages its own `isLoading` and `error` state for the save operation.

### 2.4. `LessonForm.js` (Conceptual Integration)

*   **Location:** `client/src/components/admin/courses/LessonForm.js`
*   **Purpose:** A reusable form (likely modal or inline) for creating or editing a lesson within a module.
*   **Functionality:**
    *   Takes `courseId`, `moduleId`, optional `lessonData` (for editing), `onSave`, and `onCancel` as props.
    *   Form fields for lesson `title`, `lesson_type` (dropdown: 'video', 'text', 'quiz', 'document'), `content_url` (conditional based on type), `text_content` (conditional), `duration_minutes`, `lesson_order`, `is_preview_allowed` (checkbox).
    *   **Submit:**
        *   For new lesson: `POST /api/admin/courses/:courseId/modules/:moduleId/lessons`.
        *   For existing lesson: `PUT /api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId`.
    *   Calls `onSave(savedLessonData)` on success. Calls `onCancel` to hide.
    *   Manages its own `isLoading` and `error` state.

## 3. State Management Approach (MVP)

*   **Local Component State:** Primarily uses `useState` and `useEffect` within each page/component for managing form data, fetched lists, loading indicators, and error messages.
*   **Data Flow:** Data is fetched via `apiClient`. Callbacks (e.g., `onSave`) are used to pass data up from form components (ModuleForm, LessonForm) to the parent page (`AdminCourseEditPage`) to refresh lists or state.
*   **No Global Admin Context (for this MVP):** A dedicated global state management solution (like Context API or Zustand) for the admin section is not implemented in this MVP to keep complexity focused on core CRUD. If shared state across different admin sections becomes necessary (e.g., global notifications, shared user/role data beyond auth), a simple `AdminContext` could be introduced.

## 4. API Interaction

*   All backend communication uses the pre-configured `apiClient` (`client/src/utils/api.js`), which should handle attaching authentication tokens.
*   Error handling includes displaying messages from backend API responses.

This MVP structure provides the foundational UI for admins and instructors to manage course content. Further enhancements would include rich text editors for lesson content, drag-and-drop reordering for modules/lessons, more sophisticated instructor/category selection, and dedicated views for module/lesson editing if inline management becomes too cluttered.
```
