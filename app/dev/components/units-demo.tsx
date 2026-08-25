"use client";

import { useState } from "react";
import {
  RowLink,
  SortableTh,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  HeaderRow,
} from "@/components/ui/table";
import { Status, type Tone } from "@/components/ui/status";
import { formatMoney } from "@/lib/money";
import { compareNatural } from "@/lib/sort";

/* Real sorting, so SortableTh is exercised rather than merely rendered. */
type Unit = {
  label: string;
  community: string;
  beds: number;
  rentCents: number;
  status: string;
  tone: Tone;
};

const UNITS: Unit[] = [
  { label: "14B", community: "Alder Court", beds: 2, rentCents: 187450, status: "Occupied", tone: "good" },
  { label: "3A", community: "Alder Court", beds: 1, rentCents: 142000, status: "Vacant", tone: "serious" },
  { label: "22C", community: "Linden Row", beds: 3, rentCents: 96500, status: "Maintenance", tone: "warning" },
  { label: "9D", community: "Linden Row", beds: 2, rentCents: 204325, status: "Reserved", tone: "neutral" },
  { label: "7A", community: "Sable Yard", beds: 1, rentCents: 111111, status: "Occupied", tone: "good" },
];

type SortKey = "label" | "beds" | "rentCents";

export function UnitsDemo() {
  const [key, setKey] = useState<SortKey>("label");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  function sortBy(next: SortKey) {
    if (next === key) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setKey(next);
      setDirection("asc");
    }
  }

  const rows = [...UNITS].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // Natural comparison for labels, so 3A sorts before 14B. A plain string
    // sort reads as broken data rather than a broken comparator.
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : compareNatural(String(av), String(bv));
    return direction === "asc" ? cmp : -cmp;
  });

  return (
    <Table caption="Units, sortable by label, bedrooms or rent">
      <THead>
        <HeaderRow>
          <SortableTh
            direction={key === "label" ? direction : undefined}
            onSort={() => sortBy("label")}
          >
            Unit
          </SortableTh>
          <Th scope="col">Community</Th>
          <SortableTh
            numeric
            direction={key === "beds" ? direction : undefined}
            onSort={() => sortBy("beds")}
          >
            Beds
          </SortableTh>
          <SortableTh
            numeric
            direction={key === "rentCents" ? direction : undefined}
            onSort={() => sortBy("rentCents")}
          >
            Rent
          </SortableTh>
          <Th scope="col">Status</Th>
        </HeaderRow>
      </THead>
      <TBody>
        {rows.map((unit) => (
          <Tr key={unit.label}>
            <Th scope="row">
              <RowLink href={`/dev/components#unit-${unit.label}`}>
                Unit {unit.label}
              </RowLink>
            </Th>
            <Td className="text-ink-2">{unit.community}</Td>
            <Td numeric>{unit.beds}</Td>
            <Td numeric>{formatMoney(unit.rentCents)}</Td>
            <Td>
              <Status tone={unit.tone}>{unit.status}</Status>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
