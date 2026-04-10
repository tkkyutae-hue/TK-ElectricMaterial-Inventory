import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </span>
  );
}
