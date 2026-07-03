import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { MapPin, Calendar, HardHat } from "lucide-react";

const ONGOING_STATUSES = new Set(["active", "working on it", "in progress", "start soon", "stuck"]);

const STATUS_COLOR_MAP: Array<{ keys: string[]; bg: string; text?: string }> = [
  { keys: ["active"],                       bg: "#00C875" },
  { keys: ["working on it", "in progress"], bg: "#FDAB3D", text: "#1a1a1a" },
  { keys: ["stuck"],                        bg: "#E2445C" },
  { keys: ["start soon"],                   bg: "#00C4F4", text: "#1a1a1a" },
  { keys: ["on_hold", "on hold"],           bg: "#FDBC64", text: "#1a1a1a" },
];

function statusBg(status: string) {
  const lower = (status || "").toLowerCase();
  return STATUS_COLOR_MAP.find(e => e.keys.includes(lower))?.bg ?? "#C4C4C4";
}
function statusText(status: string) {
  const lower = (status || "").toLowerCase();
  return STATUS_COLOR_MAP.find(e => e.keys.includes(lower))?.text ?? "#ffffff";
}

function timeProgress(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (e <= s) return null;
  return Math.min(100, Math.max(0, Math.round(((Date.now() - s) / (e - s)) * 100)));
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
  const now = useClock();
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: allProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 30_000,
  });

  const { data: manpowerToday = [] } = useQuery<{ projectId: number; workerCount: number }[]>({
    queryKey: ["/api/tv/today-manpower"],
    refetchInterval: 30_000,
  });

  const manpowerMap = Object.fromEntries(
    (manpowerToday as any[]).map((m: any) => [m.projectId, m.workerCount])
  );

  const projects = (allProjects as any[]).filter(
    p => ONGOING_STATUSES.has((p.status ?? "").toLowerCase())
  );

  // 30s invalidation for both queries
  useEffect(() => {
    refreshRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tv/today-manpower"] });
    }, 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  // ESC to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") navigate("/home"); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const cols = projects.length <= 2 ? 2 : projects.length <= 4 ? 2 : projects.length <= 6 ? 3 : 4;

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
        background: "#F5F6F8",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow', sans-serif",
        overflow: "hidden",
        userSelect: "none",
        cursor: "default",
      }}
    >
      {/* Header — stop click propagation so header clicks don't exit */}
      <header
        onClick={e => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 40px 16px",
          background: "#ffffff",
          borderBottom: "3px solid #5D9B3B",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#5D9B3B",
            boxShadow: "0 0 0 3px rgba(93,155,59,0.2)",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 26, fontWeight: 800,
            color: "#1e293b", letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            TK Electric LLC
          </span>
          <span style={{ width: 1, height: 24, background: "#e2e8f0", flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16, fontWeight: 600,
            color: "#64748b", letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>
            Active Projects
          </span>
          <span style={{
            background: "#5D9B3B", color: "#fff",
            fontSize: 13, fontWeight: 700,
            padding: "3px 12px", borderRadius: 20,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {projects.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 36, fontWeight: 700, lineHeight: 1,
              color: "#1e293b", letterSpacing: 1,
            }}>
              {timeStr}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
              {dateStr}
            </div>
          </div>
          <button
            data-testid="tv-exit-btn"
            onClick={() => navigate("/home")}
            style={{
              background: "none", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "6px 14px",
              fontSize: 12, color: "#94a3b8", cursor: "pointer",
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            ← Exit
          </button>
        </div>
      </header>

      {/* Content — stop propagation so card clicks don't exit */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}
      >
        {projects.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", flexDirection: "column", gap: 12, color: "#94a3b8",
          }}>
            <div style={{ fontSize: 48 }}>🏗️</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 22, fontWeight: 600,
            }}>
              No active projects at this time
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 20,
          }}>
            {projects.map((p: any) => {
              const bg  = statusBg(p.status);
              const fg  = statusText(p.status);
              const pct = timeProgress(p.startDate, p.endDate);
              const barColor = pct !== null && pct > 90 ? "#E2445C" : pct !== null && pct > 70 ? "#FDAB3D" : "#5D9B3B";
              const workers  = manpowerMap[p.id];

              return (
                <div
                  key={p.id}
                  data-testid={`tv-project-card-${p.id}`}
                  style={{
                    background: "#ffffff",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    border: "1px solid #e8ecf0",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ height: 5, background: bg, flexShrink: 0 }} />

                  <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                    {/* Status + PO */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{
                        background: bg, color: fg,
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: 1, textTransform: "uppercase",
                        padding: "4px 12px", borderRadius: 20,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        whiteSpace: "nowrap",
                      }}>
                        {p.status}
                      </span>
                      {p.poNumber && (
                        <span style={{
                          fontSize: 12, color: "#94a3b8",
                          fontFamily: "'Barlow Condensed', sans-serif",
                        }}>
                          PO: {p.poNumber}
                        </span>
                      )}
                    </div>

                    {/* Project name */}
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 28, fontWeight: 700,
                      color: "#1e293b", lineHeight: 1.15,
                    }}>
                      {p.name}
                    </div>

                    {/* Customer */}
                    {p.customerName && (
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        {p.customerName}
                      </div>
                    )}

                    {/* Location */}
                    {(p.jobLocation || p.city) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748b" }}>
                        <MapPin style={{ width: 13, height: 13, flexShrink: 0, color: "#94a3b8" }} />
                        {p.jobLocation ?? p.city}
                      </div>
                    )}

                    {/* Timeline */}
                    {(p.startDate || p.endDate) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        <Calendar style={{ width: 12, height: 12, flexShrink: 0 }} />
                        {p.startDate}{p.startDate && p.endDate ? " → " : ""}{p.endDate}
                      </div>
                    )}

                    {/* Today's workers */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: workers ? "#1e293b" : "#94a3b8", fontWeight: workers ? 600 : 400 }}>
                      <HardHat style={{ width: 14, height: 14, flexShrink: 0, color: workers ? "#5D9B3B" : "#cbd5e1" }} />
                      {workers !== undefined ? `${workers} workers today` : "— no report today"}
                    </div>

                    {/* Progress bar */}
                    {pct !== null && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          fontSize: 10, color: "#94a3b8", marginBottom: 5,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          letterSpacing: 0.8, textTransform: "uppercase",
                        }}>
                          <span>Timeline</span>
                          <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`,
                            borderRadius: 3, background: barColor,
                            transition: "width 0.5s ease",
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

      {/* Footer */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          textAlign: "center", padding: "10px", flexShrink: 0,
          fontSize: 11, color: "#cbd5e1",
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
          background: "#ffffff", borderTop: "1px solid #f1f5f9",
        }}
      >
        AUTO-REFRESHES EVERY 30s · PRESS ESC OR CLICK ANYWHERE TO EXIT
      </div>
    </div>
  );
}
