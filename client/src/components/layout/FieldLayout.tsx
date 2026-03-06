import { Link, useLocation } from "wouter";
import { ArrowRightLeft, Search, ClipboardList, Home, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

const NAV = [
  { href: "/field/movement",     label: "Log Movement",   icon: ArrowRightLeft },
  { href: "/field/inventory",    label: "Inventory",      icon: Search },
  { href: "/field/transactions", label: "Transactions",   icon: ClipboardList },
];

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border w-64">
      <Link href="/home" className="px-5 py-4 flex items-center gap-3 border-b border-border hover:bg-brand-50 transition-colors">
        <img src={tkLogo} alt="TK Electric" className="h-11 w-auto object-contain flex-shrink-0" />
        <div className="min-w-0">
          <span className="font-display font-bold text-xl tracking-tight text-slate-900 leading-none block">TK Electric</span>
          <span className="text-[10px] font-semibold text-brand-700 uppercase tracking-wider mt-1 block">Field Mode</span>
        </div>
      </Link>

      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                data-testid={`nav-field-${label.replace(/\s/g, "-").toLowerCase()}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Back to Home */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <Link href="/home" onClick={() => setOpen(false)}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            data-testid="nav-field-back-home">
            <Home className="w-4 h-4 flex-shrink-0" />
            Back to Home
          </div>
        </Link>
        <div className="px-3 pt-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-brand-700">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{user?.firstName ?? "User"}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
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
            <Sheet open={open} onOpenChange={setOpen}>
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
              <span className="font-display font-bold text-base text-slate-900">Field Mode</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
              Field Mode
            </span>
          </div>

          <Link href="/home" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 border-slate-200" data-testid="btn-header-back-home">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
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
