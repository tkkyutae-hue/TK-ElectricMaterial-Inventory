/**
 * movement-validation.ts
 * Forward-only validation helpers for NEW movement creation and draft confirmation.
 *
 * IMPORTANT:
 * - Do NOT call these on historical records.
 * - Do NOT modify, recalculate, or backfill existing movements.
 * - These are for validating user input before it hits storage.
 */

export interface MovementValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface NewMovementInput {
  itemId?: number | null;
  movementType?: string | null;
  quantity?: number | null;
  sourceLocationId?: number | null;
  destinationLocationId?: number | null;
  projectId?: number | null;
  note?: string | null;
}

const KNOWN_TYPES = new Set(["receive", "issue", "return", "adjust", "transfer"]);

/**
 * Validates input for a new inventory movement.
 * Returns { valid: boolean, errors: Record<field, message> }.
 * Never touches the database.
 */
export function validateNewMovement(input: NewMovementInput): MovementValidationResult {
  const errors: Record<string, string> = {};

  if (!input.itemId || !Number.isInteger(Number(input.itemId)) || Number(input.itemId) <= 0) {
    errors.itemId = "Item is required.";
  }

  if (!input.movementType) {
    errors.movementType = "Movement type is required.";
  } else if (!KNOWN_TYPES.has(input.movementType.toLowerCase())) {
    errors.movementType = `Unknown movement type: "${input.movementType}".`;
  }

  const qty = Number(input.quantity);
  if (input.quantity === undefined || input.quantity === null || isNaN(qty)) {
    errors.quantity = "Quantity must be a number.";
  } else if (qty <= 0) {
    errors.quantity = "Quantity must be greater than zero.";
  } else if (!Number.isInteger(qty)) {
    errors.quantity = "Quantity must be a whole number.";
  }

  const type = input.movementType?.toLowerCase();

  if (type === "transfer") {
    if (!input.sourceLocationId) {
      errors.sourceLocationId = "Source location is required for transfer.";
    }
    if (!input.destinationLocationId) {
      errors.destinationLocationId = "Destination location is required for transfer.";
    }
    if (
      input.sourceLocationId &&
      input.destinationLocationId &&
      input.sourceLocationId === input.destinationLocationId
    ) {
      errors.destinationLocationId = "Source and destination location cannot be the same.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a movement draft before it is confirmed and committed.
 * Applies the same forward-only rules as validateNewMovement.
 */
export function validateDraftForConfirmation(draft: {
  itemId?: number | null;
  movementType?: string | null;
  quantity?: number | null;
  sourceLocationId?: number | null;
  destinationLocationId?: number | null;
}): MovementValidationResult {
  return validateNewMovement({
    itemId:               draft.itemId,
    movementType:         draft.movementType,
    quantity:             draft.quantity,
    sourceLocationId:     draft.sourceLocationId,
    destinationLocationId: draft.destinationLocationId,
  });
}

/**
 * Returns a single human-readable error string (first error found).
 * Convenience wrapper for toast/alert display.
 */
export function firstValidationError(result: MovementValidationResult): string | null {
  if (result.valid) return null;
  return Object.values(result.errors)[0] ?? "Validation failed.";
}
