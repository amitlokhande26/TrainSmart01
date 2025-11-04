import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  allowed: UserRole[];
}

export function ProtectedRoute({ allowed }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!user?.type) return <Navigate to="/" replace />;

  if (!allowed.includes(user.type)) {
    // Redirect based on role - managers also go to /admin
    const redirectPath = user.type === 'admin' || user.type === 'manager' ? '/admin' : 
                        user.type === 'supervisor' ? '/supervisor' : '/employee';
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
