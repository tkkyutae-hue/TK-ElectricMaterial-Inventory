import { useState } from "react";
import { useLocation } from "wouter";

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

const CARDS: CardDef[] = [
  {
    testId: "tile-receive",
    emoji: "📦",
    emojiBg: "rgba(45,219,111,0.10)",
    accentColor: "#2ddb6f",
    title: "Receive / Return",
    tags: ["RECEIVE", "RETURN"],
    tagStyle: {
      background: "rgba(45,219,111,0.08)",
      border: "1px solid rgba(45,219,111,0.18)",
      color: "#2ddb6f",
    },
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    emoji: "🚚",
    emojiBg: "rgba(245,166,35,0.10)",
    accentColor: "#f5a623",
    title: "Issue / Transfer",
    tags: ["ISSUE", "TRANSFER"],
    tagStyle: {
      background: "rgba(245,166,35,0.08)",
      border: "1px solid rgba(245,166,35,0.18)",
      color: "#f5a623",
    },
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    emoji: "🔍",
    emojiBg: "rgba(91,156,246,0.10)",
    accentColor: "#5b9cf6",
    title: "Inventory",
    tags: ["BROWSE", "SEARCH"],
    tagStyle: {
      background: "rgba(91,156,246,0.08)",
      border: "1px solid rgba(91,156,246,0.18)",
      color: "#5b9cf6",
    },
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    emoji: "📋",
    emojiBg: "rgba(82,120,86,0.15)",
    accentColor: "#527856",
    title: "Transactions",
    tags: ["HISTORY", "FILTER"],
    tagStyle: {
      background: "rgba(82,120,86,0.10)",
      border: "1px solid rgba(82,120,86,0.20)",
      color: "#527856",
    },
    route: "/field/transactions",
  },
];

function ActionCard({ testId, emoji, emojiBg, accentColor, title, tags, tagStyle, route, onClick }: CardDef & { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

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
        background: "#0f1612",
        border: `1px solid ${hovered ? accentColor + "55" : "#203023"}`,
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-2px)" : pressed ? "scale(0.99)" : "none",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.45)` : "none",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      {/* Top accent line */}
      <div style={{ height: 2, background: accentColor, width: "100%" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 22px" }}>
        {/* Emoji icon box */}
        <div style={{
          width: 56, height: 56, borderRadius: 12, flexShrink: 0,
          background: emojiBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
        }}>
          {emoji}
        </div>

        {/* Title + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 19, fontWeight: 700,
            color: "#ffffff", margin: "0 0 8px",
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

        {/* Arrow */}
        <span style={{
          fontSize: 20, flexShrink: 0,
          color: hovered ? accentColor : "#2b3f2e",
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "40px 20px 48px" }}>
      <style>{CSS}</style>

      <div style={{ width: "100%", maxWidth: 680 }}>

        {/* Heading */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
            color: "#f5a623", fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600, margin: "0 0 6px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>⚡</span> Field Actions
          </p>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 48, lineHeight: 1.05, margin: "0 0 8px",
            color: "#ffffff", letterSpacing: 1,
          }}>
            What do you need<br />to do?
          </h1>
          <p style={{ fontSize: 13, color: "#2b3f2e", margin: 0, fontFamily: "'Barlow', sans-serif" }}>
            Select an action to continue.
          </p>
        </div>

        {/* Single-column list */}
        <div className="fh-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CARDS.map(card => (
            <ActionCard
              key={card.testId}
              {...card}
              onClick={() => navigate(card.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
