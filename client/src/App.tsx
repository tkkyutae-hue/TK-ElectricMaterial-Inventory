import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard}/>
        <Route path="/inventory" component={Inventory}/>
        <Route path="/inventory/category/:id" component={CategoryDetail}/>
        <Route path="/inventory/:id" component={ItemDetails}/>
        <Route path="/transactions" component={Transactions}/>
        <Route path="/suppliers" component={Suppliers}/>
        <Route path="/suppliers/:id" component={SupplierDetail}/>
        <Route path="/projects" component={Projects}/>
        <Route path="/projects/:id" component={ProjectDetail}/>
        <Route path="/reorder" component={Reorder}/>
        <Route path="/reports" component={Reports}/>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
