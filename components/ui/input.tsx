import type { InputHTMLAttributes } from "react";
import { CONTROL_BASE } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export function Input({
  className,
  icon,
  numeric,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  /** Leading affordance. Use sparingly -- a search field earns one, a name does not. */
  icon?: IconName;
  /** Figures that need to line up down a column of inputs (rent, amounts). */
  numeric?: boolean;
}) {
  const field = (
    <input
      className={cn(
        CONTROL_BASE,
        icon && "pl-8",
        numeric && "figures-tabular text-right",
        className,
      )}
      {...props}
    />
  );

  if (!icon) return field;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-tight top-1/2 -translate-y-1/2 text-ink-muted">
        <Icon name={icon} />
      </span>
      {field}
    </div>
  );
}
