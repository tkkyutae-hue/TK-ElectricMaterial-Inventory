import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useFieldTheme } from "@/hooks/use-field-theme";
import { useAuth } from "@/hooks/use-auth";
import type { FieldToken } from "@/lib/fieldTokens";

const CSS = `
@keyframes fh-fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fh-list { animation: fh-fadeUp 0.35s ease 0.05s both; }
`;

type CardDef = {
  testId: string;
  emoji: string;
  emojiBg: string;
  accentColor: string;
  title: string;
  tags: string[];
  tagStyle: React.CSSProperties;
  route: string;
};

function ActionCard({ testId, emoji, emojiBg, accentColor, title, tags, tagStyle, route, onClick, F, theme }: CardDef & { onClick: () => void; F: FieldToken; theme: "dark" | "light" }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const hoverShadow = theme === "light" ? "0 8px 28px rgba(15,23,42,0.10)" : "0 8px 28px rgba(0,0,0,0.45)";
  const restShadow  = theme === "light" ? "0 2px 10px rgba(15,23,42,0.06)" : "none";

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: "100%",
        textAlign: "left",
        background: F.surface2,
        border: `1px solid ${hovered ? accentColor + "55" : F.borderStrong}`,
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-2px)" : pressed ? "scale(0.99)" : "none",
        boxShadow: hovered ? hoverShadow : restShadow,
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 2, background: accentColor, width: "100%" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 22px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12, flexShrink: 0,
          background: emojiBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
        }}>
          {emoji}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 19, fontWeight: 700,
            color: F.text, margin: "0 0 8px",
            letterSpacing: 0.3,
          }}>{title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {tags.map(tag => (
              <span key={tag} style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2,
                padding: "2px 7px", borderRadius: 4,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                ...tagStyle,
              }}>{tag}</span>
            ))}
          </div>
        </div>

        <span style={{
          fontSize: 20, flexShrink: 0,
          color: hovered ? accentColor : F.textDim,
          transition: "color 0.15s, transform 0.15s",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
          display: "inline-block",
          lineHeight: 1,
        }}>→</span>
      </div>
    </button>
  );
}

export default function FieldHome() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { F, theme: fieldTheme } = useFieldTheme();
  const { canDoMovements } = useAuth();

  const ALL_CARDS: (CardDef & { requiresMovements?: boolean })[] = [
    {
      testId: "tile-receive",
      emoji: "📦",
      emojiBg: F.accentBg,
      accentColor: F.accent,
      title: t.receiveReturn,
      tags: [t.tagReceiveUpper, t.tagReturnUpper],
      tagStyle: {
        background: F.accentBg,
        border: `1px solid ${F.accentBorder}`,
        color: F.accent,
      },
      route: "/field/movement?type=receive",
      requiresMovements: true,
    },
    {
      testId: "tile-issue",
      emoji: "🚚",
      emojiBg: F.warningBg,
      accentColor: F.warning,
      title: t.issueTransfer,
      tags: [t.tagIssueUpper, t.tagTransferUpper],
      tagStyle: {
        background: F.warningBg,
        border: `1px solid ${F.warningBorder}`,
        color: F.warning,
      },
      route: "/field/movement?type=issue",
      requiresMovements: true,
    },
    {
      testId: "tile-inventory",
      emoji: "🔍",
      emojiBg: F.infoBg,
      accentColor: F.info,
      title: t.inventoryCard,
      tags: [t.tagBrowse, t.tagSearch],
      tagStyle: {
        background: F.infoBg,
        border: `1px solid ${F.infoBorder}`,
        color: F.info,
      },
      route: "/field/inventory",
    },
    {
      testId: "tile-transactions",
      emoji: "📋",
      emojiBg: F.accentBg,
      accentColor: F.textMuted,
      title: t.transactionsCard,
      tags: [t.tagHistory, t.tagFilter],
      tagStyle: {
        background: F.accentBg,
        border: `1px solid ${F.accentBorder}`,
        color: F.textMuted,
      },
      route: "/field/transactions",
    },
    {
      testId: "tile-drafts",
      emoji: "📝",
      emojiBg: F.warningBg,
      accentColor: F.warning,
      title: t.draftMovements,
      tags: [t.tagSaved, t.tagPending],
      tagStyle: {
        background: F.warningBg,
        border: `1px solid ${F.warningBorder}`,
        color: F.warning,
      },
      route: "/field/transactions?tab=drafts",
      requiresMovements: true,
    },
  ];

  const CARDS = ALL_CARDS.filter(c => !c.requiresMovements || canDoMovements);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "40px 20px 48px" }}>
      <style>{CSS}</style>

      <div style={{ width: "100%", maxWidth: 680 }}>

        {/* Heading */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
            color: F.warning, fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600, margin: "0 0 6px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>⚡</span> {t.fieldActions}
          </p>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "clamp(32px, 7vw, 48px)",
            lineHeight: 1.05, margin: "0 0 8px",
            color: F.text, letterSpacing: 1,
          }}>
            {t.whatToDo.split("\n").map((line, i) => (
              <span key={i} style={{
                display: "block",
                wordBreak: "keep-all",
                overflowWrap: "normal",
                lineBreak: "strict",
              }}>{line}</span>
            ))}
          </h1>
          <p style={{ fontSize: 13, color: F.textDim, margin: 0, fontFamily: "'Barlow', sans-serif" }}>
            {t.selectAction}
          </p>
        </div>

        {/* Single-column list */}
        <div className="fh-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CARDS.map(card => (
            <ActionCard
              key={card.testId}
              {...card}
              F={F}
              theme={fieldTheme}
              onClick={() => navigate(card.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
