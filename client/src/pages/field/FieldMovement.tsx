import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { MovementForm } from "@/components/MovementForm";

export default function FieldMovement() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetType = params.get("type") ?? "receive";
  const draftId = params.get("draftId") ? Number(params.get("draftId")) : undefined;
  const { user } = useAuth();
  const { t } = useLanguage();
  const isViewer = user?.role === "viewer";

  const isReceive = presetType === "receive";
  const heading = isReceive ? t.receiveReturn : t.issueTransfer;
  const emoji   = isReceive ? "📦" : "📤";
  const allowedTypes = isReceive ? ["receive", "return"] : ["issue", "transfer"];

  return (
    <div style={{ paddingTop: 28, paddingBottom: 48, paddingLeft: 0, paddingRight: 0 }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 24, fontWeight: 700,
          color: "#ffffff", margin: "0 0 5px",
          letterSpacing: 0.3,
        }}>
          {emoji} {heading}
          {draftId && (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: "#f5a623", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              — {t.resumingDraft}
            </span>
          )}
        </h1>
        <p style={{
          fontSize: 11, color: "#2ddb6f", margin: 0,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
        }}>
          {draftId ? t.editConfirmDraft : t.logMovement}
        </p>
      </div>

      <MovementForm
        key={draftId ? `draft-${draftId}` : presetType}
        defaultType={presetType}
        allowedTypes={allowedTypes}
        fieldMode
        readOnly={isViewer}
        draftId={draftId}
      />
    </div>
  );
}
