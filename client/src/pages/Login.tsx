import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pressed, setPressed] = useState(false);

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
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#0E1512" }}
    >
      {/* Subtle radial glow behind content */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(10,107,36,0.12) 0%, transparent 65%)",
        }}
      />

      <div className="w-full max-w-sm px-6 relative z-10">

        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-10">
          <img
            src={tkLogo}
            alt="TK Electric"
            className="h-20 w-auto object-contain mb-4"
            style={{ filter: "brightness(0) invert(1)" }}
            data-testid="img-tk-logo"
          />
          <p className="text-sm font-medium" style={{ color: "#4D7A61" }}>
            TK Electric Material Inventory
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#5A7A68" }}>
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@tkelectricllc.us"
              autoComplete="email"
              autoFocus
              required
              data-testid="input-email"
              className="h-11 text-sm font-medium border-0 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "1px solid rgba(255,255,255,0.10)",
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#5A7A68" }}>
              Password
            </label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
                data-testid="input-password"
                className="h-11 pr-10 text-sm font-medium border-0 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "1px solid rgba(255,255,255,0.10)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#4D7A61" }}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              data-testid="btn-login"
              className="w-full h-12 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all select-none"
              style={{
                background: canSubmit ? "#0A6B24" : "rgba(255,255,255,0.08)",
                color: canSubmit ? "white" : "#4D7A61",
                transform: pressed && canSubmit ? "scale(0.97)" : "scale(1)",
                boxShadow: canSubmit ? "0 0 24px rgba(10,107,36,0.35)" : "none",
                transition: "transform 0.1s, box-shadow 0.2s, background 0.2s",
              }}
              onMouseDown={() => setPressed(true)}
              onMouseUp={() => setPressed(false)}
              onMouseLeave={() => setPressed(false)}
            >
              {loading ? "Signing in…" : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#3D6050" }}>
          No account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="font-semibold transition-colors hover:underline"
            style={{ color: "#5DA873" }}
            data-testid="link-request-access"
          >
            Request Access
          </button>
        </p>

        <p className="text-center text-xs mt-4" style={{ color: "#2D4A3A" }}>
          Created by Kyutae Kim (Michael)
        </p>
      </div>
    </div>
  );
}
