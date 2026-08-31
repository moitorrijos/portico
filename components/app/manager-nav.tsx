"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * The manager sidebar.
 *
 * A client component for one reason: `usePathname`. The active item has to be
 * derived from the URL rather than passed down, because the layout that renders
 * this does not re-render on navigation between its own children -- so a prop
 * threaded from the page would be correct on first load and stale after every
 * subsequent click.
 *
 * Nine sections is a lot, and that is the point: spec §1 lists "real interface
 * density" as one of the four things this project has to prove. The nav is the
 * first evidence of it, so it is not trimmed to look tidier than the app is.
 */

type NavItem = { href: string; label: string; icon: IconName };

const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Portfolio",
    items: [
      { href: "/app", label: "Overview", icon: "building" },
      { href: "/app/communities", label: "Communities", icon: "building" },
      { href: "/app/units", label: "Units", icon: "inbox" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/app/requests", label: "Requests", icon: "alertCircle" },
      { href: "/app/payments", label: "Payments", icon: "check" },
      { href: "/app/documents", label: "Documents", icon: "inbox" },
    ],
  },
  {
    heading: "Outbound",
    items: [
      { href: "/app/announcements", label: "Announcements", icon: "inbox" },
      { href: "/app/inquiries", label: "Inquiries", icon: "inbox" },
      { href: "/app/outbox", label: "Outbox", icon: "arrowRight" },
    ],
  },
];

export function ManagerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Manager sections" className="flex flex-col gap-loose">
      {SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="eyebrow mb-tight px-tight">{section.heading}</p>
          <ul className="flex flex-col">
            {section.items.map((item) => {
              // Exact match for /app, prefix match for the rest. Without the
              // special case, /app would light up on every single page.
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // aria-current is what a screen reader announces; the
                    // colour change alone tells it nothing.
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-tight rounded-[var(--radius-base)] px-tight py-1.5",
                      "transition-colors duration-200 ease-[var(--ease-standard)]",
                      active
                        ? "bg-surface text-ink"
                        : "text-ink-2 hover:text-ink",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size={14}
                      className={active ? "text-accent" : "text-ink-muted"}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
