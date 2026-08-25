import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * An empty screen is an invitation to act, not a shrug.
 *
 * Two distinct cases, and conflating them is the usual mistake:
 *   - nothing exists yet        -> say what to create, offer the action
 *   - a filter matched nothing  -> say what was searched, offer to clear it
 *
 * The second is far more common in this app and almost always gets the first
 * one's copy, which leaves someone staring at "No units yet" on a portfolio of
 * forty units because they typed a wrong postcode.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  /** What is not here. Plain and specific: "No requests in this community". */
  title: string;
  /** What to do about it. One sentence. */
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-tight px-base py-loose text-center",
        className,
      )}
    >
      <span className="text-ink-muted">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-body font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-xs text-caption text-ink-2">{description}</p>
      )}
      {action && <div className="mt-tight">{action}</div>}
    </div>
  );
}

/**
 * The filtered-to-nothing case, which needs different words from the
 * never-existed case: it names the filter and offers to undo it, because the
 * useful next move is almost always "widen the search".
 */
export function NoResults({
  query,
  onClear,
  className,
}: {
  /** What was searched or filtered for, quoted back so it is obvious. */
  query?: string;
  onClear?: ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon="search"
      title={query ? `Nothing matches “${query}”` : "Nothing matches these filters"}
      description="Try a broader range, or clear the filters to start again."
      action={onClear}
      className={className}
    />
  );
}
