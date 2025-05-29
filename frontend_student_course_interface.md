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
*   **Purpose:** Fetches and displays a list of all publicly available (published) courses, with pagination.
*   **State Management (Local):**
    *   `courses` (array): Stores the list of course objects fetched from the API.
    *   `isLoading` (boolean): Tracks loading state during API calls.
    *   `error` (string | null): Stores error messages if API calls fail.
    *   `pagination` (object): Stores pagination details received from the API (e.g., `{ currentPage, totalPages, totalCourses, limit }`). Default limit set to 9 for a 3x3 grid.
    *   (Filters for category/instructor are noted as a future consideration).
*   **Data Fetching:**
    *   Uses `useEffect` and a `fetchPublishedCourses(page)` function (wrapped in `useCallback`).
    *   On component mount and when `pagination.currentPage` changes (or filters change in future), it calls `fetchPublishedCourses`.
    *   `fetchPublishedCourses` makes a `GET` request to `/api/courses/published` using the `apiClient`.
    *   Pagination parameters (`page`, `limit`) are included in the API request.
    *   Updates `courses` and `pagination` state with the data from the API response.
    *   Manages `isLoading` and `error` states throughout the fetching process.
*   **Display:**
    *   Shows a main title (e.g., "Explore Our Courses").
    *   If `isLoading` is true (especially on initial load), displays a "Loading available courses..." message.
    *   If `error` is set, displays the error message with a retry button.
    *   If not loading and `courses` array is empty, displays a "No courses available..." message.
    *   If courses are available, it maps over the `courses` array and renders a `CourseCard` component (see section 2.1.1) for each course, arranging them in a responsive grid.
*   **Pagination Controls:**
    *   Displayed if `pagination.totalPages > 1`.
    *   Includes "Previous" and "Next" buttons, which are disabled appropriately.
    *   Includes page number buttons, with logic to display a limited set of page numbers and "..." for larger ranges.
    *   Clicking a page button or Next/Previous calls `handlePageChange(newPage)`, which calls `fetchPublishedCourses(newPage)` to fetch and display data for the new page.
*   **Styling:** Basic inline styles for page layout, course grid, loading/error messages, and pagination controls.

#### 2.1.1. `CourseCard.js` (Sub-component of `CourseListPage.js`)

*   **Location:** `client/src/components/courses/CourseCard.js`
*   **Purpose:** A presentational component to display a single course item in the `CourseListPage`.
*   **Props:**
    *   `course` (object): An object containing the course data. Expected structure from API:
        ```javascript
        {
          id: 'course-uuid',
          slug: 'course-slug-for-url',
          title: 'Course Title',
          cover_image_url: 'https://example.com/image.jpg', // Optional
          description: 'A brief summary of the course...', // Optional
          instructor_name: 'Instructor Name', // From backend join
          course_price: 49.99 // Numeric or null/undefined for "Free"
        }
        ```
*   **Functionality:**
    *   Displays the course's cover image (uses a placeholder if `cover_image_url` is not available).
    *   Shows the course title (truncated to ~2 lines).
    *   Shows a short description (truncated to ~3 lines).
    *   Displays the instructor's name.
    *   Displays the price (e.g., "$49.99") or "Free".
    *   The entire card content is wrapped in a `<Link>` from `react-router-dom` navigating to the course's detail page (`/courses/${course.slug}`).
*   **Styling:** Basic inline styles for card layout, fixed image height, text truncation (using WebkitLineClamp), and hover effect hint (actual hover effect would need CSS).

### 2.2. `CourseDetailPage.js`

*   **Location:** `client/src/pages/courses/CourseDetailPage.js`
*   **Route (Conceptual):** `/courses/:slug`
*   **Purpose:** Displays detailed information about a single publicly available course. Allows authenticated users to enroll.
*   **State Management (Local):**
    *   `course` (object | null): Stores the full course details including modules and lessons.
    *   `isLoading` (boolean): For the initial course data fetch.
    *   `error` (string | null): For errors during initial data fetch.
    *   `isEnrolling` (boolean): Loading state for the enrollment API call.
    *   `enrollmentError` (string | null): Errors specifically from the enrollment attempt.
    *   `isEnrolled` (boolean): Tracks if the current user is enrolled. Initialized to `false`; updated after a successful enrollment action on this page. A more robust global enrollment check is a future enhancement.
*   **Data Fetching:**
    *   Uses `useParams()` to get the course `slug` from the URL.
    *   On component mount (`useEffect`), calls `fetchCourseDetails()`.
    *   `fetchCourseDetails` (async function):
        *   Sets `isLoading` true.
        *   Calls `apiClient.get(\`/courses/published/\${slug}\`)`.
        *   On success, populates the `course` state with the response data.
        *   Sets `isLoading` false and handles/sets `error` state appropriately.
