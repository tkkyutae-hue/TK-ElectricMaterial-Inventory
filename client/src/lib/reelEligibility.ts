/**
 * client/src/lib/reelEligibility.ts
 *
 * Thin re-export so existing client imports keep working unchanged.
 * All classification logic now lives in shared/reelEligibility.ts.
 */
export type { ReelEligibilityInput, ReelClassification } from "@shared/reelEligibility";
export { classifyReel, isReelEligible, resolveReelMode } from "@shared/reelEligibility";
