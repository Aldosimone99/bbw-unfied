import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { resolvePostLoginDestination } from "../../../server/services/post-login-service";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const nextPath = await resolvePostLoginDestination(next ?? undefined);
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/accedi?error=auth_callback", requestUrl.origin));
}
