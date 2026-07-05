/**
 * GET /api/admin/users — list all platform users for broadcast targeting.
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const gate = await requireSuperadmin();
    if (!gate.ok) return gate.response;
    const { admin } = gate;

    const { data: users, error } = await admin
      .from("users")
      .select("id, name, email")
      .order("email", { ascending: true });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: users ?? [] });
  } catch (e) {
    console.error("[admin/users] error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
