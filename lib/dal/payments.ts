import "server-only";

import { getActiveLease } from "@/lib/dal";
import { db } from "@/lib/db";
import type { ResidentPaymentDTO } from "@/lib/dto";

/**
 * Payments, scoped by the caller's active lease.
 *
 * Payments hang off a Lease, not off a User, so the scope here is `leaseId`
 * rather than `residentId`. That matters: a resident who has lived in two units
 * has two leases, and only the active one is theirs to see in the portal. The
 * lease id comes from `getActiveLease()`, which takes no arguments — so there
 * is no lease-selection parameter to tamper with.
 */

export async function getResidentPayments(): Promise<ResidentPaymentDTO[]> {
  const lease = await getActiveLease();
  // No lease means no payments to show. Not an error — an UPCOMING lease is a
  // legitimate state, and the portal renders an empty state for it.
  if (!lease) return [];

  const rows = await db.payment.findMany({
    where: { leaseId: lease.id },
    orderBy: { dueDate: "desc" },
    select: {
      id: true,
      amountCents: true,
      dueDate: true,
      paidAt: true,
      method: true,
      status: true,
    },
  });

  return rows;
}

/**
 * One payment by id, if it belongs to the caller's active lease.
 *
 * `null` for both "no such payment" and "someone else's payment" — the caller
 * turns either into a 404. See the note in dal/requests.ts on why this is 404
 * and not 403.
 */
export async function getResidentPayment(
  paymentId: string,
): Promise<ResidentPaymentDTO | null> {
  const lease = await getActiveLease();
  if (!lease) return null;

  return db.payment.findFirst({
    // Ownership is part of the query, not a check performed on the result.
    where: { id: paymentId, leaseId: lease.id },
    select: {
      id: true,
      amountCents: true,
      dueDate: true,
      paidAt: true,
      method: true,
      status: true,
    },
  });
}
