import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import * as Sentry from "@sentry/react";

// Initialize Sentry
// TODO: Replace with actual DSN from environment variable or configuration
const SENTRY_DSN_FRONTEND = 'SENTRY_DSN_PLACEHOLDER_FRONTEND';
if (SENTRY_DSN_FRONTEND !== 'SENTRY_DSN_PLACEHOLDER_FRONTEND') {
  Sentry.init({
    dsn: SENTRY_DSN_FRONTEND,
    integrations: [
      // new Sentry.BrowserTracing(), // Default BrowserTracing
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of browser transactions. Adjust in production.
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, sample the session when an error occurs.
    environment: process.env.NODE_ENV || 'development',
    release: `client@0.1.0`, // Assuming version "0.1.0" from client/package.json
  });
  console.log("Sentry initialized for frontend");
} else {
  console.warn("Sentry DSN not provided. Sentry is not initialized for frontend.");
}


// --- Contexts (Assuming these exist and are set up) ---
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { CartProvider } from './context/CartContext';
// import { CheckoutProvider } from './context/CheckoutContext';

// --- General Components & Pages ---
// import HomePage from './pages/HomePage';
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';
// import UnauthorizedPage from './pages/UnauthorizedPage';
// import NotFoundPage from './pages/NotFoundPage';
// import ProtectedRoute from './routing/ProtectedRoute';

// --- Course Related Pages (Student/Public) ---
import CourseListPage from './pages/courses/CourseListPage';
import CourseDetailPage from './pages/courses/CourseDetailPage';
// import MyCoursesPage from './pages/user/MyCoursesPage';
// import LessonView from './pages/learning/LessonView';
// import CourseLearningPage from './pages/learning/CourseLearningPage'; // Conceptual parent for LessonView

// --- Admin Course Related Pages ---
import AdminCourseListPage from './pages/admin/courses/AdminCourseListPage';
import AdminCourseEditPage from './pages/admin/courses/AdminCourseEditPage';

// --- Cart & Checkout Pages ---
// import CartPage from './pages/CartPage';
// import CheckoutPage from './pages/CheckoutPage';
// import OrderConfirmationPage from './pages/OrderConfirmationPage';


// --- Mock AuthContext and useAuth for example ---
const AuthContext = React.createContext(null);
const useAuth = () => React.useContext(AuthContext);

const AuthProvider = ({ children }) => {
  // This is a mock. Replace with your actual AuthProvider.
  // To test different roles, change the user object here.
  const [mockUser, setMockUser] = React.useState(
    // { id: 'admin-user-id', roles: ['admin', 'instructor'], email: 'admin@example.com' } // Admin User
    // { id: 'instructor-user-id', roles: ['instructor'], email: 'instructor@example.com' } // Instructor User
    // { id: 'student-user-id', roles: ['student'], email: 'student@example.com' } // Student User
    null // Logged out
  );
  const [isLoadingAuth, setIsLoadingAuth] = React.useState(false); // Simulate auth loading

  const login = (role = 'student') => {
    setIsLoadingAuth(true);
    setTimeout(() => { // Simulate API call
        if (role === 'admin') setMockUser({ id: 'admin-user-id', roles: ['admin', 'instructor'], email: 'admin@example.com'});
        else if (role === 'instructor') setMockUser({ id: 'instructor-user-id', roles: ['instructor'], email: 'instructor@example.com'});
        else setMockUser({ id: 'student-user-id', roles: ['student'], email: 'student@example.com'});
        setIsLoadingAuth(false);
    }, 500);
  };
  const logout = () => {
    setIsLoadingAuth(true);
    setTimeout(() => {
        setMockUser(null);
        setIsLoadingAuth(false);
    }, 500)
  };

  const value = { user: mockUser, isAuthenticated: !!mockUser, isLoading: isLoadingAuth, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Mock ProtectedRoute ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = React.useLocation();

  if (isLoading) return <div>Checking authentication...</div>;
  if (!isAuthenticated) return <Navigate to="/login-placeholder" state={{ from: location }} replace />;
  
  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = user?.roles || [];
    if (!userRoles.some(role => allowedRoles.includes(role))) {
      return <Navigate to="/unauthorized-placeholder" replace />;
    }
  }
  return children;
};

// --- Simple Placeholder Pages ---
const HomePage = () => <div><h1>Home</h1><p>Welcome! Explore our platform.</p></div>;
const LoginPage = () => {
    const { login, isAuthenticated, logout, user } = useAuth();
    if (isAuthenticated) return <div><p>Logged in as {user.email}.</p><button onClick={logout}>Logout</button></div>
    return (
        <div>
            <h1>Login Placeholder</h1>
            <button onClick={() => login('student')}>Login as Student</button><br/><br/>
            <button onClick={() => login('instructor')}>Login as Instructor</button><br/><br/>
            <button onClick={() => login('admin')}>Login as Admin</button>
        </div>
    );
};
const UnauthorizedPage = () => <div><h1>Unauthorized</h1><p>You do not have permission to view this page.</p></div>;
const MyCoursesPage = () => <div><h1>My Enrolled Courses</h1><p>List of courses I am taking...</p> (Full component not implemented in this step) </div>;
const LessonView = () => <div><h1>Lesson View</h1><p>Viewing a lesson...</p> (Full component not implemented in this step) </div>;


function AppInternal() { // Renamed original App to AppInternal
  return (
    <AuthProvider> {/* Mock AuthProvider */}
      <Router>
        <div>
          <nav>
            <ul style={{ listStyle: 'none', display: 'flex', gap: '20px', padding: '10px', background: '#f0f0f0' }}>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/courses">Courses</Link></li>
              <li><Link to="/my-courses">My Courses (Protected)</Link></li>
              <li><Link to="/admin/courses">Admin Courses (Protected)</Link></li>
              <li><Link to="/login-placeholder">Login/Logout</Link></li>
            </ul>
          </nav>
          <hr />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login-placeholder" element={<LoginPage />} />
            <Route path="/unauthorized-placeholder" element={<UnauthorizedPage />} />
            
            {/* Public Course Routes */}
            <Route path="/courses" element={<CourseListPage />} />
            <Route path="/courses/:slug" element={<CourseDetailPage />} />

            {/* Student Protected Routes */}
            <Route 
              path="/my-courses" 
              element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><MyCoursesPage /></ProtectedRoute>} 
            />
            <Route 
              path="/learn/:courseId" // Assuming a general learning page that might show modules then lessons
              element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><LessonView /></ProtectedRoute>} // Simplified to LessonView for now
            />
            <Route 
              path="/learn/:courseId/lessons/:lessonId" 
              element={<ProtectedRoute allowedRoles={['student', 'admin', 'instructor']}><LessonView /></ProtectedRoute>} 
            />

            {/* Admin Course Routes */}
            <Route 
              path="/admin/courses" 
              element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseListPage /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/courses/new" 
              element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseEditPage /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/courses/:courseId/edit" 
              element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AdminCourseEditPage /></ProtectedRoute>} 
            />
            
            {/* Add other routes for cart, checkout, etc. here */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Wrap AppInternal with Sentry.ErrorBoundary
function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>An error has occurred. Our team has been notified.</p>}>
      <AppInternal />
    </Sentry.ErrorBoundary>
  );
}

export default App;
