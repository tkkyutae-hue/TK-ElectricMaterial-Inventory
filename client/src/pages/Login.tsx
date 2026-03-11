import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";

const CSS = `
@keyframes vs-fadeDown {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vs-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vs-flicker {
  0%,95%,97%,100% { opacity: 1; }
  96%             { opacity: 0.55; }
  98%             { opacity: 0.75; }
}
@keyframes vs-pulse-dot {
  0%,100% { transform: scale(1);   opacity: 1; }
  50%     { transform: scale(1.35); opacity: 0.6; }
}
@keyframes vs-arrow-slide {
  0%   { transform: translateX(0); }
  50%  { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
.vs-logo      { animation: vs-fadeDown 0.5s ease both; }
.vs-card      { animation: vs-fadeUp   0.5s ease 0.1s both; }
.vs-k         { animation: vs-flicker  6s ease-in-out 2s infinite; }
.vs-pulse-dot { animation: vs-pulse-dot 2.5s ease-in-out infinite; }
.vs-btn:hover .vs-arrow { animation: vs-arrow-slide 0.6s ease infinite; }
.vs-input {
  background: #141e17;
  border: 1px solid #203023;
  border-radius: 10px;
  padding: 11px 14px;
  color: #c8deca;
  font-size: 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.vs-input::placeholder { color: #2b3f2e; }
.vs-input:focus {
  border-color: #2ddb6f;
  box-shadow: 0 0 0 3px rgba(45,219,111,0.12);
}
.vs-btn {
  width: 100%;
  height: 48px;
  background: #2ddb6f;
  border: none;
  border-radius: 10px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #07090a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 0 24px rgba(45,219,111,0.2);
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
}
.vs-btn:hover:not(:disabled) {
  background: #35f07e;
  box-shadow: 0 0 36px rgba(45,219,111,0.38);
  transform: translateY(-1px);
}
.vs-btn:disabled {
  background: rgba(45,219,111,0.18);
  color: #2b3f2e;
  cursor: not-allowed;
  box-shadow: none;
}
`;

const BG_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "#07090a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
  fontFamily: "'Barlow', sans-serif",
};

const GRID_STYLE: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  backgroundImage: `
    linear-gradient(rgba(45,219,111,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45,219,111,0.03) 1px, transparent 1px)
  `,
  backgroundSize: "56px 56px",
  zIndex: 0,
};

const DIAGONAL_STYLE: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  backgroundImage: "repeating-linear-gradient(-45deg, #2ddb6f 0px, #2ddb6f 1px, transparent 1px, transparent 32px)",
  opacity: 0.018,
  zIndex: 0,
};

const GLOW_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "-80px", left: "50%",
  transform: "translateX(-50%)",
  width: 900, height: 700,
  background: "radial-gradient(ellipse, rgba(45,219,111,0.07) 0%, transparent 60%)",
  pointerEvents: "none",
  zIndex: 0,
};

export default function Login() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
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
      const msg: string = err?.message ?? "";
      if (msg.includes("401") || msg.toLowerCase().includes("invalid")) {
        setError(t.invalidCredentials);
      } else {
        setError(t.loginError);
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && !!email && !!password;

  return (
    <div style={BG_STYLE}>
      <style>{CSS}</style>

      {/* Background layers */}
      <div style={GLOW_STYLE} />
      <div style={GRID_STYLE} />
      <div style={DIAGONAL_STYLE} />

      {/* Language switcher — top right */}
      <div style={{ position: "absolute", top: 18, right: 20, zIndex: 20 }}>
        <LanguageSwitcher theme="dark" />
      </div>

      <div style={{ width: "100%", maxWidth: 380, padding: "0 24px", position: "relative", zIndex: 1 }}>

        {/* ── Logo Block ── */}
        <div className="vs-logo" style={{ textAlign: "center", marginBottom: 28 }}>

          {/* TK letters */}
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 88, lineHeight: 1, letterSpacing: 2, display: "flex", justifyContent: "center", gap: 2 }}>
            <span style={{
              color: "transparent",
              WebkitTextStroke: "1.8px rgba(255,255,255,0.85)",
            }}>T</span>
            <span className="vs-k" style={{
              color: "transparent",
              WebkitTextStroke: "1.8px #2ddb6f",
              filter: "drop-shadow(0 0 14px rgba(45,219,111,0.7)) drop-shadow(0 0 4px rgba(45,219,111,0.5))",
            }}>K</span>
          </div>

          {/* ELECTRIC LLC rule */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(45,219,111,0.22)" }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11,
              letterSpacing: 6,
              color: "rgba(45,219,111,0.55)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>ELECTRIC LLC</span>
            <div style={{ flex: 1, height: 1, background: "rgba(45,219,111,0.22)" }} />
          </div>

          {/* URL */}
          <div style={{ fontSize: 10, color: "#2b3f2e", marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
            www.tkglobal.us
          </div>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(45,219,111,0.08)",
            border: "1px solid rgba(45,219,111,0.22)",
            borderRadius: 20, padding: "5px 14px",
          }}>
            <span className="vs-pulse-dot" style={{
              display: "inline-block",
              width: 7, height: 7, borderRadius: "50%",
              background: "#2ddb6f",
              boxShadow: "0 0 6px #2ddb6f",
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, letterSpacing: 2,
              color: "rgba(45,219,111,0.7)", textTransform: "uppercase",
            }}>Material Inventory System</span>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="vs-card" style={{
          background: "#0b100d",
          border: "1px solid #203023",
          borderRadius: 20,
          boxShadow: "0 28px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}>
          {/* Top shine */}
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #2ddb6f, transparent)" }} />

          <div style={{ padding: 28 }}>
            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.email}</label>
                <input
                  type="email"
                  className="vs-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@tkelectricllc.us"
                  autoComplete="email"
                  autoFocus
                  required
                  data-testid="input-email"
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.password}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    className="vs-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    required
                    style={{ paddingRight: 42 }}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    tabIndex={-1}
                    style={{
                      position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#527856", padding: 0,
                      display: "flex", alignItems: "center",
                    }}
                    data-testid="btn-toggle-password"
                  >
                    {showPw ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)",
                  borderRadius: 10, padding: "10px 13px", marginBottom: 16,
                  color: "#FCA5A5", fontSize: 13,
                }}>
                  <AlertCircle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="vs-btn"
                data-testid="btn-login"
              >
                {loading ? t.signingIn : (
                  <>
                    <span>{t.signIn}</span>
                    <span className="vs-arrow" style={{ fontSize: 18, lineHeight: 1 }}>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Link */}
            <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#2b3f2e" }}>
              No account?{" "}
              <button
                onClick={() => navigate("/signup")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#2ddb6f", fontWeight: 600, fontSize: 13,
                  fontFamily: "inherit", padding: 0,
                  textDecoration: "underline", textUnderlineOffset: 3,
                }}
                data-testid="link-request-access"
              >
                Request Access
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#2b3f2e", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
          Created by Kyutae Kim (Michael) · TK Electric LLC
        </p>
      </div>
    </div>
  );
}
