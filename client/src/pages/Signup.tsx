import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { useFieldTheme, FieldThemeSwitcher } from "@/hooks/use-field-theme";

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

export default function Signup() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { F, theme: fieldTheme } = useFieldTheme();

  const STRENGTH_LABELS = [t.signupStrengthWeak, t.signupStrengthFair, t.signupStrengthStrong, t.signupStrengthVeryStrong];
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const pwStrength = getPasswordStrength(password);
  const pwMismatch = confirmPw.length > 0 && confirmPw !== password;
  const canSubmit  = !loading && !!name && !!email && !!password && !!confirmPw && !pwMismatch;

  const logoTStroke   = fieldTheme === "light" ? "1.8px rgba(15,31,23,0.50)" : "1.8px rgba(255,255,255,0.85)";
  const logoKFilter   = fieldTheme === "light"
    ? "drop-shadow(0 2px 8px rgba(22,163,74,0.22))"
    : "drop-shadow(0 0 14px rgba(45,219,111,0.70)) drop-shadow(0 0 4px rgba(45,219,111,0.50))";
  const gridLineColor = fieldTheme === "light" ? "rgba(22,163,74,0.022)" : "rgba(45,219,111,0.03)";
  const cardShadow    = fieldTheme === "light" ? "0 8px 32px rgba(15,23,42,0.09)" : "0 28px 60px rgba(0,0,0,0.60)";

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
  background: ${F.surface};
  border: 1px solid ${F.borderStrong};
  border-radius: 10px;
  padding: 11px 14px;
  color: ${F.text};
  font-size: 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.vs-input::placeholder { color: ${F.textDim}; }
