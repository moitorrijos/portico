"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatBedrooms } from "@/lib/format";

/**
 * The filter row above the units table.
 *
 * A real `<form method="get">`, so the filters live in the URL: a filtered
 * view can be linked to a colleague, survives a reload, and is answered by the
 * server. It also works with JavaScript disabled, which is why the submit
 * button is present rather than hidden.
 *
 * The only thing the client component adds is auto-submit on change, so a
 * manager does not have to press a button after picking a community. The
 * button stays visible for the text input, where auto-submitting on every
 * keystroke would fire a navigation per character.
 *
 * Filters sit in one row above everything they scope -- never inside a card,
 * never per-column.
 */
export function UnitsFilters({
  communities,
  bedrooms,
  current,
}: {
  communities: { id: string; name: string }[];
  bedrooms: number[];
  current: {
    communityId?: string;
    status?: string;
    bedrooms?: string;
    query?: string;
    sort?: string;
    direction?: string;
  };
}) {
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function submitNow() {
    form.current?.requestSubmit();
  }

  const hasFilters = Boolean(
    current.communityId || current.status || current.bedrooms || current.query,
  );

  return (
    <form
      ref={form}
      method="get"
      className="flex flex-wrap items-end gap-tight border-b border-rule pb-base"
    >
      {/* The sort is part of the same URL, so it has to survive a filter
          change. Without these the table would silently reset to its default
          order every time someone picked a community. */}
      {current.sort && <input type="hidden" name="sort" value={current.sort} />}
      {current.direction && (
        <input type="hidden" name="direction" value={current.direction} />
      )}

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Search</span>
        <Input
          type="search"
          name="q"
          defaultValue={current.query ?? ""}
          placeholder="Unit or resident"
          className="w-48"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Community</span>
        <Select
          name="community"
          defaultValue={current.communityId ?? ""}
          onChange={submitNow}
          className="w-44"
        >
          <option value="">All communities</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Status</span>
        <Select
          name="status"
          defaultValue={current.status ?? ""}
          onChange={submitNow}
          className="w-40"
        >
          <option value="">Any status</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="VACANT">Vacant</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="RESERVED">Reserved</option>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Bedrooms</span>
        <Select
          name="beds"
          defaultValue={current.bedrooms ?? ""}
          onChange={submitNow}
          className="w-32"
        >
          <option value="">Any</option>
          {bedrooms.map((count) => (
            <option key={count} value={String(count)}>
              {count === 0 ? "Studio" : `${formatBedrooms(count)} bed${count === 1 ? "" : "s"}`}
            </option>
          ))}
        </Select>
      </label>

      <Button type="submit" variant="secondary">
        Apply
      </Button>

      {hasFilters && (
        // Only offered when something is actually filtered. A permanently
        // visible "Clear" on an unfiltered table is a control that does
        // nothing, and the reader has to work that out by pressing it.
        <Button type="button" variant="ghost" onClick={() => router.push("/app/units")}>
          Clear
        </Button>
      )}
    </form>
  );
}