*   **Display:**
    *   Shows course title, full description (using `dangerouslySetInnerHTML` for potential HTML content), cover image, instructor name, level, duration, and price (or "Free").
    *   Lists modules and their lessons. For each lesson, it displays title, type, duration, and an indication if preview is allowed (`lesson.is_preview_allowed`).
    *   If `lesson.is_preview_allowed` is true, a link to a conceptual preview view is provided (e.g., `/learn/:courseId/lessons/:lessonId?preview=true`). The actual content for preview is limited by what the public API endpoint provides for lessons.
*   **Enrollment Button Logic:**
    *   Uses `useAuth()` (assumed AuthContext hook) to get `user`, `isAuthenticated`, and `authIsLoading`.
    *   Displays an "Enroll Now" button (or "Enroll for Free" / "Enroll Now ($Price)").
    *   If `isEnrolled` state is true, the button changes to "Go to Course" and links to the first lesson of the course (e.g., `/learn/:courseId/lessons/:firstLessonId`).
    *   The button is disabled if `course.is_published` is false, or during `isEnrolling` or `authIsLoading`.
    *   **`handleEnroll` Function (async):**
        1.  If user is not `isAuthenticated`, navigates to `/login` (passing current location for redirect back).
        2.  If authenticated, sets `isEnrolling` true and clears `enrollmentError`.
        3.  Calls `apiClient.post(\`/courses/\${course.id}/enroll\`)`.
        4.  On success: Sets `isEnrolled(true)`, shows an alert ("Successfully enrolled!"), and potentially navigates or relies on the "Go to Course" button update.
        5.  On failure: Sets `enrollmentError` with the error message from the API response.
        6.  Sets `isEnrolling` false.
*   **Loading and Error Display:**
    *   Shows a loading indicator for the initial course data fetch.
    *   Displays an error message if the initial fetch fails.
    *   The "Enroll" button shows "Enrolling..." and is disabled when `isEnrolling` is true.
    *   Displays `enrollmentError` messages near the enroll button.
*   **Styling:** Basic inline styles for structure and presentation.

### 2.3. `MyCoursesPage.js`

*   **Location:** `client/src/pages/user/MyCoursesPage.js`
*   **Route (Conceptual):** `/my-courses` (Protected Route: requires authenticated user).
*   **Purpose:** For authenticated users to view a list of courses they are enrolled in, along with their progress.
*   **State Management (Local):**
    *   `enrolledCourses` (array): Stores the list of enrolled course objects.
    *   `isLoading` (boolean): Tracks loading state for API calls.
    *   `error` (string | null): Stores error messages.
    *   `pagination` (object): Stores pagination details from the API.
*   **Data Fetching:**
    *   Uses `useAuth()` to check `isAuthenticated` and `authIsLoading`.
    *   On mount (or when `isAuthenticated` becomes true), calls `fetchEnrolledCourses(page)`.
    *   `fetchEnrolledCourses` makes a `GET` request to `/api/courses/enrolled` using `apiClient` (which sends auth token). Includes pagination parameters.
    *   Updates `enrolledCourses` and `pagination` state from the API response.
*   **Display:**
    *   Shows a title like "My Courses".
    *   Handles loading state (e.g., "Loading your courses...").
    *   Displays error messages if fetching fails (with a retry button).
    *   If authenticated and no courses are enrolled (and not loading/no error), shows a message like "You are not yet enrolled in any courses. [Explore available courses](/courses)!".
    *   If courses are available, maps over `enrolledCourses` and renders an `EnrolledCourseCard` component (see section 2.3.1) for each.
*   **Pagination Controls:** Implemented similarly to `CourseListPage.js` if `pagination.totalPages > 1`.
*   **Styling:** Basic inline styles.

#### 2.3.1. `EnrolledCourseCard.js` (Sub-component of `MyCoursesPage.js`)

*   **Location:** `client/src/components/user/EnrolledCourseCard.js`
*   **Purpose:** A presentational component to display a single enrolled course item.
*   **Props:**
    *   `course` (object): An object containing enrolled course data. Expected structure from API:
        ```javascript
        {
          id: 'course-uuid',
          title: 'Enrolled Course Title',
          slug: 'enrolled-course-slug', 
          cover_image_url: 'https://example.com/cover.jpg',
          instructor_name: 'Instructor Name',
          progress_percent: 25, 
          last_accessed_lesson_id: 'lesson-uuid-abc' // Optional
        }
        ```
