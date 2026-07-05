/**
 * POST /api/admin/broadcast
 * Body: { title, message, user_ids?: string[] }
 *   - user_ids omitted or empty → send to ALL users
 *   - user_ids provided         → send only to those users
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const gate = await requireSuperadmin();
    if (!gate.ok) return gate.response;
    const { admin } = gate;

    const body = (await req.json()) as {
      title?: string;
      message?: string;
      user_ids?: string[];
    };
    const { title, message, user_ids } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 },
      );
    }

    // Determine target user IDs
    let targetIds: string[];

    if (user_ids && user_ids.length > 0) {
      // Targeted send — validate those IDs exist
      const { data: validUsers, error: validErr } = await admin
        .from("users")
        .select("id")
        .in("id", user_ids);
      if (validErr)
        return NextResponse.json({ error: validErr.message }, { status: 500 });
      targetIds = (validUsers ?? []).map((u) => u.id);
    } else {
      // Broadcast to all users
      const { data: allUsers, error: allErr } = await admin
        .from("users")
        .select("id");
      if (allErr)
        return NextResponse.json({ error: allErr.message }, { status: 500 });
      targetIds = (allUsers ?? []).map((u) => u.id);
    }

    if (!targetIds.length) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const notifications = targetIds.map((uid) => ({
      user_id: uid,
      type: "broadcast" as const,
      title: title.trim(),
      message: message.trim(),
    }));

    const { error: insertErr } = await admin
      .from("notifications")
      .insert(notifications);
    if (insertErr) {
      console.error("[broadcast] insert error:", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent: notifications.length });
  } catch (e) {
    console.error("[broadcast] unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
