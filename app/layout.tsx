import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Plus Jakarta Sans carries everything functional: all UI, every table column,
   axis ticks, form labels, body copy.

   Chosen over Be Vietnam Pro for one measured reason: Be Vietnam Pro has no
   tabular figures at all. Its "1" measures 12.3px against "4" at 22.7px at
   32px, and font-variant-numeric has literally no effect on it -- so ledger
   decimals never line up. §8 requires tabular figures on table columns and
   axis ticks, and a wandering decimal is the most visible way a data table
   looks unfinished. Plus Jakarta Sans is the closest face in character
   (geometric, warm, similar proportions) that actually has them.

   Variable font, so no weight array -- the axis covers the 400/500 we use. */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

/* Playfair Display is the editorial voice: marketing heroes, section heads,
   and exactly one gesture inside the app (the hero occupancy figure). It is a
   variable font, so no weight array -- the axis covers 400/500. */
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pórtico — Property management, quietly done",
    template: "%s · Pórtico",
  },
  description:
    "A demo property-management portal: a marketing site, a manager dashboard and a resident portal. One codebase, two apps, role-scoped data.",
};

/* Runs before first paint, so the correct theme is on <html> before the
   browser has anything to repaint. Resolution order is stored choice, then
   system preference, then light. Kept as a string literal because a bundled
   module would load too late and flash.

   `try` matters: localStorage throws outright in Safari private mode, and an
   uncaught throw here would take the whole inline script with it. */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem("portico-theme");
  var theme = stored === "light" || stored === "dark"
    ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
} catch (e) {
  document.documentElement.setAttribute("data-theme", "light");
}
`.trim();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* suppressHydrationWarning because the script above stamps data-theme
       before React hydrates. React does not manage that attribute -- it is
       deliberately absent from this JSX -- so there is nothing to reconcile. */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
