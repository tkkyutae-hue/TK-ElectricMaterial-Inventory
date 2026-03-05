import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  PackageSearch, 
  ArrowRightLeft, 
  Truck, 
  Briefcase,
  ShoppingCart,
  BarChart3,
  LogOut,
  Bell,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full premium-card p-8 text-center space-y-6">
          <div className="flex items-center justify-center mb-2">
            <img
              src={tkLogo}
              alt="TK Electric"
              className="h-16 object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">TK Electric</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Inventory Management</p>
          </div>
          <p className="text-slate-500">Premium inventory management for electrical contractors.</p>
          <Button
            className="w-full h-12 text-lg font-semibold bg-brand-700 hover:bg-brand-800 text-white"
            onClick={() => window.location.href = '/api/login'}
          >
            Sign in with Replit
          </Button>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      label: "Main",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/inventory", label: "Inventory", icon: PackageSearch },
        { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/suppliers", label: "Suppliers", icon: Truck },
        { href: "/projects", label: "Projects", icon: Briefcase },
        { href: "/reorder", label: "Reorder", icon: ShoppingCart },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/reports", label: "Reports", icon: BarChart3 },
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border w-64">
      {/* Brand block */}
      <Link href="/" className="px-5 py-4 flex items-center gap-3 border-b border-border hover:bg-brand-50 transition-colors">
        <img
          src={tkLogo}
          alt="TK Electric"
          className="h-11 w-auto object-contain flex-shrink-0"
          style={{ imageRendering: "crisp-edges" }}
        />
        <div className="min-w-0">
          <span className="font-display font-bold text-xl tracking-tight text-slate-900 leading-none block">TK Electric</span>
          <p className="text-[11px] text-muted-foreground leading-none mt-1.5">Inventory Management</p>
        </div>
      </Link>

      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-100 text-brand-700 font-semibold'
                        : 'text-slate-600 hover:bg-brand-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 ${isActive ? 'text-brand-700' : 'text-slate-400'}`}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <Avatar className="w-8 h-8 border border-border flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl} />
            <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 mt-1 text-sm h-9"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:block flex-shrink-0">
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-slate-600">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img src={tkLogo} alt="TK Electric" className="h-7 w-auto object-contain" />
              <span className="font-display font-bold text-base text-slate-900">TK Electric</span>
            </div>
          </div>

          <div className="hidden md:block text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-brand-50 relative w-9 h-9">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
