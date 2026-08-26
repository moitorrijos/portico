import "server-only";

import { getActiveLease, requireManager, requireResident } from "@/lib/dal";
import { db } from "@/lib/db";
import type {
  ManagerRequestDTO,
  ResidentRequestDTO,
} from "@/lib/dto";

/**
 * Maintenance requests — the surface where `RequestNote.internal` lives, which
 * spec §4 calls the most important field in the schema.
 *
 * A manager writes "tenant has complained three times, check the warranty" and
 * it must never reach the resident's screen. Every resident-facing read in this
 * file hard-codes `internal: false` in the WHERE clause. There is no parameter
 * that can turn it off, and no code path here that returns an internal note to
 * a resident.
 */

/**
 * All of the caller's own requests.
 *
 * Scoped by `residentId` from the session — never by an argument. There is no
 * signature for this function that accepts a resident id, which is what makes
 * "returns another resident's rows" not a bug that could be introduced here but
 * a thing that would require rewriting the function.
 */
export async function getResidentRequests(): Promise<ResidentRequestDTO[]> {
  const session = await requireResident();

  const rows = await db.request.findMany({
    where: { residentId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      scheduledFor: true,
      resolvedAt: true,
      unit: { select: { label: true } },
      notes: {
        // The whole claim, in one clause. Not `.filter(n => !n.internal)` after
        // the fact — the rows never leave Postgres.
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  return rows.map(toResidentDTO);
}

/**
 * One request by id, if the caller owns it.
 *
 * Returns `null` for both "does not exist" and "exists but belongs to someone
 * else" — the caller cannot tell which, and turns either into `notFound()`.
 * That is spec §5's direct-object-reference requirement: **404, not 403**. A
 * 403 confirms the record exists, which is information a stranger should not
 * get by guessing an id.
 *
 * Returning `null` rather than calling `notFound()` here is deliberate:
 * `notFound()` throws a Next-specific control-flow error, which would make this
 * function untestable outside a request context. The route calls it; the DAL
 * reports facts.
 */
export async function getResidentRequest(
  requestId: string,
): Promise<ResidentRequestDTO | null> {
  const session = await requireResident();

  const row = await db.request.findFirst({
    // Both conditions in one query. Fetching by id and then comparing
    // ownership in JavaScript is the version of this that leaks the moment
    // someone returns early on the wrong branch.
    where: { id: requestId, residentId: session.userId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      scheduledFor: true,
      resolvedAt: true,
      unit: { select: { label: true } },
      notes: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  return row ? toResidentDTO(row) : null;
}

/**
 * A resident files a request against their own unit.
 *
 * The unit is taken from the active lease, not from the form. A hidden
 * `unitId` input would be the obvious way to build this, and it would let
 * anyone with devtools file a request against a neighbour's unit.
 */
export async function createResidentRequest(input: {
  category: string;
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "URGENT";
}): Promise<{ id: string }> {
  const session = await requireResident();
  const lease = await getActiveLease();

  if (!lease) {
    throw new Error("No active lease; cannot file a maintenance request.");
  }

  const created = await db.request.create({
    data: {
      unitId: lease.unitId,
      residentId: session.userId,
      category: input.category,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "NEW",
    },
    select: { id: true },
  });

  return created;
}

/**
 * The manager's view: every note, internal ones included, plus who filed it and
 * who it is assigned to.
 *
 * Guarded by role rather than ownership — a manager legitimately sees every
 * request. That is the asymmetry the demo is built to show: same id, two
 * sessions, two genuinely different payloads.
 */
export async function getRequestForManager(
  requestId: string,
): Promise<ManagerRequestDTO | null> {
  await requireManager();

  const row = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      scheduledFor: true,
      resolvedAt: true,
      residentId: true,
      assigneeId: true,
      unit: { select: { label: true } },
      resident: { select: { name: true } },
      assignee: { select: { name: true } },
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          internal: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt,
    scheduledFor: row.scheduledFor,
    resolvedAt: row.resolvedAt,
    unitLabel: row.unit.label,
    residentId: row.residentId,
    residentName: row.resident.name,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    notes: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      authorName: note.author.name,
      internal: note.internal,
    })),
  };
}

/** Shared shaping for the two resident reads above. */
function toResidentDTO(row: {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "LOW" | "NORMAL" | "URGENT";
  status: "NEW" | "SCHEDULED" | "IN_PROGRESS" | "RESOLVED";
  createdAt: Date;
  scheduledFor: Date | null;
  resolvedAt: Date | null;
  unit: { label: string };
  notes: { id: string; body: string; createdAt: Date; author: { name: string } }[];
}): ResidentRequestDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt,
    scheduledFor: row.scheduledFor,
    resolvedAt: row.resolvedAt,
    unitLabel: row.unit.label,
    notes: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      authorName: note.author.name,
    })),
  };
}
