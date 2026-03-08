import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
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

  const canSubmit = !loading && !!email && !!password;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #EAF7EE 0%, #F7FBF8 50%, #FFFFFF 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Card */}
        <div
          className="bg-white rounded-3xl overflow-hidden"
          style={{
            boxShadow: "0 4px 24px rgba(10,107,36,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #D9E7DD",
          }}
        >
          {/* ── Brand header ── */}
          <div
            className="flex flex-col items-center gap-2 px-8 py-8"
            style={{ background: "linear-gradient(160deg, #EAF7EE 0%, #F3FAF5 100%)", borderBottom: "1px solid #D9E7DD" }}
          >
            <img
              src={tkLogo}
              alt="TK Electric"
              className="h-16 w-auto object-contain"
              data-testid="img-tk-logo"
            />
            <div className="text-center">
              <p className="text-base font-display font-bold text-slate-800">TK Electric</p>
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#0A6B24] uppercase mt-0.5">VoltStock · Field Operations</p>
            </div>
          </div>

          {/* ── Form section ── */}
          <div className="px-8 py-7 space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-display font-bold text-slate-900">Welcome back 👋</h1>
              <p className="text-sm text-slate-400 mt-1">Sign in to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-600">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@tkelectricllc.us"
                  autoComplete="email"
                  autoFocus
                  required
                  className="h-11 rounded-xl text-sm"
                  style={{ borderColor: "#D9E7DD" }}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-600">Password</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    required
                    className="h-11 rounded-xl pr-10 text-sm"
                    style={{ borderColor: "#D9E7DD" }}
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

              <button
                type="submit"
                disabled={!canSubmit}
                data-testid="btn-login"
                className="w-full h-12 rounded-xl text-base font-bold text-white transition-all duration-150 select-none"
                style={{
                  background: canSubmit
                    ? "linear-gradient(135deg, #0A6B24 0%, #0f8c30 100%)"
                    : "#d1d5db",
                  boxShadow: canSubmit ? "0 4px 14px rgba(10,107,36,0.30)" : "none",
                  transform: "scale(1)",
                }}
                onMouseDown={e => { if (canSubmit) (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
              >
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>

            <div className="text-center text-sm text-slate-400">
              Don't have access?{" "}
              <button
                onClick={() => navigate("/signup")}
                className="text-[#0A6B24] font-semibold hover:underline"
                data-testid="link-request-access"
              >
                Request Access
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">Created by Michael Kim</p>
      </div>
    </div>
  );
}
