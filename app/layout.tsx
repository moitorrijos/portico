import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import "./globals.css";

/* Be Vietnam Pro carries everything functional: all UI, every table column,
   axis ticks, form labels, body copy. Two weights only -- §7 wants hierarchy
   from size and spacing, not weight. */
const sans = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-be-vietnam",
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
