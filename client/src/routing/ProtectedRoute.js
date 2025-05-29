import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext'; // Assuming an AuthContext

// Placeholder for useAuth hook if not actually implemented
const useAuth = () => {
  // Replace with actual auth context logic
  // For testing, you can mock this:
  // return { isAuthenticated: true, user: { roles: ['admin'] } }; // Simulate admin
  // return { isAuthenticated: true, user: { roles: ['instructor'] } }; // Simulate instructor
  return { isAuthenticated: false, user: null, isLoading: false }; // Simulate logged out or loading
  // return { isAuthenticated: true, user: { roles: ['student'] }, isLoading: false }; // Simulate student
};


const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth(); // Get auth state and user roles
  const location = useLocation();

  if (isLoading) {
    // Optional: Show a loading spinner while checking auth status
    return <div>Loading authentication status...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login page if not authenticated
    // Pass the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if the user has one of the allowed roles
  // Ensure user.roles is an array
  const userRoles = user?.roles || [];
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));
    if (!hasRequiredRole) {
      // Redirect to an unauthorized page or homepage if role not permitted
      console.warn(`User with roles [${userRoles.join(', ')}] does not have required roles [${allowedRoles.join(', ')}] for route ${location.pathname}`);
      return <Navigate to="/unauthorized" replace />; // Or to "/"
    }
  }

  // If authenticated and (no specific roles required OR user has required role), render the children
  return children;
};

export default ProtectedRoute;
