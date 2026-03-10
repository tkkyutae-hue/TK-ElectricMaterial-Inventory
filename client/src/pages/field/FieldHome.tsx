import { useState } from "react";
import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList } from "lucide-react";

const CSS = `
@keyframes fh-fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fh-grid { animation: fh-fadeUp 0.4s ease 0.05s both; }
`;

type CardDef = {
  num: string;
  testId: string;
  label: string;
  desc: string;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  hoverBar: string;
  route: string;
};

const CARDS: CardDef[] = [
  {
    num: "01",
    testId: "tile-receive",
    label: "Receive / Return",
    desc: "Log incoming stock or return material",
    Icon: PackageCheck,
    iconColor: "#2ddb6f",
    iconBg: "rgba(45,219,111,0.08)",
    hoverBar: "#2ddb6f",
    route: "/field/movement?type=receive",
  },
  {
    num: "02",
    testId: "tile-issue",
    label: "Issue / Transfer",
    desc: "Send material out to a jobsite",
    Icon: PackageMinus,
    iconColor: "#f5a623",
    iconBg: "rgba(245,166,35,0.08)",
    hoverBar: "#f5a623",
    route: "/field/movement?type=issue",
  },
  {
    num: "03",
    testId: "tile-inventory",
    label: "Inventory",
    desc: "Browse and search current stock",
    Icon: ScanSearch,
    iconColor: "#5b9cf6",
    iconBg: "rgba(91,156,246,0.10)",
    hoverBar: "#5b9cf6",
    route: "/field/inventory",
  },
  {
    num: "04",
    testId: "tile-transactions",
    label: "Transactions",
    desc: "View movement history",
    Icon: ClipboardList,
    iconColor: "#527856",
    iconBg: "rgba(255,255,255,0.04)",
    hoverBar: "#527856",
    route: "/field/transactions",
  },
];

function ActionCard({ num, testId, label, desc, Icon, iconColor, iconBg, hoverBar, onClick }: CardDef & { onClick: () => void }) {
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
        textAlign: "left",
        background: "#0f1612",
        border: `1px solid ${hovered ? hoverBar + "44" : "#203023"}`,
        borderRadius: 14,
        padding: 22,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transform: pressed ? "scale(0.98)" : hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.5)` : "none",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Bottom hover accent bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 2,
        background: hoverBar,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.2s",
      }} />

      {/* Number top-left */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
        color: hovered ? hoverBar : "#2b3f2e",
        marginBottom: 14, textTransform: "uppercase",
        transition: "color 0.15s",
      }}>{num}</div>

      {/* Icon + arrow row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        {/* Icon box */}
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon style={{ width: 22, height: 22, color: iconColor }} strokeWidth={1.6} />
        </div>

        {/* Arrow top-right */}
        <span style={{
          fontSize: 16, lineHeight: 1,
          color: hovered ? hoverBar : "#2b3f2e",
          transition: "color 0.15s, transform 0.15s",
          transform: hovered ? "translateX(2px) translateY(-1px)" : "none",
          display: "inline-block",
        }}>→</span>
      </div>

      {/* Title */}
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 17, fontWeight: 700, letterSpacing: 0.3,
        color: "#ffffff", margin: "0 0 5px",
      }}>{label}</p>

      {/* Description */}
      <p style={{
        fontSize: 11, color: "#2b3f2e",
        fontFamily: "'Barlow', sans-serif",
        margin: 0, lineHeight: 1.5,
      }}>{desc}</p>
    </button>
  );
}

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px 48px" }}>
      <style>{CSS}</style>

      <div style={{ width: "100%", maxWidth: 680 }}>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 26, fontWeight: 700, color: "#ffffff",
            margin: "0 0 5px", letterSpacing: 0.3,
          }}>
            Field Actions
          </h1>
          <p style={{ fontSize: 12, color: "#2b3f2e", margin: 0, fontFamily: "'Barlow', sans-serif" }}>
            What do you need to do?
          </p>
        </div>

        {/* 2×2 grid */}
        <div
          className="fh-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
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
