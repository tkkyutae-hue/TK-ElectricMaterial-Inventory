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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div className="flex flex-col items-center gap-2 pt-2 pb-1">
            <img
              src={tkLogo}
              alt="TK Electric"
              className="h-24 w-auto object-contain"
              data-testid="img-tk-logo"
            />
            <p className="text-sm text-slate-500 font-medium">TK Electric Inventory Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                  data-testid="input-password"
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

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 bg-brand-700 hover:bg-brand-800 text-white font-semibold"
              data-testid="btn-login"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500">
            Don't have access?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-brand-700 font-semibold hover:underline"
              data-testid="link-request-access"
            >
              Request Access
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-6 text-xs text-slate-400">
        Created by Michael Kim
      </footer>
    </div>
  );
}
