import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { LanguageSwitcher, useLanguage } from "@/hooks/use-language";
import { Translations } from "@/lib/i18n";

const TV_STATUSES = new Set(["working on it", "start soon"]);

const STATUS_STYLE_BASE: Record<string, { bg: string; text: string }> = {
  "working on it": { bg: "#FDAB3D", text: "#1a1a1a" },
  "start soon":    { bg: "#00C4F4", text: "#1a1a1a" },
};

function getStatusLabel(key: string, t: Translations): string {
  if (key === "working on it") return t.tvStatusWorkingOnIt;
  if (key === "start soon")    return t.tvStatusStartSoon;
  return key;
}

const GROUP_PALETTE = [
  "#0073EA","#00C875","#A25DDC","#FDBC64","#FF7575",
  "#579BFC","#9CD326","#FF9F43","#FF3D57","#7E5CB5",
];
function groupColor(name: string): string {
  if (!name) return "#C4C4C4";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length];
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Column widths ──────────────────────────────────────────────────────────
const COL = {
  po:      148,
  contact: 140,
  location: 160,
  status:  150,
};

// ─── Column header row ──────────────────────────────────────────────────────
function ColHeader({ color, t }: { color: string; t: Translations }) {
  const cell: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: 2,
    textTransform: "uppercase",
    flexShrink: 0,
  };
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "8px 28px",
      background: "#F0F2F5",
      borderLeft: `5px solid ${color}44`,
      borderBottom: "1px solid #e8ecf0",
      gap: 24,
    }}>
      <div style={{ ...cell, width: COL.po }}>{t.tvColPo}</div>
      <div style={{ width: 1, height: 14, background: "#e2e8f0", flexShrink: 0 }} />
      <div style={{ ...cell, flex: 1 }}>{t.tvColProject}</div>
      <div style={{ ...cell, width: COL.contact }}>{t.tvColContact}</div>
      <div style={{ ...cell, width: COL.location }}>{t.tvColLocation}</div>
      <div style={{ ...cell, width: COL.status, textAlign: "center" }}>{t.tvColStatus}</div>
    </div>
  );
}

const PAUSE_AT_BOTTOM_MS = 2500;
const LS_SPEED_KEY = "voltstock_tv_speed";
const DEFAULT_SPEED = 30;

