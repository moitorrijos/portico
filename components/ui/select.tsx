import type { SelectHTMLAttributes } from "react";
import { CONTROL_BASE } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * A real `<select>`, not a custom listbox. It is keyboard-accessible and
 * native on mobile for free, and §12 is clear that this project spends its
 * time on the data problems rather than rebuilding form controls.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          CONTROL_BASE,
          // Room for the chevron, and the native one removed so there is only one.
          "cursor-pointer appearance-none pr-8",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-tight top-1/2 -translate-y-1/2 text-ink-muted">
        <Icon name="chevronDown" />
      </span>
    </div>
  );
}
