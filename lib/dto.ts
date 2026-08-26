import "server-only";

/**
 * Data transfer objects — the shapes that cross out of the data access layer.
 *
 * These are not a formality. Spec §5's claim is that a resident's payload has
 * no `assigneeId`, no internal notes and no other-tenant fields *because those
 * are never selected*, not because a component declines to render them.
 *
 * The difference is observable. A field that is fetched and then hidden in JSX
 * still travels to the browser inside the RSC payload and sits in the page
 * source. Anyone who opens devtools can read it. Filtering at the render layer
 * is a CSS-level illusion; filtering at the query is the actual property.
 *
 * So: every type here is written by hand rather than derived from the Prisma
 * model with `Omit<>`. A derived type would silently acquire any field added to
 * the schema later — which is exactly the moment a leak would be introduced,
 * and exactly the moment nobody is looking.
 */

export type ResidentRequestNoteDTO = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  // NOTE: no `internal` field, not even `internal: false`. Its presence would
  // imply the other value exists somewhere in this payload, and it would let a
  // future refactor "helpfully" start including internal notes with a flag for
  // the component to filter on.
};

export type ResidentRequestDTO = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "LOW" | "NORMAL" | "URGENT";
  status: "NEW" | "SCHEDULED" | "IN_PROGRESS" | "RESOLVED";
  createdAt: Date;
  scheduledFor: Date | null;
  resolvedAt: Date | null;
  unitLabel: string;
  notes: ResidentRequestNoteDTO[];
  // Absent on purpose: assigneeId, and any notion of who is working on it. Who
  // a manager assigned internally is operational detail, not resident-facing.
};

export type ResidentPaymentDTO = {
  id: string;
  amountCents: number;
  dueDate: Date;
  paidAt: Date | null;
  method: string;
  status: "PAID" | "DUE" | "LATE";
};

export type ResidentDocumentDTO = {
  id: string;
  title: string;
  kind: "LEASE" | "NOTICE" | "RECEIPT" | "POLICY";
  fileUrl: string;
  uploadedAt: Date;
  // Absent on purpose: `scope` and `refId`. Those describe how the document is
  // attached internally; exposing refId would hand a resident another id to
  // probe with.
};

/**
 * The manager's view of the same request — with everything the resident's
 * lacks. Two explicit types rather than one optional-heavy type, because
 * `notes: Note[] & { internal?: boolean }` is a shape where forgetting to check
 * the flag is the default behaviour rather than a deliberate one.
 */
export type ManagerRequestNoteDTO = ResidentRequestNoteDTO & {
  internal: boolean;
};

export type ManagerRequestDTO = Omit<ResidentRequestDTO, "notes"> & {
  residentName: string;
  residentId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  notes: ManagerRequestNoteDTO[];
};
