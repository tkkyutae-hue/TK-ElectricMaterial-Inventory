import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, Shield, ArrowRightLeft, Search, ClipboardList, LayoutDashboard, Package, BarChart3, LogOut } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-9 w-auto object-contain" />
          <div>
            <span className="font-display font-bold text-lg text-slate-900 leading-none block">TK Electric</span>
            <span className="text-[11px] text-slate-400 leading-none">VoltStock</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-500">{displayName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-slate-500 hover:text-red-600 gap-1.5"
            data-testid="btn-home-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">
              Select Your Mode
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Choose the mode that matches your role for this session.
            </p>
          </div>

          <div className={`grid grid-cols-1 gap-5 ${isAdminRole ? "sm:grid-cols-2" : ""}`}>
            {/* ── Field Mode ── */}
            <button
              onClick={() => navigate("/field/movement")}
              data-testid="btn-field-mode"
              className="text-left group bg-white rounded-2xl border-2 border-slate-200 hover:border-brand-500 shadow-sm hover:shadow-lg transition-all duration-200 p-7 flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <HardHat className="w-6 h-6 text-brand-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-0.5">Field Mode</h2>
                <p className="text-sm text-slate-500 font-medium">Receive / Issue / Return + Stock Lookup</p>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  Log Receive / Issue / Return
                </li>
                <li className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  Search inventory (read-only)
                </li>
                <li className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  View transaction history
                </li>
              </ul>
              <div className="mt-auto pt-3 border-t border-slate-100">
                <span className="text-sm font-semibold text-brand-700 group-hover:text-brand-800">
                  Enter Field Mode →
                </span>
              </div>
            </button>

            {/* ── Admin Mode — only for admin role ── */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="text-left group bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-lg transition-all duration-200 p-7 flex flex-col gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <Shield className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-0.5">Admin Mode</h2>
                  <p className="text-sm text-slate-500 font-medium">Full management + master data</p>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    Dashboard + full inventory editing
                  </li>
                  <li className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    Suppliers / Projects / Reports / Reorder
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    User management + full transactions
                  </li>
                </ul>
                <div className="mt-auto pt-3 border-t border-slate-100">
                  <span className="text-sm font-semibold text-amber-600 group-hover:text-amber-700">
                    Enter Admin Mode →
                  </span>
                </div>
              </button>
            )}
          </div>

          {!isAdminRole && (
            <p className="text-center text-xs text-slate-400 mt-6">
              Role: <strong>{user?.role ?? "viewer"}</strong> — Contact an admin to request elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
