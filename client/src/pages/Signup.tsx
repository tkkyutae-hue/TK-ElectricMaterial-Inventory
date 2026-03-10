import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
.vs-input-error {
  border-color: rgba(239,68,68,0.5) !important;
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
  padding: "40px 0",
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

function getPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#2ddb6f"];
const STRENGTH_LABELS = ["Weak", "Fair", "Strong", "Very Strong"];

export default function Signup() {
  const [, navigate] = useLocation();
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const pwStrength    = getPasswordStrength(password);
  const pwMismatch    = confirmPw.length > 0 && confirmPw !== password;
  const canSubmit     = !loading && !!name && !!email && !!password && !!confirmPw && !pwMismatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPw) { setError("Passwords do not match"); return; }
    if (password.length < 6)    { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", { name, email, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={BG_STYLE}>
        <style>{CSS}</style>
        <div style={GLOW_STYLE} />
        <div style={GRID_STYLE} />
        <div style={DIAGONAL_STYLE} />
        <div className="vs-card" style={{
          width: "100%", maxWidth: 380, margin: "0 24px",
          background: "#0b100d", border: "1px solid #203023",
          borderRadius: 20, boxShadow: "0 28px 60px rgba(0,0,0,0.6)",
          overflow: "hidden", position: "relative", zIndex: 1,
        }}>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #2ddb6f, transparent)" }} />
          <div style={{ padding: 36, textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(45,219,111,0.12)", border: "1px solid rgba(45,219,111,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle2 style={{ width: 28, height: 28, color: "#2ddb6f" }} />
            </div>
            <h2 style={{ color: "#c8deca", fontSize: 20, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              Request Submitted
            </h2>
            <p style={{ color: "#527856", fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
              Your account is pending admin approval. You'll receive an email once your access is granted.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="vs-btn"
              data-testid="btn-back-login"
            >
              Back to Sign In
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#2b3f2e", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, position: "relative", zIndex: 1 }}>
          Created by Kyutae Kim (Michael) · TK Electric LLC
        </p>
      </div>
    );
  }

  return (
    <div style={BG_STYLE}>
      <style>{CSS}</style>

      <div style={GLOW_STYLE} />
      <div style={GRID_STYLE} />
      <div style={DIAGONAL_STYLE} />

      <div style={{ width: "100%", maxWidth: 380, padding: "0 24px", position: "relative", zIndex: 1 }}>

        {/* ── Logo Block ── */}
        <div className="vs-logo" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 88, lineHeight: 1, letterSpacing: 2, display: "flex", justifyContent: "center", gap: 2 }}>
            <span style={{ color: "transparent", WebkitTextStroke: "1.8px rgba(255,255,255,0.85)" }}>T</span>
            <span className="vs-k" style={{
              color: "transparent",
              WebkitTextStroke: "1.8px #2ddb6f",
              filter: "drop-shadow(0 0 14px rgba(45,219,111,0.7)) drop-shadow(0 0 4px rgba(45,219,111,0.5))",
            }}>K</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(45,219,111,0.22)" }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, letterSpacing: 6, color: "rgba(45,219,111,0.55)",
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}>ELECTRIC LLC</span>
            <div style={{ flex: 1, height: 1, background: "rgba(45,219,111,0.22)" }} />
          </div>
          <div style={{ fontSize: 10, color: "#2b3f2e", marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
            www.tkglobal.us
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(45,219,111,0.08)", border: "1px solid rgba(45,219,111,0.22)",
            borderRadius: 20, padding: "5px 14px",
          }}>
            <span className="vs-pulse-dot" style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: "#2ddb6f", boxShadow: "0 0 6px #2ddb6f", flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, letterSpacing: 2, color: "rgba(45,219,111,0.7)", textTransform: "uppercase",
            }}>Material Inventory System</span>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="vs-card" style={{
          background: "#0b100d", border: "1px solid #203023",
          borderRadius: 20, boxShadow: "0 28px 60px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #2ddb6f, transparent)" }} />

          <div style={{ padding: 28 }}>

            {/* Amber notice */}
            <div style={{
              background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.18)",
              borderRadius: 10, padding: "11px 14px", marginBottom: 20,
              fontSize: 12, color: "#d4a04a", lineHeight: 1.55,
            }}>
              🔒 Admin approval required. Your request will be reviewed and you'll receive an email once access is granted.
            </div>

            <form onSubmit={handleSubmit}>

              {/* Full Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>Full Name</label>
                <input
                  type="text"
                  className="vs-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Smith"
                  required
                  autoFocus
                  data-testid="input-name"
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>Email</label>
                <input
                  type="email"
                  className="vs-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  data-testid="input-email"
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: password ? 10 : 16 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    className="vs-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
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

              {/* Password strength bar */}
              {password.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 3,
                        background: i < pwStrength ? STRENGTH_COLORS[pwStrength - 1] : "#203023",
                        transition: "background 0.3s",
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: pwStrength > 0 ? STRENGTH_COLORS[pwStrength - 1] : "#2b3f2e", marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                    {pwStrength > 0 ? STRENGTH_LABELS[pwStrength - 1] : ""}
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#527856",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>Confirm Password</label>
                <input
                  type="password"
                  className={`vs-input${pwMismatch ? " vs-input-error" : ""}`}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  data-testid="input-confirm-password"
                />
                {pwMismatch && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
                    Passwords do not match
                  </div>
                )}
              </div>

              {/* API Error */}
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
                data-testid="btn-signup"
              >
                {loading ? "Submitting…" : (
                  <>
                    <span>Request Access</span>
                    <span className="vs-arrow" style={{ fontSize: 18, lineHeight: 1 }}>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Link */}
            <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#2b3f2e" }}>
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#2ddb6f", fontWeight: 600, fontSize: 13,
                  fontFamily: "inherit", padding: 0,
                  textDecoration: "underline", textUnderlineOffset: 3,
                }}
                data-testid="link-login"
              >
                Sign In
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
