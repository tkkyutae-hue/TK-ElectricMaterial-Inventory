import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await apiRequest("POST", "/api/auth/login", { email, password });
      const user = await resp.json();
      queryClient.setQueryData(["/api/auth/user"], user);
      navigate("/home");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4"
      style={{
        background: "linear-gradient(145deg, #074d1b 0%, #0A6B24 45%, #0d8a30 100%)",
      }}
    >
      {/* Decorative background orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -120, right: -120, width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -80, left: -80, width: 320, height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: "40%", left: "10%", width: 180, height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div className="w-full max-w-sm relative z-10">
        <div
          className="bg-white rounded-3xl p-8 space-y-5"
          style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.15)" }}
        >
          {/* Logo + brand */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <div className="relative">
              <img
                src={tkLogo}
                alt="TK Electric"
                className="h-20 w-auto object-contain"
                data-testid="img-tk-logo"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-[#0A6B24]" fill="#0A6B24" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">VoltStock</span>
              <Zap className="w-3 h-3 text-[#0A6B24]" fill="#0A6B24" />
            </div>
          </div>

          {/* Welcome heading */}
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-slate-900">Welcome back 👋</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to access your inventory</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
                className="h-11 rounded-xl border-slate-200 focus:border-[#0A6B24] focus:ring-[#0A6B24]/20"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-xl border-slate-200 pr-10 focus:border-[#0A6B24] focus:ring-[#0A6B24]/20"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-12 rounded-xl text-base font-bold tracking-wide transition-all duration-150"
              style={{
                background: loading || !email || !password
                  ? "#9ca3af"
                  : "linear-gradient(135deg, #0A6B24 0%, #0d8a30 100%)",
                boxShadow: loading || !email || !password
                  ? "none"
                  : "0 4px 16px rgba(10,107,36,0.35)",
              }}
              data-testid="btn-login"
            >
              {loading ? "Signing in…" : "Sign In →"}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500">
            Don't have access?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-[#0A6B24] font-bold hover:underline"
              data-testid="link-request-access"
            >
              Request Access
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-6 text-xs text-white/30 relative z-10">
        Created by Michael Kim
      </footer>
    </div>
  );
}
