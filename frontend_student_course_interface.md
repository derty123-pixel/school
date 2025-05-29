# Frontend Student Interface for Course Listing & Viewing (React MVP)

This document outlines the structure, components, and basic functionality of the MVP frontend student interface for browsing courses, enrolling, viewing enrolled courses, and consuming lesson content.

## 1. Route Setup (Conceptual)

The application's main router (e.g., in `App.js` using React Router DOM) would include routes like these:

```jsx
// import CourseListPage from './pages/courses/CourseListPage';
// import CourseDetailPage from './pages/courses/CourseDetailPage';
// import MyCoursesPage from './pages/user/MyCoursesPage';
// import LessonView from './pages/learning/LessonView';
// import ProtectedRoute from './routing/ProtectedRoute'; // Assumed to exist

// <Routes>
//   {/* Public Routes */}
//   <Route path="/courses" element={<CourseListPage />} />
//   <Route path="/courses/:slug" element={<CourseDetailPage />} />

//   {/* Protected Routes (for authenticated users) */}
//   <Route 
//     path="/my-courses" 
//     element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><MyCoursesPage /></ProtectedRoute>} 
//   />
//   <Route 
//     path="/learn/:courseId" // Could be a course landing/overview page for enrolled users
//     element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><CourseLearningPage /></ProtectedRoute>} // CourseLearningPage would show modules/lessons list
//   />
//   <Route 
//     path="/learn/:courseId/lessons/:lessonId" 
//     element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><LessonView /></ProtectedRoute>} 
//   />
  
//   {/* Other routes like login, home, etc. */}
// </Routes>
```
*Note: `CourseLearningPage` is a conceptual component that might list modules/lessons for an enrolled course and link to `LessonView`. For this MVP, `MyCoursesPage` links might go directly to `LessonView` or a simplified course overview within `LessonView`'s parent structure if needed.*

## 2. Core Student-Facing Components & Pages

### 2.1. `CourseListPage.js`

*   **Location:** `client/src/pages/courses/CourseListPage.js`
*   **Route (Conceptual):** `/courses`
*   **Purpose:** Displays a list of all publicly available (published) courses.
*   **Functionality:**
    *   **Data Fetching:** On mount, calls `GET /api/courses/published` to fetch courses (with pagination). Supports conceptual query params like `categoryId` or `instructorId`.
    *   **Display:** Renders courses in a grid or list format using a `CourseCard` sub-component.
    *   **`CourseCard` (Internal Component):** Shows course title, cover image (placeholder if none), brief description, instructor name, and price (or "Free"). Links to the course detail page.
    *   **State Management:** Uses local `useState` for `courses`, `isLoading`, `error`, and `pagination`.
    *   **Error Handling & Loading:** Displays loading indicators and error messages.
    *   **Pagination:** Includes controls to navigate course pages.

### 2.2. `CourseDetailPage.js`

*   **Location:** `client/src/pages/courses/CourseDetailPage.js`
*   **Route (Conceptual):** `/courses/:slug`
*   **Purpose:** Displays detailed information about a single publicly available course. Allows authenticated users to enroll.
*   **Functionality:**
    *   **Data Fetching:** On mount, gets `slug` from URL params and calls `GET /api/courses/published/:slug` to fetch course details.
    *   **Display:** Shows comprehensive course info (title, full description, instructor name, category, level, duration, price, cover image). Lists modules and their lessons. For lessons, it displays titles, duration, and indicates if a preview is available (`is_preview_allowed` from API). Actual lesson content (video/text) is only shown for previewable lessons if the API provides it (current public API only provides content for preview-allowed lessons).
    *   **Enrollment:**
        *   Displays an "Enroll" button.
        *   Uses `useAuth()` (assumed AuthContext hook) to check authentication status.
        *   If not authenticated, clicking "Enroll" redirects to login page (passing current location to return).
        *   If authenticated, clicking "Enroll" calls `POST /api/courses/:courseId/enroll`.
        *   Handles `isEnrolling` loading state and `enrollError` messages.
        *   On successful enrollment, updates local state (`isEnrolled`), shows a success message, and navigates to the course learning page (e.g., `/learn/:courseId`).
    *   **State Management:** Uses local `useState` for `course` data, `isLoading`, `error`, `isEnrolling`, `enrollError`, and `isEnrolled`.
*   **Styling:** Basic inline styles for structure.

