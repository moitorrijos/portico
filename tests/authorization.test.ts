import { SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  AuthorizationError,
  getActiveLease,
  requireManager,
  requireResident,
  verifySession,
} from "@/lib/dal";
import { getResidentDocument, getResidentDocuments } from "@/lib/dal/documents";
import { getResidentPayment, getResidentPayments } from "@/lib/dal/payments";
import {
  createResidentRequest,
  getRequestForManager,
  getResidentRequest,
  getResidentRequests,
} from "@/lib/dal/requests";
import { db } from "@/lib/db";
import { encryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

import { __clearCookies, __setCookie } from "./stubs/next-headers";
import { TEST_SESSION_SECRET } from "./setup/database-url.mjs";

/**
 * The authorization suite.
 *
 * Spec §5 makes a claim -- "there is no code path that returns another
 * resident's row" -- and §13 says the case study is built on it. This file is
 * what turns that from an assertion into something falsifiable. Every test here
 * is a sentence from the spec that would fail if the property stopped holding.
 *
 * Three things about how it is built:
 *
 * 1. It runs against a **real Postgres**, seeded with the real demo data. A
 *    mocked Prisma would only confirm that the code passes the arguments we
 *    already believe it passes. The claim is about which rows come back, and a
 *    `where` clause that silently matches everything -- because an `undefined`
 *    dropped a condition -- looks identical to a correct one from the outside.
 *
 * 2. The **only** thing stubbed is `next/headers`, because there is no request
 *    here to carry a cookie. The JWT is signed and verified for real, the
 *    session is decoded for real, the queries run for real.
 *
 * 3. Neighbours are real neighbours. The database holds 42 units, 32 leases and
 *    25 requests, so "resident A cannot see resident B's row" is asked against
 *    a table where B's rows genuinely sit next to A's, not a two-row fixture
 *    arranged to pass.
 */

const MARCUS = "marcus.ellery@example.com";
const PRIYA = "priya.raghavan@example.com";
const MANAGER = "dana.whitfield@porticoliving.example";

type Fixture = { id: string; role: "OWNER" | "STAFF" | "RESIDENT" };

let marcus: Fixture;
let priya: Fixture;
let manager: Fixture;
/** A resident with no lease at all -- the seed does not produce one. */
let unhoused: Fixture;

async function userByEmail(email: string): Promise<Fixture> {
  return db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });
}

/** Puts a genuine, correctly-signed session cookie in the store. */
async function signIn(user: Fixture): Promise<void> {
  __setCookie(
    SESSION_COOKIE_NAME,
    await encryptSession({ userId: user.id, role: user.role }),
  );
}

beforeAll(async () => {
  [marcus, priya, manager] = await Promise.all([
    userByEmail(MARCUS),
    userByEmail(PRIYA),
    userByEmail(MANAGER),
  ]);

  // Every seeded resident holds an active lease, so the "no lease" branch --
  // the one guarding against a whole-table document leak -- has no fixture.
  // Created here rather than in the seed: the demo should not contain a
  // resident who cannot see anything, and test needs are not design needs.
  unhoused = await db.user.create({
    data: {
      email: "no.lease@example.com",
      name: "Unhoused Fixture",
      role: "RESIDENT",
    },
    select: { id: true, role: true },
  });
});

beforeEach(() => {
  // No session leaks from the previous test. Without this a test that forgets
  // to sign in would silently inherit the last identity and pass for the wrong
  // reason -- the most dangerous failure mode a suite like this can have.
  __clearCookies();
});

