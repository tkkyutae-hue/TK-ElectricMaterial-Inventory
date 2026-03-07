import { Link, useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import tkLogo from "@assets/tk_logo_1772726610288.png";
import { HardHat } from "lucide-react";

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isFieldHome = location === "/field";

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "#F0F2F5" }}>
      {/* Top header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 flex-shrink-0 shadow-sm">

        {/* Left: logo + company + FIELD pill */}
        <div className="flex items-center gap-3 min-w-0">
          <img src={tkLogo} alt="TK Electric" className="h-7 w-auto object-contain flex-shrink-0" />
          <div className="hidden sm:block leading-none min-w-0">
            <span className="font-display font-bold text-sm text-slate-900 block">TK Electric</span>
            <span className="text-[10px] text-slate-400">VoltStock</span>
          </div>
          {/* FIELD pill — matches mockup */}
          <div className="flex items-center gap-1.5 bg-[#EAF7EE] border border-[#b6dfc4] text-[#0A6B24] rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide flex-shrink-0">
            <HardHat className="w-3.5 h-3.5" />
            <span>Field</span>
          </div>
        </div>

        {/* Right: Back (if not on field home) + Home button + user avatar */}
        <div className="flex items-center gap-1">
          {!isFieldHome && (
            <Link href="/field">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-slate-500 hover:text-[#0A6B24] hover:bg-[#EAF7EE]"
                data-testid="btn-field-back"
                title="Back to Field Actions"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <Link href="/home">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-slate-500 hover:text-[#0A6B24] hover:bg-[#EAF7EE]"
              data-testid="btn-field-home"
              title="Mode Select"
            >
              <Home className="w-4 h-4" />
            </Button>
          </Link>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center ml-1 flex-shrink-0">
            <span className="text-xs font-bold text-slate-600">
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className={`flex-1 flex flex-col w-full mx-auto px-4 md:px-6 ${
          location.startsWith("/field/inventory") || location.startsWith("/field/transactions")
            ? "max-w-7xl"
            : location.startsWith("/field/movement")
            ? "max-w-[1100px]"
            : "max-w-6xl"
        }`}>
          {children}
        </div>
      </main>
    </div>
  );
}
