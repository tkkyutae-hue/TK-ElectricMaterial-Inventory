import { Switch, Route, Redirect } from "wouter";
import { useEffect, useState, type CSSProperties } from "react";
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
import { FieldThemeProvider, FieldThemeSwitcher, useFieldTheme } from "@/hooks/use-field-theme";
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

// Standalone Project Operations layout — no admin sidebar, back-to-hub header.
// It shares the Field Mode theme preference so the mode selector, report list,
// and report workspace all switch together.
function DailyReportLayout({
  children,
  backTo = "/home",
  backLabel,
  brandLabel,
}: {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  brandLabel?: string;
}) {
  const [, navigate] = useLocation();
  const { t, lang } = useLanguage();
  const { theme, F } = useFieldTheme();
  const label = backLabel ?? t.dailyReportMode;
  const isDark = theme === "dark";
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locale = lang === "ko" ? "ko-KR" : lang === "es" ? "es-MX" : "en-US";
  const headerDate = now.toLocaleDateString(locale, {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
  const headerTime = now.toLocaleTimeString(locale, {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  const dailyReportThemeVars = {
    "--daily-report-ink": isDark ? F.text : "#1C1C1E",
    "--daily-report-paper": isDark ? F.surface2 : "#F7F5EF",
    "--daily-report-paper-muted": isDark ? F.surface : "#EFEBDF",
    "--daily-report-rule": isDark ? F.borderStrong : "#D8D3C4",
    "--daily-report-text-muted": isDark ? F.textSub : "#6B675C",
    "--daily-report-accent": isDark ? "#fb923c" : "#E85D04",
    "--daily-report-success": isDark ? "#4ade80" : "#3D8B37",
    "--daily-report-danger": isDark ? "#fb7185" : "#A3321C",
  } as CSSProperties;
  return (
    <div
      className="project-operations-shell"
      data-project-theme={theme}
      style={{
        ...dailyReportThemeVars,
        minHeight: "100vh",
        background: F.bg,
        color: F.text,
        display: "flex",
        flexDirection: "column",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <header className="mode-header" style={{
        height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "10px clamp(12px, 3vw, 28px)",
        background: `linear-gradient(90deg, ${F.bg} 0%, ${F.surface} 50%, ${F.bg} 100%)`,
        borderBottom: `1px solid ${F.borderStrong}`,
        borderTop: `3px solid ${F.accent}`,
        boxShadow: isDark ? "0 1px 0 rgba(45,219,111,0.12)" : "0 1px 0 rgba(22,163,74,0.12)",
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <div className="mode-header-brand" style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <TkElectricBrand
            compact
            textColor={F.text}
            brandLabel={brandLabel}
            textClassName="block"
            detail={
              <>
                <span className="tk-header-detail hidden sm:flex mt-1 items-center gap-1 whitespace-nowrap" style={{ color: F.accent }}>
                  <span>●</span> {t.projectOpsMode}
                  <span className="font-normal" style={{ color: F.textDim }}>·</span>
                  <span className="tk-header-detail-date" style={{ color: F.textMuted }}>{headerDate}</span>
                  <span className="font-normal" style={{ color: F.textDim }}>·</span>
                  <span className="tk-header-detail-date" style={{ color: F.textMuted }}>{headerTime}</span>
                </span>
                <span className="tk-header-detail project-header-mobile-detail hidden mt-1 items-center gap-1 whitespace-nowrap" style={{ color: F.accent }}>
                  <span>●</span>
                  <span>{t.projectOpsMode}</span>
                </span>
              </>
            }
          />
        </div>
        <div className="mode-header-controls" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: 4, background: F.surface,
          border: `1px solid ${F.borderStrong}`, borderRadius: 14,
          boxShadow: isDark ? "0 8px 18px rgba(0,0,0,0.22)" : "0 4px 14px rgba(15,31,23,0.06)",
          transition: "background 0.2s, border-color 0.2s",
        }}>
          <FieldThemeSwitcher compact />
          <LanguageSwitcher theme={theme} compact />
          <button
            data-testid="btn-daily-report-back"
            onClick={() => navigate(backTo)}
            className="tk-header-control"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 32, background: F.surface2, border: `1px solid ${F.borderStrong}`,
              cursor: "pointer", color: F.textMuted, fontSize: 12,
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              padding: "0 10px", borderRadius: 8, transition: "color 0.15s, border-color 0.15s, background 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = F.accent;
              e.currentTarget.style.borderColor = F.accentBorder;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = F.textMuted;
              e.currentTarget.style.borderColor = F.borderStrong;
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        </div>
      </header>
      <main
        style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto" }}
        className="project-operations-content px-4 py-6 sm:px-8"
      >
        {children}
      </main>
    </div>
  );
}

function DailyReportRouter() {
  const { t } = useLanguage();
  return (
    <ManagerGuard>
      <DailyReportLayout backTo="/crew-dispatch" backLabel={t.projectOpsMode}>
        <DailyReport />
      </DailyReportLayout>
    </ManagerGuard>
  );
}

function CrewDispatchRouter() {
  const { t } = useLanguage();
  return (
    <ProjectOperationsGuard>
      <DailyReportLayout backTo="/home" backLabel={t.modeSelect}>
        <CrewDispatch />
      </DailyReportLayout>
    </ProjectOperationsGuard>
  );
}

function CrewDispatchAssignmentRouter() {
  const { t } = useLanguage();
  return (
    <CrewDispatchGuard>
      <DailyReportLayout backTo="/crew-dispatch" backLabel={t.projectOpsMode} brandLabel={t.cdPageTitle}>
        <CrewDispatchAssignment />
      </DailyReportLayout>
    </CrewDispatchGuard>
  );
}

function DailyReportWorkspaceRouter() {
  const { t } = useLanguage();
  return (
    <ManagerGuard>
      <DailyReportLayout backTo="/daily-report" backLabel={t.dailyReportMode}>
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
