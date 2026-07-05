/**
 * Superadmin guard — authorisation decision core.
 *
 * Locks in the null/empty behaviour that previously risked turning God-mode
 * admin endpoints into 500s (or white screens) instead of clean 401/403s:
 *   - logged-out caller              → 401
 *   - authenticated but no profile   → 403 (null-safe)
 *   - profile row missing the column → 403 (undefined is not superadmin)
 *   - is_superadmin explicitly false → 403
 *   - is_superadmin true             → authorized
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateSuperadmin } from "@/lib/admin/guard";

const USER = { id: "user-123" };

describe("evaluateSuperadmin — unauthenticated", () => {
  it("null user → 401", () => {
    const d = evaluateSuperadmin(null, { is_superadmin: true });
    assert.deepEqual(d, { authorized: false, status: 401 });
  });

  it("undefined user → 401", () => {
    const d = evaluateSuperadmin(undefined, { is_superadmin: true });
    assert.deepEqual(d, { authorized: false, status: 401 });
  });
});

describe("evaluateSuperadmin — authenticated but not superadmin", () => {
  it("null profile (no row / .single() returned data:null) → 403", () => {
    const d = evaluateSuperadmin(USER, null);
    assert.deepEqual(d, { authorized: false, status: 403 });
  });

  it("undefined profile → 403", () => {
    const d = evaluateSuperadmin(USER, undefined);
    assert.deepEqual(d, { authorized: false, status: 403 });
  });

  it("profile missing is_superadmin column → 403", () => {
    const d = evaluateSuperadmin(USER, {});
    assert.deepEqual(d, { authorized: false, status: 403 });
  });

  it("is_superadmin explicitly false → 403", () => {
    const d = evaluateSuperadmin(USER, { is_superadmin: false });
    assert.deepEqual(d, { authorized: false, status: 403 });
  });

  it("is_superadmin null → 403", () => {
    const d = evaluateSuperadmin(USER, { is_superadmin: null });
    assert.deepEqual(d, { authorized: false, status: 403 });
  });
});

describe("evaluateSuperadmin — authorized", () => {
  it("user + is_superadmin true → authorized", () => {
    const d = evaluateSuperadmin(USER, { is_superadmin: true });
    assert.deepEqual(d, { authorized: true });
  });

  it("precedence: no user beats a superadmin profile (401, not 403)", () => {
    const d = evaluateSuperadmin(null, { is_superadmin: true });
    assert.equal(d.authorized, false);
    assert.equal(d.authorized === false && d.status, 401);
  });
});
