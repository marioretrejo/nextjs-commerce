import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { current_password?: string; new_password?: string };
  try {
    body = (await req.json()) as {
      current_password?: string;
      new_password?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { current_password, new_password } = body;

  if (!new_password || new_password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // Re-verify the current password before allowing a change, so a hijacked
  // (but un-reauthenticated) session can't silently take over the account.
  if (!current_password) {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 },
    );
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Account has no email to verify against" },
      { status: 400 },
    );
  }
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  });
  if (verifyError) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
