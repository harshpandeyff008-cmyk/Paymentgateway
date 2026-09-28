import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guard component for generic authenticated routes.
 * Ensures user is authenticated, regardless of role.
 */
export const AuthGuard = ({ children }) => {
  const { currentUser, userDoc, loading } = useAuth();

  if (loading || (currentUser && !userDoc)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser || !userDoc) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Guard component for Administrator routes.
 * Ensures user is authenticated and is an admin.
 */
export const AdminGuard = ({ children }) => {
  const { currentUser, userDoc, loading } = useAuth();

  if (loading || (currentUser && !userDoc)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser || !userDoc) {
    return <Navigate to="/login" replace />;
  }

  const role = (userDoc?.role || '').toLowerCase().trim();

  if (role === 'employee' || role === 'staff') {
    return <Navigate to="/admin/ff-store" replace />;
  }

  if (role !== 'admin' && role !== 'superadmin') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return children;
};

/**
 * Guard component for Store Staff & Employee routes (FF Store).
 * Strictly allows ONLY Super Admin and Employee/Staff roles.
 * Normal Admin is completely blocked.
 */
export const StoreStaffGuard = ({ children }) => {
  const { currentUser, userDoc, loading } = useAuth();

  if (loading || (currentUser && !userDoc)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser || !userDoc) {
    return <Navigate to="/login" replace />;
  }

  const role = (userDoc?.role || '').toLowerCase().trim();

  // Normal admin is strictly blocked from FF Store
  if (role === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (role === 'client') {
    return <Navigate to="/client-dashboard" replace />;
  }

  // Only allow superadmin, employee, staff
  if (role !== 'superadmin' && role !== 'employee' && role !== 'staff') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Guard component for Client routes.
 * Ensures user is authenticated and is a client.
 */
export const ClientGuard = ({ children }) => {
  const { currentUser, userDoc, loading } = useAuth();

  if (loading || (currentUser && !userDoc)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentUser || !userDoc) {
    return <Navigate to="/login" replace />;
  }

  const role = (userDoc?.role || '').toLowerCase().trim();

  if (role === 'employee' || role === 'staff') {
    return <Navigate to="/admin/ff-store" replace />;
  }

  if (role !== 'client') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  return children;
};
