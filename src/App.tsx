import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Employee from "@/pages/Employee";
import Admin from "@/pages/Admin";
import { lazy, Suspense } from "react";

const AdminLibrary = lazy(() => import("./pages/AdminLibrary"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminAssignments = lazy(() => import("./pages/AdminAssignments"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminEmployeeDetail = lazy(() => import("./pages/AdminEmployeeDetail"));
const AdminSignOffs = lazy(() => import("./pages/AdminSignOffs"));
import Supervisor from "./pages/Supervisor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
