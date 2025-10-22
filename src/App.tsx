import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Employee from "@/pages/Employee";
import Admin from "@/pages/Admin";
import { lazy, Suspense, useEffect } from "react";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { IdleWarningModal } from "@/components/auth/IdleWarningModal";

const AdminLibrary = lazy(() => import("./pages/AdminLibrary"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminAssignments = lazy(() => import("./pages/AdminAssignments"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminEmployeeDetail = lazy(() => import("./pages/AdminEmployeeDetail"));
const AdminSignOffs = lazy(() => import("./pages/AdminSignOffs"));
const AdminMyTraining = lazy(() => import("./pages/AdminMyTraining"));
import Supervisor from "./pages/Supervisor";

const queryClient = new QueryClient();

// Wrapper component to handle idle timeout for authenticated routes
function AppWithIdleTimeout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/';
  
  // Enable idle timeout only when not on login page
  const { showWarning, secondsRemaining, stayLoggedIn } = useIdleTimeout({
    timeoutMinutes: 5,
    warningMinutes: 1,
    enabled: !isLoginPage
  });

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route element={<ProtectedRoute allowed={["employee"]} />}>
          <Route path="/employee" element={<Employee />} />
        </Route>
        <Route element={<ProtectedRoute allowed={["supervisor"]} />}>
          <Route path="/supervisor" element={<Supervisor />} />
        </Route>
        <Route element={<ProtectedRoute allowed={["admin"]} />}>
          <Route path="/admin" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="/admin/library" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminLibrary />
            </Suspense>
          } />
          <Route path="/admin/assignments" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminAssignments />
            </Suspense>
          } />
          <Route path="/admin/users" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminUsers />
            </Suspense>
          } />
          <Route path="/admin/users/:id" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminEmployeeDetail />
            </Suspense>
          } />
          <Route path="/admin/reports" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminReports />
            </Suspense>
          } />
          <Route path="/admin/signoffs" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminSignOffs />
            </Suspense>
          } />
          <Route path="/admin/mytraining" element={
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <AdminMyTraining />
            </Suspense>
          } />
        </Route>
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Idle Warning Modal */}
      <IdleWarningModal 
        isOpen={showWarning}
        secondsRemaining={secondsRemaining}
        onStayLoggedIn={stayLoggedIn}
      />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppWithIdleTimeout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
