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
  Wrench,
  Tag,
  PackageX,
  DollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  Unlink,
  LayoutGrid,
  Cable,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { TkElectricBrand } from "@/components/layout/TkElectricBrand";

const SIDEBAR_HIDDEN_KEY = "admin.sidebarHidden.v1";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isAdminRole } = useAuth();
  const { t, lang } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locale = lang === "ko" ? "ko-KR" : lang === "es" ? "es-MX" : "en-US";
  const headerDate = now.toLocaleDateString(
    locale,
    { weekday: "short", month: "long", day: "numeric", year: "numeric" },
  );
  const headerDateShort = now.toLocaleDateString(
    locale,
    { weekday: "short", month: "short", day: "numeric" },
  );
  const headerTime = now.toLocaleTimeString(
    locale,
    { hour: "numeric", minute: "2-digit", hour12: true },
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(SIDEBAR_HIDDEN_KEY, sidebarHidden ? "1" : "0"); } catch {}
  }, [sidebarHidden]);

  const navGroups = [
    {
      label: t.navMain,
      items: [
        { href: "/", label: t.navDashboard, icon: LayoutDashboard },
      ],
    },
    {
      label: t.navMaterials,
      items: [
        { href: "/inventory", label: t.navInventory, icon: PackageSearch },
        { href: "/transactions", label: t.navTransactions, icon: ArrowRightLeft },
        { href: "/reorder", label: t.navReorder, icon: ShoppingCart },
        { href: "/suppliers", label: t.navSuppliers, icon: Truck },
      ],
    },
    {
      label: t.navOperations,
      items: [
        { href: "/projects", label: t.navProjects, icon: Briefcase },
        { href: "/manpower", label: t.navManpower, icon: HardHat },
        { href: "/equipment", label: t.navEquipment, icon: Wrench },
      ],
    },
    {
      label: t.navReporting,
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
        { href: "/admin/sku", label: t.navSkuCleanup, icon: Tag },
        { href: "/admin/inactive-items", label: t.navInactiveItems, icon: PackageX },
        { href: "/admin/stock-pricing", label: t.navStockPricing, icon: DollarSign },
        { href: "/admin/supplier-cleanup", label: t.navSupplierCleanup, icon: Unlink },
        { href: "/admin/reel-id-cleanup", label: t.navReelIdCleanup, icon: Cable },
        { href: "/admin/monday", label: "Monday.com", icon: LayoutGrid },
        { href: "/admin/jibble", label: "Jibble 연동", icon: Clock },
      ],
    }] : []),
  ];

  const displayName = user?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? user?.email ?? "User";
  const initials = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border w-64">
      <div className="flex-1 px-3 py-5 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-1.5 whitespace-nowrap truncate">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 ${
                      isActive
                        ? "bg-brand-100 text-brand-700 font-semibold"
                        : "text-slate-600 hover:bg-brand-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 ${isActive ? "text-brand-700" : "text-slate-400"}`}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span className="text-sm truncate flex-1 min-w-0">{item.label}</span>
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
          onClick={() => setMobileMenuOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1"
          data-testid="nav-back-home"
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1 min-w-0">{t.backToHome}</span>
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
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 mt-1 text-sm h-9 whitespace-nowrap"
          onClick={() => logout()}
          data-testid="btn-sign-out"
        >
          <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate flex-1 min-w-0 text-left">{t.signOut}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen bg-background font-sans">
      {!sidebarHidden && (
        <div className="hidden md:block flex-shrink-0">
          <SidebarContent />
        </div>
      )}

      <button
        type="button"
        onClick={() => setSidebarHidden(s => !s)}
        aria-label={sidebarHidden ? t.adminShowSidebar : t.adminHideSidebar}
        title={sidebarHidden ? t.adminShowSidebar : t.adminHideSidebar}
        data-testid="btn-toggle-sidebar"
        className={`hidden md:flex absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-500 hover:text-brand-700 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${sidebarHidden ? "left-0" : "left-64"}`}
      >
        {sidebarHidden
          ? <PanelLeftOpen className="w-3.5 h-3.5" />
          : <PanelLeftClose className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="mode-header h-[68px] bg-gradient-to-r from-brand-50 via-white to-brand-50/50 border-b border-border border-t-[3px] border-t-brand-600 flex items-center justify-between px-3 sm:px-5 z-10 flex-shrink-0 shadow-[0_1px_0_rgba(22,163,74,0.12)]">
          <div className="mode-header-brand flex items-center gap-3 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-slate-600 md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <TkElectricBrand
              compact
              className="inventory-header-brand"
              textClassName="block"
              detail={
                <>
                  <span className="tk-header-detail hidden sm:flex text-amber-600 mt-1 items-center gap-1 whitespace-nowrap">
                    <Shield className="w-2.5 h-2.5 flex-shrink-0" /> {t.adminModeChip}
                    <span className="text-slate-400 font-normal">·</span>
                    <span className="tk-header-detail-date text-slate-500">{headerDate}</span>
                    <span className="text-slate-400 font-normal">·</span>
                    <span className="tk-header-detail-date text-slate-500">{headerTime}</span>
                  </span>
                  <span className="tk-header-detail flex sm:hidden text-amber-600 mt-1 items-center gap-1 whitespace-nowrap">
                    <Shield className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>{t.adminModeChip}</span>
                    <span className="text-slate-400 font-normal">·</span>
                    <span className="tk-header-detail-date text-slate-500">{headerDateShort}</span>
                    <span className="text-slate-400 font-normal">·</span>
                    <span className="tk-header-detail-date text-slate-500">{headerTime}</span>
                  </span>
                </>
              }
            />
          </div>

          <div className="mode-header-controls flex items-center gap-1.5 ml-3 pl-1.5 pr-1.5 py-1 rounded-[14px] border border-brand-200 bg-white/80 shadow-sm">
            {location !== "/" && (
              <Button
                variant="ghost"
                size="sm"
                className="tk-header-control h-8 gap-1.5 text-slate-500 hover:text-slate-800 whitespace-nowrap"
                onClick={() => window.history.back()}
                data-testid="btn-header-back"
              >
                <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{t.back}</span>
              </Button>
            )}
            <LanguageSwitcher theme="light" compact={true} />
            <Link href="/home">
              <Button
                variant="ghost"
                size="sm"
                className="tk-header-control h-8 gap-1.5 rounded-lg border border-brand-200 bg-white text-slate-600 whitespace-nowrap hover:border-brand-300 hover:bg-brand-50"
                data-testid="btn-header-back-home"
              >
                <Home className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{t.modeSelect}</span>
              </Button>
            </Link>
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
