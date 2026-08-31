import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Who you are signed in as, and how to stop being them.
 *
 * A demo needs a visible, one-click way back out, because the most common
 * thing a prospect does after reaching the dashboard is wonder what the *other*
 * side looks like. Making them hunt for a sign-out is the fastest way to end
 * the visit early.
 *
 * It is a form, not a link, because `/api/demo/logout` is POST-only -- a GET
 * sign-out gets fired by link prefetchers and email scanners, and "why am I
 * logged out?" is a miserable thing to debug when the answer is a crawler.
 */
export function PersonaBar({ name, role }: { name: string; role: string }) {
  return (
    <div className="mt-auto flex flex-col gap-tight border-t border-rule pt-base">
      <div>
        <p className="text-body text-ink">{name}</p>
        <p className="eyebrow">{role.toLowerCase()}</p>
      </div>

      <div className="flex items-center justify-between gap-tight">
        <ThemeToggle />
        <form action="/api/demo/logout" method="post">
          <button
            type="submit"
            className="eyebrow cursor-pointer underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
