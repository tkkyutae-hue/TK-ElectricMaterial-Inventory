import { useLanguage } from "@/hooks/use-language";

export function isRequestLinkedMovement(movement: any): boolean {
  return movement?.referenceType === "material_request";
}

export function RequestLinkedMovementNotice() {
  const { t } = useLanguage();
  return <p role="note" data-testid="request-linked-movement-notice" style={{ fontSize: 11, padding: "6px 10px", margin: 0 }}>
    {t.requestLinkedMovementNotice}
  </p>;
}

export function RequestCompletionUndoNotice() {
  const { t } = useLanguage();
  return <p role="note" data-testid="request-completion-undo-notice" style={{ fontSize: 11, padding: "10px 14px", margin: 0 }}>
    {t.requestCompletionUndoNotice}
  </p>;
}
