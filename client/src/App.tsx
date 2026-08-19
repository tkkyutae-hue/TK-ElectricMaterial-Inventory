import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { FieldLayout } from "@/components/layout/FieldLayout";
import { TkElectricBrand } from "@/components/layout/TkElectricBrand";
import { useAuth } from "@/hooks/use-auth";
import { LanguageProvider, useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { FieldThemeProvider } from "@/hooks/use-field-theme";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { canAccessCrewDispatchAssignment } from "@/lib/role-access";

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
import Manpower from "@/pages/Manpower";
import WorkerDetail from "@/pages/WorkerDetail";
import Equipment from "@/pages/Equipment";
import Reorder from "@/pages/Reorder";
import ReorderArea from "@/pages/ReorderArea";
import Reports from "@/pages/Reports";
import DailyReport from "@/pages/DailyReport";
import DailyReportWorkspace from "@/pages/DailyReportWorkspace";
import CrewDispatch from "@/pages/CrewDispatch";
import CrewDispatchAssignment from "@/pages/CrewDispatchAssignment";
import UserApprovals from "@/pages/admin/UserApprovals";
import Export from "@/pages/admin/Export";
import SkuCleanup from "@/pages/admin/SkuCleanup";
import InactiveItems from "@/pages/admin/InactiveItems";
import StockPricing from "@/pages/admin/StockPricing";
import SupplierCleanup from "@/pages/admin/SupplierCleanup";
import ReelIdCleanup from "@/pages/admin/ReelIdCleanup";
import MondayIntegration from "@/pages/admin/MondayIntegration";
import JibbleIntegration from "@/pages/admin/JibbleIntegration";

import TvDashboard from "@/pages/TvDashboard";
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
  const { t, lang } = useLanguage();
  const label = backLabel ?? t.dailyReportMode;
  const headerDate = new Date().toLocaleDateString(
    lang === "ko" ? "ko-KR" : lang === "es" ? "es-MX" : "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  );
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <header style={{
        height: 76,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "10px clamp(12px, 3vw, 28px)",
        background: "linear-gradient(90deg, #f0faf3 0%, #ffffff 50%, #f0faf3 100%)",
        borderBottom: "1px solid #e2e8f0",
        borderTop: "3px solid #16803a",
        boxShadow: "0 1px 0 rgba(22,163,74,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <TkElectricBrand
            compact
            textClassName="hidden sm:block"
            detail={
              <span className="hidden sm:flex text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-1 items-center gap-1 whitespace-nowrap">
                <span>●</span> {t.projectOpsMode}
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-slate-500 font-medium normal-case tracking-normal">{headerDate}</span>
              </span>
            }
          />
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
            <span className="hidden sm:inline">{label}</span>
          </button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: 4, background: "#ffffff",
          border: "1px solid #b7dfc2", borderRadius: 14,
          boxShadow: "0 4px 14px rgba(15,31,23,0.06)",
        }}>
          <LanguageSwitcher theme="light" compact />
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto" }} className="px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}

function DailyReportRouter() {
  return (
    <ManagerGuard>
      <DailyReportLayout backTo="/crew-dispatch" backLabel="Crew Dispatch">
        <DailyReport />
      </DailyReportLayout>
    </ManagerGuard>
  );
}

function CrewDispatchRouter() {
  return (
    <ProjectOperationsGuard>
      <DailyReportLayout backTo="/home" backLabel="Home">
        <CrewDispatch />
      </DailyReportLayout>
    </ProjectOperationsGuard>
  );
}

function CrewDispatchAssignmentRouter() {
  return (
    <CrewDispatchGuard>
      <DailyReportLayout backTo="/crew-dispatch" backLabel="Crew Dispatch">
        <CrewDispatchAssignment />
      </DailyReportLayout>
    </CrewDispatchGuard>
  );
}

function DailyReportWorkspaceRouter() {
  return (
    <ManagerGuard>
      <DailyReportLayout backTo="/daily-report" backLabel="Project List">
        <DailyReportWorkspace />
      </DailyReportLayout>
    </ManagerGuard>
  );
}

// Allows admin + manager + staff into Daily Report; viewer/manager_viewer are redirected to /home
function ManagerGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canAccessDailyReport } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!canAccessDailyReport) return <Redirect to="/home" />;
  return <>{children}</>;
}

// Allows admin + manager + staff into the Project Operations hub.
// Worker assignment remains protected by CrewDispatchGuard below.
function ProjectOperationsGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, canAccessProjectOperations } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!canAccessProjectOperations) return <Redirect to="/home" />;
  return <>{children}</>;
}

// Allows admin + manager only into worker assignment.
function CrewDispatchGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!canAccessCrewDispatchAssignment(user.role)) return <Redirect to="/home" />;
  return <>{children}</>;
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
          <Route path="/manpower/:id" component={WorkerDetail} />
          <Route path="/manpower" component={Manpower} />
          <Route path="/equipment" component={Equipment} />
          <Route path="/reorder" component={ReorderArea} />
          <Route path="/reports" component={Reports} />
          <Route path="/admin/users" component={() => <AdminToolsGuard><UserApprovals /></AdminToolsGuard>} />
          <Route path="/admin/export" component={() => <AdminToolsGuard><Export /></AdminToolsGuard>} />
          <Route path="/admin/sku" component={() => <AdminToolsGuard><SkuCleanup /></AdminToolsGuard>} />
          <Route path="/admin/inactive-items" component={() => <AdminToolsGuard><InactiveItems /></AdminToolsGuard>} />
          <Route path="/admin/stock-pricing" component={() => <AdminToolsGuard><StockPricing /></AdminToolsGuard>} />
          <Route path="/admin/supplier-cleanup" component={() => <AdminToolsGuard><SupplierCleanup /></AdminToolsGuard>} />
          <Route path="/admin/reel-id-cleanup" component={() => <AdminToolsGuard><ReelIdCleanup /></AdminToolsGuard>} />
          <Route path="/admin/monday" component={() => <AdminToolsGuard><MondayIntegration /></AdminToolsGuard>} />
          <Route path="/admin/jibble" component={() => <AdminToolsGuard><JibbleIntegration /></AdminToolsGuard>} />
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
      <Route path="/tv" component={() => <AuthGuard><TvDashboard /></AuthGuard>} />
      <Route path="/field/:rest*" component={FieldRouter} />
      <Route path="/field" component={FieldRouter} />
      <Route path="/crew-dispatch/assignment" component={CrewDispatchAssignmentRouter} />
      <Route path="/crew-dispatch" component={CrewDispatchRouter} />
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
        <FieldThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </FieldThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
