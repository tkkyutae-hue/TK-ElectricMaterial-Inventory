import assert from "node:assert/strict";
import test from "node:test";
import { getTransactionLoadState } from "../client/src/lib/transaction-load-state";

test("initial transaction request failure is not treated as an empty result", () => {
  assert.equal(getTransactionLoadState({
    isLoading: false,
    isError: true,
    hasLoadedData: false,
    visibleCount: 0,
  }), "error");
});

test("successful zero-row response uses the empty state", () => {
  assert.equal(getTransactionLoadState({
    isLoading: false,
    isError: false,
    hasLoadedData: true,
    visibleCount: 0,
  }), "empty");
});

test("failed background refetch preserves already loaded rows", () => {
  assert.equal(getTransactionLoadState({
    isLoading: false,
    isError: true,
    hasLoadedData: true,
    visibleCount: 12,
  }), "ready");
});

test("loading takes precedence before data or errors are evaluated", () => {
  assert.equal(getTransactionLoadState({
    isLoading: true,
    isError: false,
    hasLoadedData: false,
    visibleCount: 0,
  }), "loading");
});