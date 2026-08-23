import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* No "use client": this component has no hooks, so it works in a server
   component inside a form action AND as a click target inside a client
   component. Marking it client would drag every consumer over the boundary
   for nothing. */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "base" | "small";

/* Separation comes from a hairline and a colour change, never a shadow --
   §7 is explicit that card shadows are out, and a raised button is the same
   gesture. Hover shifts the border or the ink, not the elevation. */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink border border-accent hover:opacity-90",
  secondary:
    "bg-transparent text-ink border border-rule hover:border-ink-muted",
  ghost:
    "bg-transparent text-ink-2 border border-transparent hover:text-ink",
  /* `critical` is a status colour. Using it for a destructive action is the
     one legitimate reuse -- what it must never become is a series colour. */
  danger:
    "bg-transparent text-critical border border-critical/40 hover:border-critical",
};

const SIZES: Record<Size, string> = {
  base: "h-9 px-base text-body",
  small: "h-7 px-tight text-caption",
};

export function Button({
  variant = "secondary",
  size = "base",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-tight rounded-base font-medium",
        "transition-colors duration-200 ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "not-disabled:cursor-pointer",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
