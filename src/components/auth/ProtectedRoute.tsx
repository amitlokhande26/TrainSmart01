import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Role = 'admin' | 'employee';

interface ProtectedRouteProps {
  allowed: Role[];
}

export function ProtectedRoute({ allowed }: ProtectedRouteProps) {
  const [loading, setLoading] = React.useState(true);
  const [role, setRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    const derive = (session: any | null) => {
      const r =
        (session?.user?.app_metadata as any)?.role ||
        (session?.user?.user_metadata as any)?.role;
      const mapped: Role | null =
        r === 'admin' || r === 'manager' ? 'admin' : r ? 'employee' : null;
      setRole(mapped);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      derive(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      derive(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!role) return <Navigate to="/" replace />;

  if (!allowed.includes(role)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <Outlet />;
}


