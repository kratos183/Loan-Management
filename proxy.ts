import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`.
 * Supabase's official docs still tell you to create `middleware.ts`, so be
 * careful when following their setup guide.
 *
 * This does two jobs:
 *   1. Refreshes the auth session cookie so Server Components see a valid user
 *   2. Gates the three portals by role
 */

const PUBLIC_PATHS = ["/login", "/signup", "/", "/emi-calculator-standalone"];

function portalForRole(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "EMPLOYEE":
      return "/employee";
    default:
      return "/user";
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
    },
  });

  // IMPORTANT: getUser() revalidates the JWT against Supabase Auth.
  // Do NOT use getSession() here — it reads unverified cookie data.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    if (isPublic) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Signed in, hitting a public/auth page → go to their portal ───────────
  if (isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();

    if (profile) {
      const dest = request.nextUrl.clone();
      dest.pathname = `${portalForRole(profile.role)}/dashboard`;
      dest.search = "";
      return NextResponse.redirect(dest);
    }
  }

  // ── Portal access control ─────────────────────────────────────────────────
  const segments = pathname.split("/").filter(Boolean);
  const target = segments[0];

  if (target === "user" || target === "employee" || target === "admin") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single<{ role: string; status: string }>();

    if (!profile) return response;

    if (profile.status === "BLOCKED" || profile.status === "CLOSED") {
      const out = request.nextUrl.clone();
      out.pathname = "/login";
      out.searchParams.set("error", "account_blocked");
      return NextResponse.redirect(out);
    }

    const allowed =
      target === "user" ||
      (target === "employee" && (profile.role === "EMPLOYEE" || profile.role === "ADMIN")) ||
      (target === "admin" && profile.role === "ADMIN");

    if (!allowed) {
      const out = request.nextUrl.clone();
      out.pathname = `${portalForRole(profile.role)}/dashboard`;
      out.search = "";
      return NextResponse.redirect(out);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - _next/static, _next/image  (build output)
     *  - favicon.ico and common static assets
     *  - api/auth/*                 (auth routes handle their own session)
     *  - .well-known/*              (Supabase OAuth callbacks)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$|api/auth|\\.well-known).*)",
  ],
};