.vs-input:focus {
  border-color: ${F.accent};
  box-shadow: 0 0 0 3px ${F.accentBg};
}
.vs-input-error {
  border-color: rgba(239,68,68,0.5) !important;
}
.vs-btn {
  width: 100%;
  height: 48px;
  background: ${F.accent};
  border: none;
  border-radius: 10px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: ${F.accentText};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 0 24px ${F.accentBg};
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
}
.vs-btn:hover:not(:disabled) {
  box-shadow: 0 0 36px ${F.accentBorder};
  transform: translateY(-1px);
}
.vs-btn:disabled {
  background: ${F.accentBg};
  color: ${F.textDim};
  cursor: not-allowed;
  box-shadow: none;
}
`;

  const BG_STYLE: React.CSSProperties = {
    minHeight: "100vh",
    background: F.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Barlow', sans-serif",
    padding: "40px 0",
    transition: "background 0.2s",
  };

  const GRID_STYLE: React.CSSProperties = {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(${gridLineColor} 1px, transparent 1px),
      linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)
    `,
    backgroundSize: "56px 56px",
    zIndex: 0,
  };

  const DIAGONAL_STYLE: React.CSSProperties = {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(-45deg, ${F.accent} 0px, ${F.accent} 1px, transparent 1px, transparent 32px)`,
    opacity: fieldTheme === "light" ? 0.006 : 0.018,
    zIndex: 0,
  };

  const GLOW_STYLE: React.CSSProperties = {
    position: "absolute",
    top: "-80px", left: "50%",
    transform: "translateX(-50%)",
    width: 900, height: 700,
    background: fieldTheme === "light"
      ? `radial-gradient(ellipse, rgba(22,163,74,0.05) 0%, transparent 60%)`
      : `radial-gradient(ellipse, rgba(45,219,111,0.07) 0%, transparent 60%)`,
    pointerEvents: "none",
    zIndex: 0,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPw) { setError(t.signupPasswordsMismatch); return; }
    if (password.length < 6)    { setError(t.signupPasswordTooShort); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", { name, email, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? t.signupFailed);
    } finally {
      setLoading(false);
    }
  }

  const Switchers = (
    <div style={{ position: "absolute", top: 18, right: 20, zIndex: 20, display: "flex", alignItems: "center", gap: 6 }}>
      <FieldThemeSwitcher compact={true} />
      <LanguageSwitcher theme={fieldTheme} compact={true} />
    </div>
  );

  if (success) {
    return (
      <div style={BG_STYLE}>
        <style>{CSS}</style>
        <div style={GLOW_STYLE} />
        <div style={GRID_STYLE} />
        <div style={DIAGONAL_STYLE} />
        {Switchers}
        <div className="vs-card" style={{
          width: "100%", maxWidth: 380, margin: "0 24px",
          background: F.surface, border: `1px solid ${F.borderStrong}`,
          borderRadius: 20, boxShadow: cardShadow,
          overflow: "hidden", position: "relative", zIndex: 1,
        }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${F.accent}, transparent)` }} />
          <div style={{ padding: 36, textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: F.accentBg, border: `1px solid ${F.accentBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle2 style={{ width: 28, height: 28, color: F.accent }} />
            </div>
            <h2 style={{ color: F.text, fontSize: 20, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              {t.signupRequestSubmitted}
            </h2>
            <p style={{ color: F.textDim, fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
              {t.signupApprovalPending}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="vs-btn"
              data-testid="btn-back-login"
            >
              {t.signupBackToSignIn}
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: F.textDim, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, position: "relative", zIndex: 1 }}>
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

      {Switchers}

      <div style={{ width: "100%", maxWidth: 380, padding: "0 24px", position: "relative", zIndex: 1 }}>

        {/* ── Logo Block ── */}
        <div className="vs-logo" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 88, lineHeight: 1, letterSpacing: 2, display: "flex", justifyContent: "center", gap: 2 }}>
            <span style={{ color: "transparent", WebkitTextStroke: logoTStroke }}>T</span>
            <span className="vs-k" style={{
              color: "transparent",
              WebkitTextStroke: `1.8px ${F.accent}`,
              filter: logoKFilter,
            }}>K</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 1, background: F.accentBorder }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, letterSpacing: 6, color: F.textMuted,
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}>ELECTRIC LLC</span>
            <div style={{ flex: 1, height: 1, background: F.accentBorder }} />
          </div>
          <div style={{ fontSize: 10, color: F.textDim, marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
            www.tkglobal.us
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: F.accentBg, border: `1px solid ${F.accentBorder}`,
            borderRadius: 20, padding: "5px 14px",
          }}>
            <span className="vs-pulse-dot" style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: F.accent, boxShadow: `0 0 6px ${F.accent}`, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, letterSpacing: 2, color: F.textMuted, textTransform: "uppercase",
            }}>{t.materialInventorySystem}</span>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="vs-card" style={{
          background: F.surface, border: `1px solid ${F.borderStrong}`,
          borderRadius: 20, boxShadow: cardShadow, overflow: "hidden",
          transition: "background 0.2s, border-color 0.2s",
        }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${F.accent}, transparent)` }} />

          <div style={{ padding: 28 }}>

            {/* Amber notice */}
            <div style={{
              background: F.warningBg, border: `1px solid ${F.warningBorder}`,
              borderRadius: 10, padding: "11px 14px", marginBottom: 20,
              fontSize: 12, color: F.warning, lineHeight: 1.55,
            }}>
              {t.signupAdminApprovalNotice}
            </div>

            <form onSubmit={handleSubmit}>

              {/* Full Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: F.textMuted,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.signupFullName}</label>
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
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: F.textMuted,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.email}</label>
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
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: F.textMuted,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.password}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    className="vs-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t.signupPasswordPlaceholder}
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
                      background: "none", border: "none", cursor: "pointer", color: F.textMuted, padding: 0,
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
                        background: i < pwStrength ? STRENGTH_COLORS[pwStrength - 1] : F.border,
                        transition: "background 0.3s",
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: pwStrength > 0 ? STRENGTH_COLORS[pwStrength - 1] : F.textDim, marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                    {pwStrength > 0 ? STRENGTH_LABELS[pwStrength - 1] : ""}
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", marginBottom: 6,
                  fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: F.textMuted,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                }}>{t.signupConfirmPassword}</label>
                <input
                  type="password"
                  className={`vs-input${pwMismatch ? " vs-input-error" : ""}`}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder={t.signupConfirmPasswordPlaceholder}
                  required
                  data-testid="input-confirm-password"
                />
                {pwMismatch && (
                  <div style={{ fontSize: 11, color: F.danger, marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
                    {t.signupPasswordsMismatch}
                  </div>
                )}
              </div>

              {/* API Error */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: F.dangerBg, border: `1px solid ${F.dangerBorder}`,
                  borderRadius: 10, padding: "10px 13px", marginBottom: 16,
                  color: F.danger, fontSize: 13,
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
                {loading ? t.signupSubmitting : (
                  <>
                    <span>{t.requestAccess}</span>
                    <span className="vs-arrow" style={{ fontSize: 18, lineHeight: 1 }}>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Link */}
            <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: F.textDim }}>
              {t.signupAlreadyHaveAccount}{" "}
              <button
                onClick={() => navigate("/login")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: F.accent, fontWeight: 600, fontSize: 13,
                  fontFamily: "inherit", padding: 0,
                  textDecoration: "underline", textUnderlineOffset: 3,
                }}
                data-testid="link-login"
              >
                {t.signIn}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: F.textDim, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
          Created by Kyutae Kim (Michael) · TK Electric LLC
        </p>
      </div>
    </div>
  );
}
