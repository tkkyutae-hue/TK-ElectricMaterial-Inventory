import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import ItemDetails from "@/pages/ItemDetails";
import Transactions from "@/pages/Transactions";
import Suppliers from "@/pages/Suppliers";
import Projects from "@/pages/Projects";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard}/>
        <Route path="/inventory" component={Inventory}/>
        <Route path="/inventory/:id" component={ItemDetails}/>
        <Route path="/transactions" component={Transactions}/>
        <Route path="/suppliers" component={Suppliers}/>
        <Route path="/projects" component={Projects}/>
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
