/**
 * Unit tests for the chart-data guard (lib/chart-utils.ts) — used to render an
 * EmptyState instead of a solid bar when a series is empty or all-zero.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasChartData } from "@/lib/chart-utils";

describe("hasChartData", () => {
  it("is false for null/undefined/empty", () => {
    assert.strictEqual(hasChartData(null), false);
    assert.strictEqual(hasChartData(undefined), false);
    assert.strictEqual(hasChartData([]), false);
  });

  it("is false when every value is zero", () => {
    assert.strictEqual(hasChartData([0, 0, 0]), false);
    assert.strictEqual(hasChartData([{ value: 0 }, { value: 0 }]), false);
  });

  it("is true when at least one value is non-zero", () => {
    assert.strictEqual(hasChartData([0, 0, 3]), true);
    assert.strictEqual(hasChartData([{ value: 0 }, { value: 7 }]), true);
  });

  it("supports a custom value accessor", () => {
    const series = [{ score: 0 }, { score: 82 }];
    assert.strictEqual(
      hasChartData(series, (d) => (d as { score: number }).score),
      true,
    );
    assert.strictEqual(
      hasChartData([{ score: 0 }], (d) => (d as { score: number }).score),
      false,
    );
  });

  it("ignores non-finite values", () => {
    assert.strictEqual(hasChartData([NaN, Infinity]), false);
  });
});
