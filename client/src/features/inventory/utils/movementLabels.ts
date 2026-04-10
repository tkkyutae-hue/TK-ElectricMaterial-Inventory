/**
 * movementLabels.ts
 * Canonical label maps and helper functions for movement types.
 * Import from here instead of defining inline Record literals in each page.
 */

import { MOVEMENT_META } from "./movementDisplay";

/** Present-tense label: "Receive", "Issue", … */
export const MOVEMENT_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(MOVEMENT_META).map(([k, v]) => [k, v.label]),
);

/** Past-tense label: "Received", "Issued", … */
export const MOVEMENT_PAST_LABEL: Record<string, string> = {
  receive:  "Received",
  issue:    "Issued",
  return:   "Returned",
  adjust:   "Adjusted",
  transfer: "Transferred",
};

/** All known movement type keys */
export const MOVEMENT_TYPES: ReadonlyArray<string> = Object.keys(MOVEMENT_META);

/** Returns present-tense label for a type string, falls back to the raw value. */
export function getMovementLabel(type: string): string {
  return MOVEMENT_LABEL[type?.toLowerCase()] ?? type ?? "Unknown";
}

/** Returns past-tense label for a type string. */
export function getMovementPastLabel(type: string): string {
  return MOVEMENT_PAST_LABEL[type?.toLowerCase()] ?? getMovementLabel(type);
}
