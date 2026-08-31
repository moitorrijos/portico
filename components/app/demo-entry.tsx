import { Button } from "@/components/ui/button";
import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo-personas";

/**
 * The one-click entry points — spec §9: *"One click, no form, no signup. Never
 * make a prospect create an account to look at your work."*
 *
 * Rendered as `<form method="post">` rather than as links. They look identical
 * and behave identically to a click, but minting a session is a state change,
 * and a GET that changes state gets fired by link prefetchers, crawlers, email
 * link-scanners and Next's own `<Link>` prefetch-on-hover. A prospect could
 * otherwise arrive already signed in as somebody else's persona.
 *
 * No JavaScript is involved: a plain form POST works before hydration and
 * without it.
 */

const ORDER: DemoPersonaKey[] = ["manager", "resident", "resident-2"];

const BLURB: Record<DemoPersonaKey, string> = {
  manager: "The full dashboard — every unit, every request, every payment.",
  resident: "One resident's portal. Their unit, their rent, their requests.",
  "resident-2":
    "A different resident, in a different community — so you can see the data really is scoped.",
};

export function DemoEntry() {
  return (
    <div className="flex flex-col gap-base">
      <p className="eyebrow">Sign in as</p>

      <div className="grid gap-base sm:grid-cols-3">
        {ORDER.map((key, index) => (
          <form
            key={key}
            action={`/api/demo/${key}`}
            method="post"
            className="flex flex-col gap-tight border-t border-rule pt-tight"
          >
            <Button
              type="submit"
              // Only the manager is primary. Three primary buttons is no
              // hierarchy at all, and the dashboard is the screen this project
              // exists to show.
              variant={index === 0 ? "primary" : "secondary"}
              className="w-full"
            >
              {DEMO_PERSONAS[key].label}
            </Button>
            <p className="text-caption text-ink-muted">{BLURB[key]}</p>
          </form>
        ))}
      </div>

      <p className="text-caption text-ink-muted">
        No signup, no password. Sessions last seven days and you can switch
        personas from inside either app.
      </p>
    </div>
  );
}
