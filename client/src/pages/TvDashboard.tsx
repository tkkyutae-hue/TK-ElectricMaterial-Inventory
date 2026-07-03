import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

const ONGOING_STATUSES = new Set(["active", "working on it", "in progress", "start soon", "stuck"]);

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "active":        { bg: "rgba(93,155,59,0.18)",  text: "#86efac", dot: "#5D9B3B" },
  "working on it": { bg: "rgba(96,165,250,0.18)", text: "#93c5fd", dot: "#60a5fa" },
  "in progress":   { bg: "rgba(96,165,250,0.18)", text: "#93c5fd", dot: "#60a5fa" },
  "start soon":    { bg: "rgba(251,191,36,0.18)", text: "#fde68a", dot: "#fbbf24" },
  "stuck":         { bg: "rgba(239,68,68,0.18)",  text: "#fca5a5", dot: "#ef4444" },
};

function getStatusStyle(status: string) {
  return (
    STATUS_COLORS[status.toLowerCase()] ??
    { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", dot: "#64748b" }
  );
}

function timeProgress(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  if (end <= start) return null;
  const pct = Math.round(((Date.now() - start) / (end - start)) * 100);
  return Math.min(100, Math.max(0, pct));
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TvDashboard() {
  const [, navigate] = useLocation();
  const [hintVisible, setHintVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useClock();

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 30_000,
  });

  const active = (projects as any[]).filter(
    p => ONGOING_STATUSES.has((p.status ?? "").toLowerCase())
  );

  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") navigate("/home"); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    const handleMove = () => {
      setCursorHidden(false);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursorHidden(true), 4000);
    };
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    };
  }, []);

  useEffect(() => {
    hintTimer.current = setTimeout(() => setHintVisible(false), 6000);
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current); };
  }, []);

  const cols = active.length <= 2 ? 2 : active.length <= 4 ? 2 : 3;
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div
      data-testid="tv-dashboard"
      onClick={() => navigate("/home")}
      style={{
        minHeight: "100vh",
        height: "100vh",
        background: "linear-gradient(160deg, #07101f 0%, #0b1728 60%, #091522 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow', sans-serif",
        cursor: cursorHidden ? "none" : "default",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(93,155,59,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(93,155,59,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        zIndex: 0,
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "22px 48px 18px",
        borderBottom: "1px solid rgba(93,155,59,0.15)",
        flexShrink: 0,
        background: "rgba(7,16,31,0.6)",
        backdropFilter: "blur(4px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Pulsing live dot */}
          <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
            <span style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "#5D9B3B",
              animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
              opacity: 0.6,
            }} />
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#5D9B3B",
              display: "inline-block",
              boxShadow: "0 0 8px #5D9B3B",
            }} />
          </span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 24, fontWeight: 700,
            color: "#e2e8f0", letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>
            TK Electric
          </span>
          <span style={{ color: "rgba(93,155,59,0.5)", fontSize: 20, fontWeight: 300 }}>|</span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16, fontWeight: 500,
            color: "#64748b", letterSpacing: 2,
            textTransform: "uppercase",
          }}>
            Active Projects
          </span>
          <span style={{
            background: "rgba(93,155,59,0.15)",
            border: "1px solid rgba(93,155,59,0.3)",
            color: "#86efac",
            fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase",
            padding: "3px 12px", borderRadius: 20,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {active.length}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 38, fontWeight: 700, lineHeight: 1,
            color: "#f1f5f9", letterSpacing: 1,
          }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, letterSpacing: 0.5 }}>
            {dateStr}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", zIndex: 10,
          flex: 1, padding: "36px 48px 24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {active.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>🏗️</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 26, fontWeight: 600, letterSpacing: 0.5,
              color: "#334155",
            }}>
              No active projects at this time
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 24,
            alignContent: "start",
          }}>
            {active.map((project: any) => {
              const st = getStatusStyle(project.status ?? "");
              const progress = timeProgress(project.startDate, project.endDate);
              const barColor =
                progress !== null && progress > 90 ? "#ef4444" :
                progress !== null && progress > 70 ? "#fbbf24" : "#5D9B3B";

              return (
                <div
                  key={project.id}
                  data-testid={`tv-project-card-${project.id}`}
                  style={{
                    background: "rgba(15,23,42,0.75)",
                    border: "1px solid rgba(93,155,59,0.14)",
                    borderRadius: 18,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {/* Top accent strip */}
                  <div style={{ height: 3, background: st.dot, flexShrink: 0 }} />

                  <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                    {/* Status row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: st.bg, color: st.text,
                        border: `1px solid ${st.dot}44`,
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: 1.2, textTransform: "uppercase",
                        padding: "4px 12px", borderRadius: 20,
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: st.dot, flexShrink: 0,
                          boxShadow: `0 0 6px ${st.dot}`,
                        }} />
                        {project.status}
                      </span>
                      {project.poNumber && (
                        <span style={{
                          fontSize: 11, color: "#475569",
                          fontFamily: "'Barlow Condensed', sans-serif",
                          letterSpacing: 0.5,
                        }}>
                          PO: {project.poNumber}
                        </span>
                      )}
                    </div>

                    {/* Project name */}
                    <div>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 30, fontWeight: 700,
                        color: "#f1f5f9", lineHeight: 1.15,
                        letterSpacing: 0.2,
                      }}>
                        {project.name}
                      </div>
                      {(project.jobLocation || project.city) && (
                        <div style={{
                          fontSize: 13, color: "#64748b", marginTop: 6,
                          display: "flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{ fontSize: 12 }}>📍</span>
                          {project.jobLocation ?? project.city}
                        </div>
                      )}
                    </div>

                    {/* Duration */}
                    {(project.startDate || project.endDate) && (
                      <div style={{
                        fontSize: 12, color: "#475569",
                        fontFamily: "'Barlow Condensed', sans-serif",
                        letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ fontSize: 11 }}>📅</span>
                        {project.startDate}
                        {project.startDate && project.endDate && (
                          <span style={{ color: "#334155" }}>→</span>
                        )}
                        {project.endDate}
                      </div>
                    )}

                    {/* Timeline progress bar */}
                    {progress !== null && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between", marginBottom: 6,
                          fontSize: 10, color: "#475569",
                          fontFamily: "'Barlow Condensed', sans-serif",
                          letterSpacing: 0.8, textTransform: "uppercase",
                        }}>
                          <span>Timeline Progress</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{progress}%</span>
                        </div>
                        <div style={{
                          height: 6, borderRadius: 3,
                          background: "rgba(148,163,184,0.08)",
                          overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%",
                            width: `${progress}%`,
                            borderRadius: 3,
                            background: barColor,
                            boxShadow: `0 0 8px ${barColor}88`,
                            transition: "width 0.6s ease",
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exit hint */}
      <div style={{
        position: "relative", zIndex: 10,
        textAlign: "center",
        padding: "10px",
        flexShrink: 0,
        opacity: hintVisible ? 0.25 : 0,
        transition: "opacity 1.5s ease",
        fontSize: 11, color: "#94a3b8",
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: 1.5,
        pointerEvents: "none",
      }}>
        PRESS ESC OR CLICK ANYWHERE TO EXIT DISPLAY MODE · AUTO-REFRESHES EVERY 30s
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
