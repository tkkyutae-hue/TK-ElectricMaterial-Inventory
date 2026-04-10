/**
 * movementDisplay.ts
 * Client-side movement interpretation helpers.
 *
 * Mirrors server/services/inventory/movement-display.ts for frontend use.
 * Carries additional UI-specific properties (Tailwind classes, dark-mode RGBA colours).
 *
 * NON-DESTRUCTIVE: display-only, no storage mutations.
 */

export type MovementDirection    = "in" | "out" | "neutral";
export type MovementColorVariant = "green" | "red" | "blue" | "amber" | "muted";

export interface MovementMeta {
  /** Display label ("Receive", "Issue", …) */
  label: string;
  /** Inventory direction */
  direction: MovementDirection;
  /** Whether this type changes quantityOnHand */
  affectsStock: boolean;
  /** Semantic colour category */
  colorVariant: MovementColorVariant;
  /** Lucide icon component name */
  iconName: string;
  /** Tailwind classes for Admin / light mode badge */
  lightClass: string;
  /** RGBA values for Field / dark mode badge */
  dark: { bg: string; color: string; border: string };
}

export const MOVEMENT_META: Record<string, MovementMeta> = {
  receive: {
    label: "Receive",  direction: "in",      affectsStock: true,  colorVariant: "green",
    iconName: "PackageCheck",
    lightClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dark: { bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)"  },
  },
  issue: {
    label: "Issue",    direction: "out",     affectsStock: true,  colorVariant: "red",
    iconName: "PackageMinus",
    lightClass: "bg-rose-50 text-rose-700 border-rose-100",
    dark: { bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.22)"   },
  },
  return: {
    label: "Return",   direction: "in",      affectsStock: true,  colorVariant: "green",
    iconName: "Undo2",
    lightClass: "bg-sky-50 text-sky-700 border-sky-100",
    dark: { bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)"  },
  },
  adjust: {
    label: "Adjust",   direction: "neutral", affectsStock: true,  colorVariant: "amber",
    iconName: "SlidersHorizontal",
    lightClass: "bg-amber-50 text-amber-700 border-amber-100",
    dark: { bg: "rgba(245,166,35,0.10)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.22)"  },
  },
  transfer: {
    label: "Transfer", direction: "neutral", affectsStock: false, colorVariant: "blue",
    iconName: "ArrowLeftRight",
    lightClass: "bg-blue-50 text-blue-700 border-blue-100",
    dark: { bg: "rgba(91,156,246,0.12)",  color: "#5b9cf6", border: "1px solid rgba(91,156,246,0.22)"  },
  },
};

const FALLBACK: MovementMeta = {
  label: "Unknown",  direction: "neutral", affectsStock: false, colorVariant: "muted",
  iconName: "HelpCircle",
  lightClass: "bg-slate-50 text-slate-600 border-slate-100",
  dark: { bg: "rgba(100,116,139,0.10)", color: "#7aab82", border: "1px solid rgba(100,116,139,0.25)" },
};

/** Returns full display metadata for a movement type. Never throws. */
export function getMovementMeta(type: string): MovementMeta {
  if (!type) return FALLBACK;
  return MOVEMENT_META[type.toLowerCase()] ?? { ...FALLBACK, label: type };
}

/** "+", "-", or "→" sign prefix for a quantity display */
export function movementQtyPrefix(type: string): string {
  const { direction } = getMovementMeta(type);
  if (direction === "in")  return "+";
  if (direction === "out") return "-";
  return "→";
}

/** Tailwind text-color class for a quantity value based on movement type */
export function movementQtyClass(type: string): string {
  const { colorVariant } = getMovementMeta(type);
  const MAP: Record<MovementColorVariant, string> = {
    green: "text-emerald-600",
    red:   "text-rose-600",
    blue:  "text-blue-600",
    amber: "text-amber-600",
    muted: "text-slate-500",
  };
  return MAP[colorVariant] ?? "text-slate-500";
}

/** Tailwind text-color class for field/dark mode */
export function movementDarkQtyColor(type: string): string {
  const { dark } = getMovementMeta(type);
  return dark.color;
}
