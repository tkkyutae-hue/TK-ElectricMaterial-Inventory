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
  Home,
  Shield,
  Users,
  Download,
  ArrowLeft,
  HardHat,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import tkLogo from "@assets/tk_logo_1772726610288.png";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isAdminRole } = useAuth();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navGroups = [
    {
      label: t.navMain,
      items: [
        { href: "/", label: t.navDashboard, icon: LayoutDashboard },
        { href: "/inventory", label: t.navInventory, icon: PackageSearch },
        { href: "/transactions", label: t.navTransactions, icon: ArrowRightLeft },
      ],
    },
    {
      label: t.navOperations,
      items: [
        { href: "/suppliers", label: t.navSuppliers, icon: Truck },
        { href: "/projects", label: t.navProjects, icon: Briefcase },
        { href: "/manpower", label: t.navManpower, icon: HardHat },
        { href: "/equipment", label: t.navEquipment, icon: Cpu },
        { href: "/reorder", label: t.navReorder, icon: ShoppingCart },
      ],
    },
    {
      label: t.navInsights,
      items: [
        { href: "/reports", label: t.navReports, icon: BarChart3 },
      ],
    },
    // Admin Tools section: admin role only
    ...(isAdminRole ? [{
      label: t.navAdminTools,
      items: [
        { href: "/admin/users", label: t.navUserApprovals, icon: Users },
        { href: "/admin/export", label: t.navExportBackup, icon: Download },
      ],
    }] : []),
  ];

  const displayName = user?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? user?.email ?? "User";
  const initials = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border w-64">
      <Link href="/" className="px-5 py-4 flex items-center gap-3 border-b border-border hover:bg-brand-50 transition-colors">
        <img
          src={tkLogo}
          alt="TK Electric"
          className="h-11 w-auto object-contain flex-shrink-0"
          style={{ imageRendering: "crisp-edges" }}
        />
        <div className="min-w-0">
          <span className="font-display font-bold text-xl tracking-tight text-slate-900 leading-none block">TK Electric</span>
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-1 block flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 inline" /> {t.adminModeChip}
          </span>
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
                        ? "bg-brand-100 text-brand-700 font-semibold"
                        : "text-slate-600 hover:bg-brand-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 ${isActive ? "text-brand-700" : "text-slate-400"}`}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/home"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          data-testid="nav-back-home"
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          {t.backToHome}
        </Link>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <Avatar className="w-8 h-8 border border-border flex-shrink-0">
            <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 mt-1 text-sm h-9"
          onClick={() => logout()}
          data-testid="btn-sign-out"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t.signOut}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background font-sans">
      <div className="hidden md:block flex-shrink-0">
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[76px] bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 z-10 flex-shrink-0">
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

          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t.adminModeChip}
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {location !== "/" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-slate-500 hover:text-slate-800"
                onClick={() => window.history.back()}
                data-testid="btn-header-back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.back}</span>
              </Button>
            )}
            <Link href="/home">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-slate-600"
                data-testid="btn-header-back-home"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.modeSelect}</span>
              </Button>
            </Link>
            <LanguageSwitcher theme="light" />
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-brand-50 relative w-9 h-9">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
