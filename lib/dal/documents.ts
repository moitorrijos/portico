import "server-only";

import { getActiveLease, requireResident } from "@/lib/dal";
import { db } from "@/lib/db";
import type { ResidentDocumentDTO } from "@/lib/dto";

const DOCUMENT_FIELDS = {
  id: true,
  title: true,
  kind: true,
  fileUrl: true,
  uploadedAt: true,
} as const;

/**
 * Documents are the riskiest read in the app, because `Document.refId` is a
 * polymorphic reference: it points at a Community, a Unit or a User depending
 * on `scope`. Postgres cannot enforce that pairing — there is no foreign key to
 * declare — so every query here must constrain **scope and refId together**.
 *
 * Querying on `refId` alone is the specific mistake this design invites. Ids
 * are cuids drawn from one space, so a resident's own id would happily match a
 * `UNIT`-scoped row keyed by a unit whose id it is not, and vice versa. The
 * schema comment says the same thing; it is repeated here because this is the
 * file where the mistake would actually be made.
 */

/**
 * Everything the caller may see: documents attached to them personally, plus
 * documents attached to the unit they currently lease.
 *
 * The unit id comes from the active lease. A resident who moved out last month
 * stops seeing that unit's documents the moment the lease stops being ACTIVE,
 * without anyone having to remember to revoke anything.
 */
export async function getResidentDocuments(): Promise<ResidentDocumentDTO[]> {
  const session = await requireResident();
  const lease = await getActiveLease();

  return db.document.findMany({
    where: {
      OR: [
        { scope: "RESIDENT", refId: session.userId },
        // Only include the unit branch when there IS an active lease. Without
        // the guard, `refId: undefined` would drop the condition entirely and
        // the OR would match every UNIT-scoped document in the system — a
        // whole-table leak produced by an undefined variable rather than by
        // any visible mistake.
        ...(lease ? [{ scope: "UNIT" as const, refId: lease.unitId }] : []),
      ],
    },
    orderBy: { uploadedAt: "desc" },
    select: DOCUMENT_FIELDS,
  });
}

/**
 * One document by id, if the caller may see it.
 *
 * Note that the id alone is never sufficient: the row must also match one of
 * the caller's own scope/refId pairs. This is the query spec §5's
 * direct-object-reference test exercises — resident A copies a document id,
 * resident B navigates to it, and gets a 404 rather than a 403.
 */
export async function getResidentDocument(
  documentId: string,
): Promise<ResidentDocumentDTO | null> {
  const session = await requireResident();
  const lease = await getActiveLease();

  return db.document.findFirst({
    where: {
      id: documentId,
      OR: [
        { scope: "RESIDENT", refId: session.userId },
        ...(lease ? [{ scope: "UNIT" as const, refId: lease.unitId }] : []),
      ],
    },
    select: DOCUMENT_FIELDS,
  });
}