*   **Functionality:**
    *   Displays course cover image, title, and instructor name.
    *   Shows a progress bar (visual representation of `course.progress_percent`).
    *   Displays the progress percentage as text.
    *   A button/link ("Start Learning", "Continue Learning", or "Review Course" based on `progress_percent`).
        *   Links to `/learn/:courseId/lessons/:lessonId` (using `last_accessed_lesson_id` if available).
        *   If `last_accessed_lesson_id` is not available and progress is 0, it might link to a general course learning page (`/learn/:courseId`) which would then redirect to the first lesson.
*   **Styling:** Basic inline styles for card layout, progress bar.

### 2.4. `LessonView.js`

*   **Location:** `client/src/pages/learning/LessonView.js`
*   **Route (Conceptual):** `/learn/:courseId/lessons/:lessonId` (Protected Route, requires user to be authenticated and enrolled).
*   **Purpose:** Displays the content of a specific lesson for an enrolled student and allows marking lessons as complete.
*   **State Management (Local):**
    *   `lesson` (object | null): Stores the current lesson's full data.
    *   `courseStructure` (object | null): Stores the parent course's structure (title, modules with their lessons including IDs, titles, order, and user's completion status for each lesson) for navigation and context.
    *   `isLoadingLesson`, `isLoadingStructure` (booleans): Loading states for initial data fetches.
    *   `error` (string | null): For errors during data fetching.
    *   `isCompleting` (boolean): Loading state for the "Mark as Complete" API call.
    *   `completionError` (string | null): Errors from the completion attempt.
    *   `isCurrentLessonCompleted` (boolean): Tracks if the currently viewed lesson is marked complete.
*   **Data Fetching (`useEffect` based on `courseId`, `lessonId`, `isAuthenticated`):**
    *   If not authenticated (checked via `useAuth()`), redirects to login.
    *   **`fetchCourseStructureAndLesson` (async function):**
        1.  Fetches overall course structure (including all lesson details and their completion statuses for the user) from `GET /api/courses/enrolled/:courseId`. This populates `courseStructure`.
        2.  Finds the current `lesson` data (including its `is_completed` status) from the fetched `courseStructure`.
        3.  Fetches detailed content for the specific `lessonId` from `GET /api/courses/enrolled/:courseId/lessons/:lessonId`. The backend for this endpoint also updates `last_accessed_lesson_id`.
        4.  Merges the detailed content into the lesson data found in the structure and sets the `lesson` state. Sets `isCurrentLessonCompleted`.
        5.  Handles loading and error states for these fetches.
*   **Content Display:**
    *   Shows course title (link back to course overview/`MyCoursesPage`) and current lesson title.
    *   Displays lesson metadata (type, duration).
    *   Renders lesson content based on `lesson.lesson_type`:
        *   `'video'`: Basic iframe embed for YouTube/Vimeo URLs (parsed from `lesson.content_url`). Links other video URLs. (Suggests `ReactPlayer` for richer support).
        *   `'text'`: Renders `lesson.text_content` (using `dangerouslySetInnerHTML` if HTML, suggests `ReactMarkdown` if Markdown).
        *   `'document'`: Provides a link to `lesson.content_url`.
        *   `'quiz'`: Displays a placeholder message.
*   **"Mark as Complete" Button:**
    *   Displayed if `!isCurrentLessonCompleted`. Disabled if `isCompleting`.
    *   **`handleMarkAsComplete` (async function):**
        1.  Sets `isCompleting` true.
        2.  Calls `apiClient.post(\`/courses/enrolled/\${courseId}/lessons/\${lessonId}/complete\`)`.
        3.  On success:
            *   Sets `isCurrentLessonCompleted(true)`.
            *   Updates `courseStructure` locally to reflect new progress percentage and this lesson's completion (for immediate UI feedback on navigation and progress bar if shown).
            *   Shows an alert with new progress.
            *   Navigates to the next lesson if one exists.
        4.  On failure: Sets `completionError`.
        5.  Sets `isCompleting` false.
*   **Lesson Navigation:**
    *   Uses `useMemo` with `courseStructure` and current `lessonId` to find the previous and next lessons.
    *   Renders "Previous Lesson" and "Next Lesson" `Link` components, disabled if at the beginning or end of the course.
*   **Styling:** Basic inline styles.

## 3. State Management Approach (MVP)

*   **Local Component State:** Primarily `useState` and `useEffect`.
*   **Authentication Context (`AuthContext` - Assumed):** Via `useAuth()` for `user` and `isAuthenticated`.
*   **No new global context for course progress in this MVP:** Progress is managed by fetching comprehensive course structure (including completion data per lesson) when viewing a course or lesson, and updating local state after "Mark as Complete" actions.

## 4. API Interaction

*   Uses `apiClient` for all backend calls.

This structure provides a functional interface for students to consume course content and track progress.
```
