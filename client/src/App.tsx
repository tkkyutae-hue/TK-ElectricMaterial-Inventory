import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { FieldLayout } from "@/components/layout/FieldLayout";
import { useAuth } from "@/hooks/use-auth";

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
import UserApprovals from "@/pages/admin/UserApprovals";
import Export from "@/pages/admin/Export";

import FieldMovement from "@/pages/field/FieldMovement";
import FieldInventory from "@/pages/field/FieldInventory";
import FieldTransactions from "@/pages/field/FieldTransactions";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background" data-testid="admin-guard-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/home" />;
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
          <Route path="/admin/users" component={UserApprovals} />
          <Route path="/admin/export" component={Export} />
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
        <Route path="/field" component={() => <Redirect to="/field/movement" />} />
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
      <Route component={AdminRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
