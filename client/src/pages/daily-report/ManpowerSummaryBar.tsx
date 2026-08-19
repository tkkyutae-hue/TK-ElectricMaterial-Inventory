import React from "react";
import type { Translations } from "@/lib/i18n";
import { FT } from "./fieldTicketTheme";

export function ManpowerSummaryBar({
  t,
  isMobile,
  presentCount,
  exceptionsCount,
  totalManhours,
}: {
  t: Translations;
  isMobile: boolean;
  presentCount: number;
  exceptionsCount: number;
  totalManhours: number;
}) {
  return (
    <div data-testid="manpower-summary-bar" style={{
      borderTop: `1px solid ${FT.RULE}`, background: FT.PAPER_MUTED,
      padding: "9px 14px", display: "flex", flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 0,
      width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden",
    }}>
      <div style={{
        flex: 1, minWidth: isMobile ? 0 : undefined, width: isMobile ? "100%" : undefined,
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
        alignItems: isMobile ? "start" : "center",
        gap: isMobile ? 6 : 14, flexWrap: "wrap",
      }}>
        <span data-testid="manpower-summary-label" style={{
          minWidth: 0, fontSize: 13, fontWeight: 800, color: FT.INK,
          textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: FT.FONT,
          overflowWrap: isMobile ? "anywhere" : undefined,
        }}>
          {t.newReportMpSummary}
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 4, minWidth: isMobile ? 0 : undefined,
          paddingRight: isMobile ? 0 : 12,
          borderRight: isMobile ? "none" : `1px solid ${FT.RULE}`,
        }}>
          <span data-testid="manpower-summary-present-label" style={{
            minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
            overflowWrap: isMobile ? "anywhere" : undefined,
          }}>{t.newReportMpPresent}</span>
          <span data-testid="manpower-summary-present-value" style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 13, fontWeight: 800, color: FT.SUCCESS, fontVariantNumeric: "tabular-nums", fontFamily: FT.FONT }}>{presentCount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: isMobile ? 0 : undefined }}>
          <span data-testid="manpower-summary-exceptions-label" style={{
            minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
            overflowWrap: isMobile ? "anywhere" : undefined,
          }}>{t.newReportMpExceptions}</span>
          <span data-testid="manpower-summary-exceptions-value" style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 13, fontWeight: 800, color: exceptionsCount > 0 ? FT.ACCENT : FT.TEXT_MUTED, fontVariantNumeric: "tabular-nums", fontFamily: FT.FONT }}>{exceptionsCount}</span>
        </div>
      </div>
      <div style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
        alignItems: isMobile ? "start" : "center",
        gap: isMobile ? 6 : 14,
        flexShrink: isMobile ? 1 : 0, minWidth: isMobile ? 0 : undefined,
        width: isMobile ? "100%" : undefined, flexWrap: isMobile ? "wrap" : undefined,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: isMobile ? 0 : undefined }}>
          <span data-testid="manpower-summary-total-hours-label" style={{
            minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
            whiteSpace: isMobile ? "normal" : "nowrap",
            overflowWrap: isMobile ? "anywhere" : undefined,
          }}>{t.newReportMpTotalHrs}</span>
          <span data-testid="manpower-summary-total-hours-value" style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 22, fontWeight: 800, color: exceptionsCount > 0 ? FT.ACCENT : FT.SUCCESS, fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FT.FONT }}>
            {totalManhours.toFixed(1)}
          </span>
        </div>
        {exceptionsCount === 0 ? (
          <span data-testid="manpower-summary-issues-none" style={{
            minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
            whiteSpace: isMobile ? "normal" : "nowrap",
            overflowWrap: isMobile ? "anywhere" : undefined,
            textAlign: isMobile ? "left" : undefined,
          }}>{t.newReportMpIssuesNone}</span>
        ) : (
          <span data-testid="manpower-summary-exception-badge" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 4, background: FT.ACCENT,
            fontSize: 11, fontWeight: 700, color: "#fff",
            whiteSpace: isMobile ? "normal" : "nowrap", minWidth: isMobile ? 0 : undefined,
            maxWidth: isMobile ? "100%" : undefined, textAlign: isMobile ? "center" : undefined, fontFamily: FT.FONT,
            letterSpacing: "0.03em", overflowWrap: isMobile ? "anywhere" : undefined,
          }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span style={{ minWidth: 0, overflowWrap: isMobile ? "anywhere" : undefined }}>
              {exceptionsCount} {t.newReportMpFlagged}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}