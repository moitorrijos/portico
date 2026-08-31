import { redirect } from "next/navigation";

import { DemoBanner } from "@/components/app/demo-banner";
import { ManagerNav } from "@/components/app/manager-nav";
import { PersonaBar } from "@/components/app/persona-bar";
import { isManager, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * The manager shell.
 *
 * ## Why this layout re-checks the session
 *
 * `proxy.ts` already redirected anonymous traffic away from `/app`, but that
 * check is deliberately optimistic -- it confirms a cookie *exists* and nothing
 * more. A forged cookie containing the word "x" reaches this file. So the
 * layout verifies for real, and a resident who arrives at `/app` with a
 * perfectly valid resident session is sent to their own portal.
 *
 * This is not the authorization boundary either. Every query underneath calls
 * `requireManager()` itself, because a layout guard protects the *page* and the
 * rows are what actually need protecting -- a route handler or a server action
 * under this tree does not render through this layout at all. Spec §5 asks for
 * belt and braces, and this is the belt.
 */
export const metadata = {
  title: "Overview",
};

export default async function ManagerLayout({ children }: LayoutProps<"/app">) {
  const session = await verifySession();

  if (!session) {
    // No `from` parameter here. The proxy already handled the anonymous case
    // with one; arriving here without a session means the cookie was invalid,
    // and preserving the destination would loop them straight back.
    redirect("/");
  }

  if (!isManager(session)) {
    // A resident who follows a manager link gets their own home rather than a
    // permission error. There is nothing they need to fix, so an error page
    // would only be a dead end wearing a status code.
    redirect("/portal");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true, role: true },
  });

  return (
    <div className="flex min-h-full flex-col">
      {/* The reset claim is true in every deployed environment -- the cron is
          declared in app.json, which ships in the image. Locally it is not, so
          the banner does not say so. */}
      <DemoBanner resetsNightly={process.env.APP_ENV !== undefined} />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-loose px-base py-base lg:flex-row lg:gap-0">
        {/* `lg:sticky` with its own scroll: nine sections plus the persona bar
            will outgrow a short viewport, and a sidebar that scrolls the page
            to reach its last item is worse than one that scrolls itself. */}
        <aside className="lg:sticky lg:top-base lg:h-[calc(100vh-2rem)] lg:w-56 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-rule lg:pr-base">
          <div className="flex flex-col gap-loose">
            <div>
              <p className="font-display text-title text-ink">Pórtico</p>
              <p className="eyebrow">Manager</p>
            </div>

            <ManagerNav />

            <PersonaBar name={user.name} role={user.role} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pl-loose">{children}</main>
      </div>
    </div>
  );
}
