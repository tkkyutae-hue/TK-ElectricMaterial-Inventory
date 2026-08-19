import type { FieldToken } from "@/lib/fieldTokens";

interface FieldBrandLockupProps {
  F: FieldToken;
  compact?: boolean;
}

export function FieldBrandLockup({ F, compact = false }: FieldBrandLockupProps) {
  const stroke = F.text === "#0f1f17"
    ? "1.4px rgba(15,31,23,0.78)"
    : "1.4px rgba(255,255,255,0.88)";

  return (
    <div className="field-brand-lockup flex items-center gap-2.5 min-w-0">
      <div
        aria-hidden="true"
        className="flex items-center justify-center shrink-0 rounded-lg"
        style={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          background: F.accentBg,
          border: `1px solid ${F.accentBorder}`,
          boxShadow: `inset 0 1px 0 ${F.accentBorder}`,
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: compact ? 23 : 26,
            lineHeight: 1,
            letterSpacing: -0.4,
            display: "flex",
          }}
        >
          <span style={{ color: "transparent", WebkitTextStroke: stroke }}>T</span>
          <span
            style={{
              color: "transparent",
              WebkitTextStroke: `1.4px ${F.accent}`,
              filter: `drop-shadow(0 0 5px ${F.accentBorder})`,
            }}
          >
            K
          </span>
        </div>
      </div>

      <div className="min-w-0 leading-none">
        <p
          className="field-brand-title m-0 whitespace-nowrap"
          style={{
            color: F.text,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: compact ? 13 : 14,
            letterSpacing: 1.4,
          }}
        >
          TK ELECTRIC
        </p>
        {!compact && (
          <p
            className="field-brand-subtitle m-0 mt-1 whitespace-nowrap"
            style={{
              color: F.textMuted,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: 1.5,
            }}
          >
            MATERIAL CONTROL
          </p>
        )}
      </div>
    </div>
  );
}