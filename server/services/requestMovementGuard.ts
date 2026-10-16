/** Request-linked movements must only change inside the versioned request command. */
export function assertStandaloneMovement(movement: { referenceType?: string | null }) {
  if (movement.referenceType === "material_request") {
    throw new Error("Request-linked movements require the request completion/Undo workflow");
  }
}