export default function TvDashboard() {
  const [, navigate] = useLocation();
  const now = useClock();
  const { t } = useLanguage();
  const refreshRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const rafRef        = useRef<number | null>(null);

  const [scrollSpeed, setScrollSpeed] = useState<number>(() => {
    const stored = localStorage.getItem(LS_SPEED_KEY);
    const n = stored ? parseInt(stored, 10) : DEFAULT_SPEED;
    return isNaN(n) ? DEFAULT_SPEED : Math.min(50, Math.max(0, n));
  });
  const scrollSpeedRef = useRef(scrollSpeed);
  useEffect(() => { scrollSpeedRef.current = scrollSpeed; }, [scrollSpeed]);

  const { data: allProjects = [] } = useQuery<any[]>({ queryKey: ["/api/projects"] });

  // Single 30s invalidation mechanism
  useEffect(() => {
    refreshRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    }, 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  // ESC to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") navigate("/home"); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Filter to only TV statuses
  const projects = (allProjects as any[]).filter(
    p => TV_STATUSES.has((p.status ?? "").toLowerCase())
  );

  // Auto-scroll: slow downward loop, pause at bottom, reset to top
  useEffect(() => {
    let lastTs: number | null = null;
    let pausing = false;
    let pauseStart = 0;

    function tick(ts: number) {
      const el = scrollRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }

      if (lastTs === null) lastTs = ts;
      const dt = Math.min(ts - lastTs, 100); // cap to avoid jump after tab switch
      lastTs = ts;

      const overflows = el.scrollHeight > el.clientHeight + 2;

      if (overflows) {
        if (pausing) {
          if (ts - pauseStart >= PAUSE_AT_BOTTOM_MS) {
            pausing = false;
            el.scrollTop = 0;
          }
        } else {
          el.scrollTop += (scrollSpeedRef.current * dt) / 1000;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
            pausing = true;
            pauseStart = ts;
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Group by customerName, sort groups alphabetically
  const groupMap = new Map<string, any[]>();
  for (const p of projects) {
    const key = (p.customerName ?? "").trim() || "—";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  }
  const groups = [...groupMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      items: [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    }));

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div
      data-testid="tv-dashboard"
      style={{
        height: "100vh",
        background: "#F5F6F8",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow', 'Inter', sans-serif",
        userSelect: "none",
      }}
    >
      {/* ── Header (click anywhere to exit) ─────────────────────── */}
      <header
        onClick={() => navigate("/home")}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 48px",
          background: "#ffffff",
          borderBottom: "3px solid #5D9B3B",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%", background: "#5D9B3B",
            boxShadow: "0 0 0 4px rgba(93,155,59,0.18)", flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 28, fontWeight: 800, color: "#1e293b",
            letterSpacing: 1.5, textTransform: "uppercase",
          }}>TK Electric LLC <span style={{ color: "#cbd5e1", fontWeight: 400 }}>·</span> {t.tvBranchName}</span>
          <span style={{ width: 1, height: 26, background: "#e2e8f0" }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 30, fontWeight: 800, color: "#5D9B3B",
            letterSpacing: 2, textTransform: "uppercase",
          }}>{t.tvHeaderSubtitle}</span>
          <span style={{
            background: "#5D9B3B", color: "#fff",
            fontSize: 14, fontWeight: 700,
            padding: "3px 14px", borderRadius: 20,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>{projects.length}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 40, fontWeight: 700, lineHeight: 1,
              color: "#1e293b", letterSpacing: 1,
            }}>{timeStr}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>{dateStr}</div>
          </div>
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}
          >
            <LanguageSwitcher theme="light" />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="range"
                min={0} max={50} step={5}
                value={scrollSpeed}
                onChange={e => {
                  const v = Number(e.target.value);
                  setScrollSpeed(v);
                  localStorage.setItem(LS_SPEED_KEY, String(v));
                }}
                style={{ flex: 1, cursor: "pointer", accentColor: scrollSpeed === 0 ? "#F59E0B" : "#5D9B3B", margin: 0 }}
                data-testid="tv-speed-slider"
              />
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: scrollSpeed === 0 ? 14 : 11,
                fontWeight: 700,
                color: scrollSpeed === 0 ? "#F59E0B" : "#94a3b8",
                minWidth: 18, textAlign: "right", lineHeight: 1,
              }} data-testid="tv-speed-indicator">
                {scrollSpeed === 0 ? "⏸" : scrollSpeed}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <div ref={scrollRef} className="tv-scroll-area" style={{ flex: 1, padding: "28px 48px 20px", overflow: "auto" }}>
        {projects.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "60vh", flexDirection: "column", gap: 16, color: "#94a3b8",
          }}>
            <div style={{ fontSize: 56 }}>🏗️</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 28, fontWeight: 600,
            }}>{t.tvNoProjects}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {groups.map(group => {
              const color = groupColor(group.name);
              return (
                <div
                  key={group.name}
                  data-testid={`tv-group-${group.name}`}
                  style={{
                    background: "#ffffff",
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    border: "1px solid #e8ecf0",
                  }}
                >
                  {/* Group header */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    gap: 14, padding: "14px 28px",
                    background: "#F8F9FB",
                    borderBottom: "1px solid #edf0f4",
                    borderLeft: `5px solid ${color}`,
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 26, fontWeight: 800,
                      color: "#1e293b", letterSpacing: 1,
                      textTransform: "uppercase",
                      flex: 1,
                    }}>{group.name}</span>
                    <span style={{
                      fontSize: 15, fontWeight: 700, color: "#64748b",
                      background: "#e2e8f0", borderRadius: 14,
                      padding: "2px 14px",
                    }}>{group.items.length}</span>
                  </div>

                  {/* Column header row */}
                  <ColHeader color={color} t={t} />

                  {/* Project rows */}
                  {group.items.map((p: any, idx: number) => {
                    const sKey = (p.status ?? "").toLowerCase();
                    const base = STATUS_STYLE_BASE[sKey] ?? { bg: "#C4C4C4", text: "#fff" };
                    const label = getStatusLabel(sKey, t) || p.status;
                    const isLast = idx === group.items.length - 1;

                    return (
                      <div
                        key={p.id}
                        data-testid={`tv-project-row-${p.id}`}
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "16px 28px",
                          borderLeft: `5px solid ${color}22`,
                          borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                          gap: 24,
                        }}
                      >
                        {/* PO number */}
                        <div style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 18, color: "#94a3b8",
                          letterSpacing: 0.5,
                          width: COL.po, flexShrink: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.poNumber || "—"}
                        </div>

                        {/* Divider */}
                        <div style={{ width: 1, height: 28, background: "#e8ecf0", flexShrink: 0 }} />

                        {/* Project name */}
                        <div style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 26, fontWeight: 700,
                          color: "#1e293b", lineHeight: 1.2,
                          flex: 1, minWidth: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.name}
                        </div>

                        {/* Contact (ownerName) */}
                        <div style={{
                          fontSize: 16, color: "#64748b",
                          width: COL.contact, flexShrink: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.ownerName || "—"}
                        </div>

                        {/* Location */}
                        <div style={{
                          fontSize: 16, color: "#94a3b8",
                          width: COL.location, flexShrink: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.jobLocation || "—"}
                        </div>

                        {/* Status badge */}
                        <div style={{
                          background: base.bg, color: base.text,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 16, fontWeight: 800,
                          letterSpacing: 1.2, textTransform: "uppercase",
                          padding: "8px 0", borderRadius: 6,
                          width: COL.status, flexShrink: 0,
                          textAlign: "center", whiteSpace: "nowrap",
                        }}>
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div style={{
        textAlign: "center", padding: "10px", flexShrink: 0,
        fontSize: 12, color: "#cbd5e1",
        fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1.2,
        background: "#ffffff", borderTop: "1px solid #f1f5f9",
      }}>
        {t.tvFooter}
      </div>
    </div>
  );
}
