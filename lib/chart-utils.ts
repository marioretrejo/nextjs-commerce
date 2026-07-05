/**
 * Chart data guards — prevent charts/sparklines from rendering a solid bar when
 * they receive an empty series or a series that is entirely zero.
 */

/**
 * True when `data` has at least one entry with a finite, non-zero value.
 * `getValue` extracts the numeric value from each entry (defaults to the entry
 * itself when it's a number, else its `.value` field).
 */
export function hasChartData(
  data: readonly unknown[] | null | undefined,
  getValue?: (d: unknown) => number,
): boolean {
  if (!data || data.length === 0) return false;
  const val =
    getValue ??
    ((d: unknown) =>
      typeof d === "number"
        ? d
        : Number((d as { value?: number } | null)?.value ?? 0));
  return data.some((d) => {
    const n = val(d);
    return Number.isFinite(n) && n !== 0;
  });
}
