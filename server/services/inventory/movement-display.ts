/**
 * movement-display.ts
 * Server-side movement interpretation helper.
 * Returns display-oriented metadata for any movement type stored in the DB.
 *
 * NON-DESTRUCTIVE: reads only — never modifies DB values.
 * Compatible with all legacy movement type strings.
 */

export type MovementDirection = "in" | "out" | "neutral";
export type MovementColorVariant = "green" | "red" | "blue" | "amber" | "muted";

export interface MovementMeta {
  label: string;
  direction: MovementDirection;
  affectsStock: boolean;
  colorVariant: MovementColorVariant;
  iconName: string;
}

const MOVEMENT_META: Record<string, MovementMeta> = {
  receive:  { label: "Receive",  direction: "in",      affectsStock: true,  colorVariant: "green", iconName: "PackageCheck"       },
  issue:    { label: "Issue",    direction: "out",     affectsStock: true,  colorVariant: "red",   iconName: "PackageMinus"       },
  return:   { label: "Return",   direction: "in",      affectsStock: true,  colorVariant: "green", iconName: "Undo2"              },
  adjust:   { label: "Adjust",   direction: "neutral", affectsStock: true,  colorVariant: "amber", iconName: "SlidersHorizontal"  },
  transfer: { label: "Transfer", direction: "neutral", affectsStock: false, colorVariant: "blue",  iconName: "ArrowLeftRight"     },
};

const FALLBACK_META: MovementMeta = {
  label: "Unknown",
  direction: "neutral",
  affectsStock: false,
  colorVariant: "muted",
  iconName: "HelpCircle",
};

/**
 * Returns display metadata for a movement type string.
 * Gracefully handles unknown or legacy types — never throws.
 */
export function getMovementMeta(movementType: string): MovementMeta {
  if (!movementType) return FALLBACK_META;
  return MOVEMENT_META[movementType.toLowerCase()] ?? { ...FALLBACK_META, label: movementType };
}

/**
 * Returns the sign prefix for a quantity value based on movement direction.
 * Useful for audit log rendering.
 */
export function movementQtyPrefix(movementType: string): "+" | "-" | "→" {
  const { direction } = getMovementMeta(movementType);
  if (direction === "in")  return "+";
  if (direction === "out") return "-";
  return "→";
}

/** Returns all known movement types with their metadata. */
export function getAllMovementMetas(): Record<string, MovementMeta> {
  return { ...MOVEMENT_META };
}
