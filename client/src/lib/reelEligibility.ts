/**
 * Re-exports from the canonical shared implementation.
 * All consumers (FieldInventory, ItemRowField, ItemDetails) import from here
 * and continue working unchanged.
 */
export type { ReelEligibilityInput } from "@shared/reelEligibility";
export { isReelEligible, getReelIneligibilityReason } from "@shared/reelEligibility";