### 2.3. `MyCoursesPage.js`

*   **Location:** `client/src/pages/user/MyCoursesPage.js`
*   **Route (Conceptual):** `/my-courses` (Protected Route)
*   **Purpose:** For authenticated users to view a list of courses they are enrolled in.
*   **Functionality:**
    *   **Data Fetching:** On mount (if authenticated), calls `GET /api/courses/enrolled` to fetch the user's enrolled courses (with pagination).
    *   **Display:** Renders enrolled courses using an `EnrolledCourseCard` sub-component.
    *   **`EnrolledCourseCard` (Internal Component):** Shows course title, cover image, instructor name, and the user's `progress_percent`. Includes a button/link like "Start Learning", "Continue Learning", or "Review Course" based on progress, linking to the relevant lesson view (e.g., `/learn/:courseId/lessons/:lastAccessedLessonId` or first lesson).
    *   **State Management:** Uses local `useState` for `enrolledCourses`, `isLoading`, `error`, and `pagination`.
*   **Styling:** Basic inline styles.

### 2.4. `LessonView.js`

*   **Location:** `client/src/pages/learning/LessonView.js`
*   **Route (Conceptual):** `/learn/:courseId/lessons/:lessonId` (Protected Route, also needs enrollment check).
*   **Purpose:** Displays the content of a specific lesson for an enrolled student. Allows marking lessons as complete.
*   **Functionality:**
    *   **Data Fetching:**
        *   On mount, gets `courseId` and `lessonId` from URL params.
        *   Calls `GET /api/courses/enrolled/:courseId/lessons/:lessonId` to fetch the specific lesson's full content.
        *   Calls `GET /api/courses/enrolled/:courseId` to fetch the overall course structure (modules/lessons list) for next/previous lesson navigation and to display course title. This could be optimized by fetching course structure once per course learning session.
    *   **Content Display:**
        *   Shows lesson title, type, duration.
        *   Renders content based on `lesson.lesson_type`:
            *   `video`: Basic iframe embed for YouTube/Vimeo URLs, or a link. (Could use `ReactPlayer` for more robust video).
            *   `text`: Renders HTML content (e.g., from `dangerouslySetInnerHTML` after sanitization, or using a Markdown renderer if content is Markdown).
            *   `document`: Provides a link to view/download the document.
            *   `quiz`: Placeholder text indicating future quiz functionality.
    *   **"Mark as Complete" Button:**
        *   If `lesson.is_completed` is false, shows the button.
        *   Clicking it calls `POST /api/courses/enrolled/:courseId/lessons/:lessonId/complete`.
        *   On success, updates the local lesson state to `is_completed: true`, shows a success message (e.g., with updated progress percentage), and potentially navigates to the next lesson.
        *   Handles `isCompleting` loading state and `completionError` messages.
    *   **Navigation:** Includes "Previous Lesson" and "Next Lesson" links/buttons based on the fetched course structure.
    *   **State Management:** Uses local `useState` for `lesson` data, `courseStructure`, `isLoading`, `error`, `isCompleting`, `completionError`.
*   **Styling:** Basic inline styles.

## 3. State Management Approach (MVP)

*   **Local Component State:** Primarily `useState` and `useEffect` within each page/component for managing form data, fetched data, loading states, and errors.
*   **Authentication Context (`AuthContext` - Assumed):** Used via a `useAuth()` hook to get `user` details (ID, roles) and `isAuthenticated` status. This is crucial for:
    *   Conditional rendering (e.g., "Enroll" vs. "Go to Course" button).
    *   Protecting routes using `ProtectedRoute`.
    *   Making authenticated API calls.
*   **No new global context for course progress in this MVP:** Lesson completion status and overall course progress are fetched with course/lesson data or updated via specific API calls and then reflected in local state or re-fetched. For more complex real-time progress updates across many components, a dedicated `CourseProgressContext` might be considered later.

## 4. API Interaction

*   All backend communication uses the pre-configured `apiClient` (`client/src/utils/api.js`), which handles attaching authentication tokens.
*   Error handling includes displaying messages from backend API responses.

This MVP structure provides the foundational UI for students to browse, enroll, and consume course content. Future enhancements would involve more sophisticated content rendering (e.g., dedicated video players, Markdown rendering, quiz engines), richer progress tracking displays, and potentially discussion forums or Q&A sections.
```
