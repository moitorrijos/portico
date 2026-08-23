import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** What the control needs in order to be described correctly. */
export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
  required: boolean | undefined;
};

/**
 * Wraps a control with its label, optional hint and optional error.
 *
 * `children` is a render function rather than a node, on purpose. The hint and
 * error need real `aria-describedby` wiring, and the two alternatives are both
 * worse: cloning the child breaks on fragments and wrappers, and asking the
 * caller to remember `aria-describedby={`${id}-error`}` is a rule that gets
 * followed until it doesn't. Handing the props over makes it impossible to
 * wire up wrongly.
 *
 * `id` is required rather than generated, because a label needs `htmlFor` to
 * point at something real and a generated id is one more thing that can
 * silently stop matching.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: FieldControlProps) => ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      <label htmlFor={id} className="eyebrow">
        {label}
        {required && (
          <span className="text-critical" aria-hidden>
            {" *"}
          </span>
        )}
      </label>

      {children({
        id,
        // An error replaces the hint rather than joining it: two competing
        // pieces of guidance under one control is worse than one.
        "aria-describedby": errorId ?? hintId,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}

      {/* Never colour alone. On the ivory the red sits below 3:1, so the icon
          is doing real work here rather than decorating. */}
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-caption text-critical"
        >
          <Icon name="alertCircle" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

/** Shared shell for text inputs and selects, so they cannot drift apart. */
export const CONTROL_BASE = cn(
  "h-9 w-full rounded-base border border-rule bg-ground px-tight text-body text-ink",
  "placeholder:text-ink-muted",
  "transition-colors duration-200 ease-standard",
  "hover:border-ink-muted",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "aria-invalid:border-critical",
);
