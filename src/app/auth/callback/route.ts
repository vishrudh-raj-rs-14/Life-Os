import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Google OAuth redirect lands here.
// Supabase gives us a `code` param; we exchange it for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Production URL — prefer the explicit env var over the request origin
  // so that if the callback is somehow hit on a preview URL we still land
  // on the right place.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    origin;

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  const client = await supabaseServer();
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(
      `${siteUrl}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Redirect to the app.  The (app) layout will detect the session and
  // redirect to /onboarding if no user profile exists yet.
  return NextResponse.redirect(`${siteUrl}/`);
}
