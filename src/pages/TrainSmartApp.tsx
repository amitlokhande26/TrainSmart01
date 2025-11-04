import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { LoginForm } from '@/components/auth/LoginForm';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { useAuth } from '@/contexts/AuthContext';

export function TrainSmartApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, needsPasswordReset, signOut } = useAuth();
  const hasNavigatedRef = useRef(false);
  const supervisorNavRef = useRef(false);

  // Redirect admin and manager users to /admin route when on root path
  useEffect(() => {
    if ((user?.type === 'admin' || user?.type === 'manager') && location.pathname === '/' && !hasNavigatedRef.current) {
      const navKey = sessionStorage.getItem('adminNavAttempt');
      if (!navKey) {
        sessionStorage.setItem('adminNavAttempt', Date.now().toString());
        hasNavigatedRef.current = true;
        navigate('/admin', { replace: true });
      }
    }
  }, [user?.type, location.pathname, navigate]);

  // Redirect supervisor users to /supervisor route when on root path
  useEffect(() => {
    if (user?.type === 'supervisor' && location.pathname === '/' && !supervisorNavRef.current) {
      const navKey = sessionStorage.getItem('supervisorNavAttempt');
      if (!navKey) {
        sessionStorage.setItem('supervisorNavAttempt', Date.now().toString());
        supervisorNavRef.current = true;
        navigate('/supervisor', { replace: true });
      }
    }
  }, [user?.type, location.pathname, navigate]);

  // Clear navigation flags when on respective routes or when user logs out
  useEffect(() => {
    if (location.pathname === '/admin') {
      sessionStorage.removeItem('adminNavAttempt');
      hasNavigatedRef.current = false;
    } else if (location.pathname === '/supervisor') {
      sessionStorage.removeItem('supervisorNavAttempt');
      supervisorNavRef.current = false;
    } else if (location.pathname !== '/') {
      sessionStorage.removeItem('adminNavAttempt');
      sessionStorage.removeItem('supervisorNavAttempt');
      hasNavigatedRef.current = false;
      supervisorNavRef.current = false;
    }
    if (!user?.type) {
      sessionStorage.removeItem('adminNavAttempt');
      sessionStorage.removeItem('supervisorNavAttempt');
      hasNavigatedRef.current = false;
      supervisorNavRef.current = false;
    }
  }, [location.pathname, user?.type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user?.type || needsPasswordReset) {
    return <LoginForm />;
  }

  // Show redirecting state if admin/manager is on root path
  if ((user.type === 'admin' || user.type === 'manager') && location.pathname === '/') {
    const hasNavigated = sessionStorage.getItem('adminNavAttempt') === 'true';
    if (hasNavigated) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Redirecting...</p>
          </div>
        </div>
      );
    }
  }

  // Show redirecting state if supervisor is on root path
  if (user.type === 'supervisor' && location.pathname === '/') {
    const hasNavigated = sessionStorage.getItem('supervisorNavAttempt');
    if (hasNavigated) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Redirecting...</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        userType={user.type}
        userName={user.name}
        onLogout={signOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.type === 'employee' ? (
          <EmployeeDashboard userName={user.name} />
        ) : null}
      </main>
    </div>
  );
}
