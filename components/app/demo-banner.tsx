import Link from "next/link";

/**
 * The honesty banner.
 *
 * Spec §2 is unambiguous: *"Where a real site would show proof, Pórtico shows
 * product."* Pórtico is a fictional company, and a demo that does not say so
 * is just a fake company website. The banner is the single line that makes
 * every other claim on the screen readable as a design decision rather than as
 * an invented fact.
 *
 * It sits at the top of the viewport rather than tucked in a footer, and it is
 * not dismissible. A banner a prospect can close is a banner that will be
 * screenshotted closed.
 *
 * Deliberately quiet, though: hairline and muted ink, no warning colours. The
 * status palette is reserved for data, and dressing this as an alert would
 * pull attention away from the work itself — which is the opposite of the job.
 * §7's restraint is the whole reason a prospect trusts the screen behind it.
 */
export function DemoBanner({ resetsNightly = false }: { resetsNightly?: boolean }) {
  return (
    <div className="border-b border-rule bg-surface">
      <p className="mx-auto flex max-w-[1400px] flex-wrap items-baseline gap-x-2 gap-y-1 px-base py-tight text-caption text-ink-2">
        <span className="eyebrow">Demo</span>
        <span>
          Pórtico is a fictional property-management company, built as a
          portfolio piece. No real resident, address or payment appears here
          {/* Only claimed when it is true. §2's honesty rules cut both ways:
              a banner promising a nightly reset that no cron performs is
              exactly the kind of small lie this banner exists to avoid. The
              flag is threaded from the layout rather than read here, so the
              claim and the cron that backs it are configured in one place. */}
          {resetsNightly ? ", and the data resets nightly." : "."}
        </span>
        <Link
          href="/"
          className="underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
        >
          About this project
        </Link>
      </p>
    </div>
  );
}