describe("session resolution", () => {
  // This block is a canary. Every other test assumes that signing in as
  // somebody else actually changes who the DAL thinks is calling -- and
  // `verifySession` is wrapped in React's `cache()`. If that memoized across
  // calls outside a request scope, every test after the first would silently
  // run as the first test's user and pass vacuously. These four prove it does
  // not, and they must keep passing for the rest of the file to mean anything.
  it("resolves the signed-in user", async () => {
    await signIn(marcus);
    expect((await verifySession())?.userId).toBe(marcus.id);
  });

  it("resolves a different user in the next test", async () => {
    await signIn(priya);
    expect((await verifySession())?.userId).toBe(priya.id);
  });

  it("resolves a different user WITHIN one test", async () => {
    await signIn(marcus);
    expect((await verifySession())?.userId).toBe(marcus.id);
    await signIn(priya);
    expect((await verifySession())?.userId).toBe(priya.id);
  });

  it("returns null when there is no cookie", async () => {
    expect(await verifySession()).toBeNull();
  });

  it("returns null for a token signed with another key", async () => {
    // Staging and production hold different secrets on purpose. A staging
    // cookie replayed against production must be worth nothing.
    const foreign = await new SignJWT({ userId: marcus.id, role: "RESIDENT" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-different-environments-secret"));

    __setCookie(SESSION_COOKIE_NAME, foreign);
    expect(await verifySession()).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const expired = await new SignJWT({ userId: marcus.id, role: "RESIDENT" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(TEST_SESSION_SECRET));

    __setCookie(SESSION_COOKIE_NAME, expired);
    expect(await verifySession()).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await encryptSession({ userId: marcus.id, role: "RESIDENT" });
    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    __setCookie(SESSION_COOKIE_NAME, tampered);
    expect(await verifySession()).toBeNull();
  });

  it("returns null when the signed-in user no longer exists", async () => {
    // The cookie is authentic but stale. The DAL re-reads the user rather than
    // trusting the token's contents, so a deleted account cannot keep browsing
    // on a token minted while it existed.
    const ghost = await db.user.create({
      data: { email: "ghost@example.com", name: "Ghost", role: "RESIDENT" },
      select: { id: true, role: true },
    });
    await signIn(ghost);
    expect((await verifySession())?.userId).toBe(ghost.id);

    await db.user.delete({ where: { id: ghost.id } });
    expect(await verifySession()).toBeNull();
  });

  it("does not trust the role carried in the cookie", async () => {
    // A forged-but-signed token claiming OWNER should still not make a resident
    // a manager: the role comes from the database row, not the payload.
    const lying = await new SignJWT({ userId: marcus.id, role: "OWNER" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_SESSION_SECRET));

    __setCookie(SESSION_COOKIE_NAME, lying);
    expect((await verifySession())?.role).toBe("RESIDENT");
    await expect(requireManager()).rejects.toThrow(AuthorizationError);
  });
});

describe("a resident cannot read another resident's rows", () => {
  // Spec §5's direct-object-reference test. In each case the id is real and
  // the row exists -- what differs is who is asking. The answer must be `null`,
  // which the route turns into 404 rather than 403, because a 403 confirms the
  // record exists and that is what someone guessing ids wants to learn.

  it("payment: Priya's payment id returns null for Marcus", async () => {
    await signIn(priya);
    const [priyasPayment] = await getResidentPayments();
    expect(priyasPayment).toBeDefined();

    await signIn(marcus);
    expect(await getResidentPayment(priyasPayment!.id)).toBeNull();

    // ...and the same id genuinely resolves for its owner, so the null above
    // is a scoping result and not a broken query.
    await signIn(priya);
    expect((await getResidentPayment(priyasPayment!.id))?.id).toBe(priyasPayment!.id);
  });

  it("request: Priya's request id returns null for Marcus", async () => {
    await signIn(priya);
    const [priyasRequest] = await getResidentRequests();
    expect(priyasRequest).toBeDefined();

    await signIn(marcus);
    expect(await getResidentRequest(priyasRequest!.id)).toBeNull();

    await signIn(priya);
    expect((await getResidentRequest(priyasRequest!.id))?.id).toBe(priyasRequest!.id);
  });

  it("document: Priya's document id returns null for Marcus", async () => {
    await signIn(priya);
    const priyasDocuments = await getResidentDocuments();
    expect(priyasDocuments.length).toBeGreaterThan(0);

    await signIn(marcus);
    for (const document of priyasDocuments) {
      expect(await getResidentDocument(document.id)).toBeNull();
    }

    await signIn(priya);
    expect((await getResidentDocument(priyasDocuments[0]!.id))?.id).toBe(
      priyasDocuments[0]!.id,
    );
  });

  it("an unknown id returns null rather than throwing", async () => {
    await signIn(marcus);
    expect(await getResidentRequest("cuid-that-does-not-exist")).toBeNull();
    expect(await getResidentPayment("cuid-that-does-not-exist")).toBeNull();
    expect(await getResidentDocument("cuid-that-does-not-exist")).toBeNull();
  });

  it("list reads return only the caller's own rows", async () => {
    await signIn(marcus);
    const marcusRequestIds = (await getResidentRequests()).map((r) => r.id);
    const marcusPaymentIds = (await getResidentPayments()).map((p) => p.id);

    await signIn(priya);
    const priyaRequestIds = (await getResidentRequests()).map((r) => r.id);
    const priyaPaymentIds = (await getResidentPayments()).map((p) => p.id);

    expect(marcusRequestIds.length).toBeGreaterThan(0);
    expect(priyaRequestIds.length).toBeGreaterThan(0);
    expect(marcusRequestIds.some((id) => priyaRequestIds.includes(id))).toBe(false);
    expect(marcusPaymentIds.some((id) => priyaPaymentIds.includes(id))).toBe(false);
  });
});

describe("internal notes never reach a resident", () => {
  // §4 calls RequestNote.internal the most important field in the schema, and
  // §5 requires it be filtered in the query rather than in the component. The
  // distinction is observable: a field that is fetched and then hidden in JSX
  // still travels in the RSC payload and sits in the page source.

  it("the resident payload does not contain the internal note's text", async () => {
    const internalNote = await db.requestNote.findFirstOrThrow({
      where: { internal: true, request: { residentId: marcus.id } },
      select: { body: true, requestId: true },
    });

    await signIn(marcus);
    const request = await getResidentRequest(internalNote.requestId);
    expect(request).not.toBeNull();

    // Serialise the WHOLE payload and search it. This is the automated form of
    // the manual check in the plan -- "confirm the note is absent from the DOM,
    // not merely hidden; check page source, not the rendered view". Asserting
    // on `notes` alone would miss a leak through any other field.
    expect(JSON.stringify(request)).not.toContain(internalNote.body);
  });

  it("no internal note text appears anywhere in the full request list", async () => {
    const internalBodies = (
      await db.requestNote.findMany({
        where: { internal: true, request: { residentId: marcus.id } },
        select: { body: true },
      })
    ).map((n) => n.body);

    expect(internalBodies.length).toBeGreaterThan(0);

    await signIn(marcus);
    const serialised = JSON.stringify(await getResidentRequests());
    for (const body of internalBodies) {
      expect(serialised).not.toContain(body);
    }
  });

  it("the manager reading the SAME id does see them", async () => {
    // The asymmetry is the demo. Same row, two sessions, two different
    // payloads -- and this test fails if the resident read were "fixed" by
    // removing internal notes from the database instead of from the query.
    const internalNote = await db.requestNote.findFirstOrThrow({
      where: { internal: true, request: { residentId: marcus.id } },
      select: { body: true, requestId: true },
    });

    await signIn(manager);
    const managerView = await getRequestForManager(internalNote.requestId);
    expect(JSON.stringify(managerView)).toContain(internalNote.body);
    expect(managerView!.notes.some((n) => n.internal)).toBe(true);
  });

  it("the resident DTO omits operational fields entirely", async () => {
    await signIn(marcus);
    const [request] = await getResidentRequests();
    expect(request).toBeDefined();

    // Absent, not merely undefined -- these keys are never selected.
    expect(Object.keys(request!)).not.toContain("assigneeId");
    expect(Object.keys(request!)).not.toContain("residentId");
    for (const note of request!.notes) {
      expect(Object.keys(note)).not.toContain("internal");
    }
  });
});

describe("role guards", () => {
  it("a resident calling a manager guard is rejected", async () => {
    await signIn(marcus);
    await expect(requireManager()).rejects.toThrow(AuthorizationError);
  });

  it("a manager calling a resident guard is rejected", async () => {
    await signIn(manager);
    await expect(requireResident()).rejects.toThrow(AuthorizationError);
  });

  it("an anonymous caller is rejected by both", async () => {
    await expect(requireManager()).rejects.toThrow(AuthorizationError);
    await expect(requireResident()).rejects.toThrow(AuthorizationError);
  });

  it("anonymous resident reads throw rather than returning data", async () => {
    // They throw, not return null -- a caller that forgets to check a returned
    // value fails open and reaches the query anyway. A throw cannot be ignored
    // by omission.
    await expect(getResidentRequests()).rejects.toThrow(AuthorizationError);
    await expect(getResidentDocuments()).rejects.toThrow(AuthorizationError);
  });

  it("a manager has no active lease, so resident scoping cannot resolve", async () => {
    await signIn(manager);
    expect(await getActiveLease()).toBeNull();
  });
});

describe("scope comes from the session, never from an argument", () => {
  it("getActiveLease resolves the caller's own lease", async () => {
    await signIn(marcus);
    const lease = await getActiveLease();
    expect(lease?.residentId).toBe(marcus.id);

    await signIn(priya);
    expect((await getActiveLease())?.residentId).toBe(priya.id);
  });

  it("a filed request is attached to the caller's own unit", async () => {
    // There is no unitId parameter to tamper with -- the unit comes from the
    // active lease. This test would fail the moment someone added one.
    await signIn(marcus);
    const lease = await getActiveLease();
    const created = await createResidentRequest({
      category: "Plumbing",
      title: "Test fixture request",
      description: "Filed by the authorization suite.",
      priority: "NORMAL",
    });

    const row = await db.request.findUniqueOrThrow({
      where: { id: created.id },
      select: { unitId: true, residentId: true },
    });

    expect(row.residentId).toBe(marcus.id);
    expect(row.unitId).toBe(lease!.unitId);

    // And it is invisible to the other resident.
    await signIn(priya);
    expect(await getResidentRequest(created.id)).toBeNull();
  });
});

describe("a resident with no active lease sees nothing scoped to a unit", () => {
  // The guard this covers is the subtlest in the codebase. lib/dal/documents.ts
  // builds an OR over scope/refId pairs; if the UNIT branch were included with
  // `refId: undefined` instead of omitted, Prisma would drop the condition and
  // the OR would match EVERY unit-scoped document in the system. A whole-table
  // leak produced by an undefined variable rather than by any visible mistake.

  it("returns no unit-scoped documents at all", async () => {
    await signIn(unhoused);

    const documents = await getResidentDocuments();
    const unitScopedCount = await db.document.count({ where: { scope: "UNIT" } });

    expect(unitScopedCount).toBeGreaterThan(0); // there is something to leak
    expect(documents).toHaveLength(0);
  });

  it("cannot fetch a specific unit-scoped document by id", async () => {
    const someUnitDocument = await db.document.findFirstOrThrow({
      where: { scope: "UNIT" },
      select: { id: true },
    });

    await signIn(unhoused);
    expect(await getResidentDocument(someUnitDocument.id)).toBeNull();
  });

  it("has no payments rather than everyone's payments", async () => {
    await signIn(unhoused);
    expect(await getResidentPayments()).toHaveLength(0);
  });
});
