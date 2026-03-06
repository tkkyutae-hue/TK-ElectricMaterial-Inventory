import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Eye, EyeOff, HardHat, Shield, ArrowRightLeft, Search, ClipboardList, LayoutDashboard, Package, BarChart3, ShoppingCart } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isAdmin, verify, verifyPending, verifyError } = useAdminAuth();

  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleAdminVerify(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");
    try {
      await verify({ adminId, adminPassword });
      setShowAdminGate(false);
      navigate("/");
    } catch (err: any) {
      setLocalError(err?.message ?? "Invalid credentials");
    }
  }

  function openAdminGate() {
    if (isAdmin) {
      navigate("/");
    } else {
      setAdminId("");
      setAdminPassword("");
      setLocalError("");
      setShowAdminGate(true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-9 w-auto object-contain" />
          <div>
            <span className="font-display font-bold text-lg text-slate-900 leading-none block">TK Electric</span>
            <span className="text-[11px] text-slate-400 leading-none">VoltStock</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hidden sm:inline">{user?.firstName ?? user?.email}</span>
        </div>
      </header>

      {/* Hero */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* ── Field Mode card ── */}
            <button
              onClick={() => navigate("/field")}
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
                  View transactions (read-only)
                </li>
              </ul>

              <div className="mt-auto pt-3 border-t border-slate-100">
                <span className="text-sm font-semibold text-brand-700 group-hover:text-brand-800">
                  Enter Field Mode →
                </span>
              </div>
            </button>

            {/* ── Admin Mode card ── */}
            <button
              onClick={openAdminGate}
              data-testid="btn-admin-mode"
              className="text-left group bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-lg transition-all duration-200 p-7 flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-0.5">Admin Mode</h2>
                <p className="text-sm text-slate-500 font-medium">Full management (edit inventory + master data)</p>
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
                  Full transactions management (edit/delete)
                </li>
              </ul>

              <div className="mt-auto pt-3 border-t border-slate-100">
                <span className="text-sm font-semibold text-amber-600 group-hover:text-amber-700">
                  {isAdmin ? "Return to Admin →" : "Enter Admin Mode →"}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Admin Gate Modal ── */}
      <Dialog open={showAdminGate} onOpenChange={setShowAdminGate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-amber-600" />
              <DialogTitle>Admin Access Required</DialogTitle>
            </div>
            <p className="text-sm text-slate-500">
              Enter your admin credentials to access Admin Mode.
            </p>
          </DialogHeader>

          <form onSubmit={handleAdminVerify} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Admin ID</label>
              <Input
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
                placeholder="Enter admin ID"
                autoFocus
                autoComplete="username"
                data-testid="input-admin-id"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Admin Password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className="pr-10"
                  data-testid="input-admin-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(localError || verifyError) && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {localError || (verifyError as Error)?.message}
              </div>
            )}

            <Button
              type="submit"
              disabled={verifyPending || !adminId || !adminPassword}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="btn-admin-verify"
            >
              {verifyPending ? "Verifying…" : "Enter Admin Mode"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
