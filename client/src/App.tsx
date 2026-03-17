import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { FieldLayout } from "@/components/layout/FieldLayout";
import { useAuth } from "@/hooks/use-auth";
import { LanguageProvider, useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import CategoryDetail from "@/pages/CategoryDetail";
import ItemDetails from "@/pages/ItemDetails";
import Transactions from "@/pages/Transactions";
import Suppliers from "@/pages/Suppliers";
import SupplierDetail from "@/pages/SupplierDetail";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Reorder from "@/pages/Reorder";
import Reports from "@/pages/Reports";
import DailyReport from "@/pages/DailyReport";
import DailyReportWorkspace from "@/pages/DailyReportWorkspace";
import UserApprovals from "@/pages/admin/UserApprovals";
import Export from "@/pages/admin/Export";

import FieldHome from "@/pages/field/FieldHome";
import FieldMovement from "@/pages/field/FieldMovement";
import FieldInventory from "@/pages/field/FieldInventory";
import FieldTransactions from "@/pages/field/FieldTransactions";

// Requires login only — no role restriction
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

// Standalone Daily Report layout — light theme, no admin sidebar, back-to-hub header
function DailyReportLayout({
  children,
  backTo = "/home",
  backLabel,
}: {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const label = backLabel ?? t.dailyReportMode;
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 20px",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <button
          data-testid="btn-daily-report-back"
          onClick={() => navigate(backTo)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#64748b", fontSize: 13, fontFamily: "'Barlow', sans-serif",
            padding: "6px 10px", borderRadius: 8,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#334155")}
          onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          <span>{label}</span>
        </button>
      </header>
      <main style={{ flex: 1, padding: "24px 32px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}

function DailyReportRouter() {
  return (
    <AuthGuard>
      <DailyReportLayout>
        <DailyReport />
      </DailyReportLayout>
    </AuthGuard>
  );
}

function DailyReportWorkspaceRouter() {
  return (
    <AuthGuard>
      <DailyReportLayout backTo="/daily-report" backLabel="Project List">
        <DailyReportWorkspace />
      </DailyReportLayout>
    </AuthGuard>
  );
}

// Allows admin + manager into Admin Mode; all others go back to /home
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canAccessAdminMode } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background" data-testid="admin-guard-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!canAccessAdminMode) return <Redirect to="/home" />;
  return <>{children}</>;
}

// Only admin can access Admin Tools (User Approvals, Export Backup)
function AdminToolsGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdminRole } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!isAdminRole) return <Redirect to="/" />;
  return <>{children}</>;
}

function AdminRouter() {
  return (
    <AdminGuard>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/inventory/category/:id" component={CategoryDetail} />
          <Route path="/inventory/:id" component={ItemDetails} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/suppliers/:id" component={SupplierDetail} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/reorder" component={Reorder} />
          <Route path="/reports" component={Reports} />
          <Route path="/admin/users" component={() => <AdminToolsGuard><UserApprovals /></AdminToolsGuard>} />
          <Route path="/admin/export" component={() => <AdminToolsGuard><Export /></AdminToolsGuard>} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AdminGuard>
  );
}

function FieldRouter() {
  return (
    <FieldLayout>
      <Switch>
        <Route path="/field" component={FieldHome} />
        <Route path="/field/movement" component={FieldMovement} />
        <Route path="/field/inventory" component={FieldInventory} />
        <Route path="/field/transactions" component={FieldTransactions} />
        <Route component={NotFound} />
      </Switch>
    </FieldLayout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route component={() => <Redirect to="/login" />} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={() => <Redirect to="/home" />} />
      <Route path="/signup" component={() => <Redirect to="/home" />} />
      <Route path="/home" component={Home} />
      <Route path="/field/:rest*" component={FieldRouter} />
      <Route path="/field" component={FieldRouter} />
      <Route path="/daily-report/:projectId" component={DailyReportWorkspaceRouter} />
      <Route path="/daily-report" component={DailyReportRouter} />
      <Route component={AdminRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
