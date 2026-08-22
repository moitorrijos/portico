import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/* Placeholder. The real marketing home is Phase 4 -- this exists so the route
   is not create-next-app boilerplate, and so the token layer is exercised by
   something other than the reference sheet. */
export default function Home() {
  const isProduction = process.env.APP_ENV === "production";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-base py-loose">
      <p className="eyebrow mb-base">Demo · Pórtico</p>

      <h1 className="font-display text-display-lg leading-[1.05] text-ink">
        Somewhere to arrive
      </h1>

      <p className="mt-base max-w-prose text-lead text-ink-2">
        A property-management portal: a marketing site, a manager dashboard and
        a resident portal. One codebase, two apps, and data each side can only
        see its own half of.
      </p>

      <p className="mt-loose max-w-prose text-ink-muted">
        Pórtico is a fictional company built as a portfolio piece. Nothing here
        describes a real business, and no real resident, address or payment
        exists in it.
      </p>

      <div className="mt-loose flex items-center gap-base border-t border-rule pt-base">
        <ThemeToggle />
        {!isProduction && (
          <Link
            href="/dev/tokens"
            className="eyebrow text-ink-2 underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
          >
            Design tokens
          </Link>
        )}
      </div>
    </main>
  );
}
