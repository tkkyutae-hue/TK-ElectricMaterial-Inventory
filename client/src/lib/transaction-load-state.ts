export type TransactionLoadState = "loading" | "error" | "empty" | "ready";

export function getTransactionLoadState({
  isLoading,
  isError,
  hasLoadedData,
  visibleCount,
}: {
  isLoading: boolean;
  isError: boolean;
  hasLoadedData: boolean;
  visibleCount: number;
}): TransactionLoadState {
  if (isLoading) return "loading";
  if (isError && !hasLoadedData) return "error";
  if (visibleCount === 0) return "empty";
  return "ready";
}