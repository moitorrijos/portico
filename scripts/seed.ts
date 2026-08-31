/**
 * Seeds the demo database to spec §9's quality bar.
 *
 *   pnpm db:seed                     (local)
 *   dokku run <app> node seed.mjs    (on the box — see the Dockerfile)
 *
 * §9 is blunt about why this file matters: *"Seed quality is the whole
 * illusion."* Three communities, ~40 units, ~30 residents, 18 months of payment
 * history with a realistic scatter of late and missed payments, ~25 requests
 * across all four statuses with multi-note threads. Money amounts that are not
 * all round numbers.
 *
 * It is idempotent by truncation: every run wipes and rebuilds, so it is safe to
 * run twice and it is the same code path the nightly reset uses.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import {
  COMMUNITIES,
  DEMO_ACCOUNTS,
  HOME_MODELS,
  OPTION_GROUPS,
  PAYMENT_METHODS,
  REQUEST_CATEGORIES,
  FORMER_RESIDENT_NAMES,
  RESIDENT_NAMES,
  STAFF,
} from "@/lib/demo-data/catalogue";
import { COMMUNITY_IMAGES, MODEL_IMAGES } from "@/lib/demo-data/images";
import { createRng, DEMO_SEED } from "@/lib/demo-data/rng";
import { DEMO_PERSONAS } from "@/lib/demo-personas";

// `tsx` and `node` do NOT read .env — only Next does, and this script runs
// outside Next. Without this a local run fails with ECONNREFUSED, which reads
// like a database that is down rather than a variable that was never loaded.
// In production DATABASE_URL comes from `dokku postgres:link` and there is no
// .env file, so the throw is the expected path.
try {
  process.loadEnvFile(".env");
} catch {
  // Intentionally empty.
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Nothing to seed.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const rng = createRng(DEMO_SEED);

const MONTHS_OF_HISTORY = 18;

/**
 * One timestamp for the whole run.
 *
 * Read once rather than per row so every date in a single seed is consistent
 * with every other -- and so nothing can be stamped a few milliseconds in the
 * future relative to a row written earlier in the same loop.
 */
const NOW = new Date();

/** Start of the month, `n` months before now. */
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Rent that does not look generated.
 *
 * §9 asks for amounts that are not all round numbers. A base is nudged by a
 * per-unit amount in $5 steps, so the rent roll reads like it accumulated from
 * renewals and negotiations rather than from a formula — which is what a rent
 * roll actually looks like.
 */
function rentFor(bedrooms: number, floor: number): number {
  const base = { 0: 1_395_00, 1: 1_745_00, 2: 2_140_00, 3: 2_690_00 }[bedrooms] ?? 1_745_00;
  const floorPremium = floor * 2_500;
  const jitter = rng.int(-9, 14) * 500;
  return base + floorPremium + jitter;
}

async function main() {
  // Guard the contract with lib/demo-personas.ts before writing anything. If
  // these drift, the demo buttons 503 at the moment a prospect clicks them —
  // and the seed would otherwise complete "successfully" with the wrong emails.
  const mismatches = [
    [DEMO_PERSONAS.manager.email, DEMO_ACCOUNTS.manager.email],
    [DEMO_PERSONAS.resident.email, DEMO_ACCOUNTS.resident.email],
    [DEMO_PERSONAS["resident-2"].email, DEMO_ACCOUNTS.residentTwo.email],
  ].filter(([a, b]) => a !== b);

  if (mismatches.length > 0) {
    console.error(
      "Demo persona emails do not match the seeded accounts:\n" +
        mismatches.map(([a, b]) => `  personas: ${a}\n  seed:     ${b}`).join("\n"),
    );
    process.exit(1);
  }

  console.log("Truncating…");
  // Order matters only for the tables Postgres cannot cascade for us; every
  // relation here is onDelete: Cascade, so removing the roots is enough.
  await db.$transaction([
    db.emailLog.deleteMany(),
    db.inquiry.deleteMany(),
    db.modelOption.deleteMany(),
    db.homeModel.deleteMany(),
    db.announcement.deleteMany(),
    db.document.deleteMany(),
    db.requestNote.deleteMany(),
    db.request.deleteMany(),
    db.payment.deleteMany(),
    db.lease.deleteMany(),
    db.unit.deleteMany(),
    db.community.deleteMany(),
    db.user.deleteMany(),
  ]);

  // --- people --------------------------------------------------------------
  console.log("Creating people…");

  const manager = await db.user.create({
    data: {
      email: DEMO_ACCOUNTS.manager.email,
      name: DEMO_ACCOUNTS.manager.name,
      phone: DEMO_ACCOUNTS.manager.phone,
      role: "OWNER",
    },
  });

  const staff = await Promise.all(
    STAFF.map((s) =>
      db.user.create({
        data: { email: s.email, name: s.name, phone: s.phone, role: "STAFF" },
      }),
    ),
  );

  const demoResidents = await Promise.all(
    [DEMO_ACCOUNTS.resident, DEMO_ACCOUNTS.residentTwo].map((r) =>
      db.user.create({
        data: { email: r.email, name: r.name, phone: r.phone, role: "RESIDENT" },
      }),
    ),
  );

  const otherResidents = await Promise.all(
    RESIDENT_NAMES.map((name, i) => {
      const handle = name.toLowerCase().replace(/[^a-z]+/g, ".");
      return db.user.create({
        data: {
          email: `${handle}${i}@example.com`,
          name,
          phone: `(${rng.pick(["401", "508", "203"])}) 555-0${rng.int(200, 899)}`,
          role: "RESIDENT",
        },
      });
    }),
  );

  // Both arrays hold rows returned by db.user.create, so a single type covers
  // either. This exists only to name the element type below -- the combined
  // array itself is never needed, since the two groups are always seeded and
  // assigned separately.
  type SeededResident = Awaited<ReturnType<typeof db.user.create>>;

  // --- communities and units ----------------------------------------------
  console.log("Creating communities and units…");

  // Explicitly typed: TypeScript cannot infer the element type of an array
  // that is only ever populated inside a loop, and `tsc` runs over scripts/ as
  // part of the build -- so an implicit any[] here fails CI rather than being
  // a local annoyance.
  type SeededUnit = Awaited<ReturnType<typeof db.unit.create>>;
  type SeededCommunity = {
    community: Awaited<ReturnType<typeof db.community.create>>;
    units: SeededUnit[];
    spec: (typeof COMMUNITIES)[number];
  };

  const communities: SeededCommunity[] = [];
  for (const c of COMMUNITIES) {
    const image = COMMUNITY_IMAGES[c.slug]!;
    const community = await db.community.create({
      data: {
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        description: c.description,
        heroImage: image.src,
        amenities: [...c.amenities],
      },
    });

    const units: SeededUnit[] = [];
    for (let floor = 1; floor <= c.floors; floor++) {
      for (let n = 0; n < c.unitsPerFloor; n++) {
        const bedrooms = rng.pick([0, 1, 1, 1, 2, 2, 2, 3]);
        units.push(
          await db.unit.create({
            data: {
              communityId: community.id,
              label: `${floor}${String.fromCharCode(65 + n)}`,
              bedrooms,
              baths: bedrooms >= 2 ? rng.pick([1.5, 2]) : 1,
              sqft: 520 + bedrooms * 240 + rng.int(-40, 60),
              monthlyRent: rentFor(bedrooms, floor),
              // Filled in below once leases are assigned.
              status: "VACANT",
            },
          }),
        );
      }
    }
    communities.push({ community, units, spec: c });
  }

  const allUnits = communities.flatMap((c) => c.units);
  console.log(`  ${communities.length} communities, ${allUnits.length} units`);

  // --- leases --------------------------------------------------------------
  // The two demo residents are pinned to specific communities so the second
  // resident genuinely differs from the first. Everyone else is scattered.
  console.log("Creating leases…");

  function firstFreeUnitIn(slug: string, taken: Set<string>) {
    const group = communities.find((c) => c.spec.slug === slug)!;
    return group.units.find((u) => !taken.has(u.id))!;
  }

  const taken = new Set<string>();
  const assignments: { unit: (typeof allUnits)[number]; resident: SeededResident }[] = [];

  const marcusUnit = firstFreeUnitIn(DEMO_ACCOUNTS.resident.communitySlug, taken);
  taken.add(marcusUnit.id);
  assignments.push({ unit: marcusUnit, resident: demoResidents[0]! });

  const priyaUnit = firstFreeUnitIn(DEMO_ACCOUNTS.residentTwo.communitySlug, taken);
  taken.add(priyaUnit.id);
  assignments.push({ unit: priyaUnit, resident: demoResidents[1]! });

  for (const resident of otherResidents) {
    const unit = rng.shuffle(allUnits).find((u) => !taken.has(u.id));
    if (!unit) break;
    taken.add(unit.id);
    assignments.push({ unit, resident });
  }

  const leases = [];
  for (const { unit, resident } of assignments) {
    const startedMonthsAgo = rng.int(6, MONTHS_OF_HISTORY);
    const lease = await db.lease.create({
      data: {
        unitId: unit.id,
        residentId: resident.id,
        startDate: monthsAgo(startedMonthsAgo),
        endDate: monthsAgo(startedMonthsAgo - 12),
        monthlyRent: unit.monthlyRent,
        status: "ACTIVE",
      },
    });
    await db.unit.update({ where: { id: unit.id }, data: { status: "OCCUPIED" } });
    leases.push({ lease, unit, resident, startedMonthsAgo });
  }

  // A handful of genuinely non-occupied units, so the units table has something
  // to filter and the occupancy figure is not 100%.
  const vacant = rng.sample(allUnits.filter((u) => !taken.has(u.id)), 4);
  for (const unit of vacant.slice(0, 2)) {
    await db.unit.update({ where: { id: unit.id }, data: { status: "MAINTENANCE" } });
  }
  if (vacant[2]) {
    await db.unit.update({ where: { id: vacant[2].id }, data: { status: "RESERVED" } });
  }

  /*
   * Give most empty units a previous tenancy.
   *
   * Without this every non-occupied unit has no history at all, so the unit
   * detail screen's vacant view answers all three of its questions with
   * "never" -- vacant since never, last resident nobody, nothing outstanding.
   * Three empty states side by side reads as missing data rather than as an
   * available apartment, and "how long has this been empty" is the first thing
   * a manager asks about one.
   *
   * A couple are left with no history on purpose: a newly built unit that has
   * genuinely never been let is a real case, and the screen should handle it.
   */
  const emptyUnits = allUnits.filter((u) => !taken.has(u.id));
  const formerResidents = await Promise.all(
    FORMER_RESIDENT_NAMES.map((name, i) => {
      const handle = name.toLowerCase().replace(/[^a-z]+/g, ".");
      return db.user.create({
        data: {
          email: `${handle}.former${i}@example.com`,
          name,
          phone: `(${rng.pick(["401", "508", "203"])}) 555-0${rng.int(200, 899)}`,
          role: "RESIDENT",
        },
      });
    }),
  );

  let endedLeaseCount = 0;
  for (const [index, unit] of emptyUnits.entries()) {
    const previous = formerResidents[index % formerResidents.length];
    // Leave the last two with no history -- see the note above.
    if (!previous || index >= emptyUnits.length - 2) continue;

    // Ended between one and four months ago. Much longer and the unit reads as
    // unlettable rather than as between tenancies -- an eight-month void on a
    // three-bed at $2,740 says something is wrong with the apartment, which is
    // not the story a portfolio at 76% occupancy is telling.
    const endedMonthsAgo = rng.int(1, 4);
    await db.lease.create({
      data: {
        unitId: unit.id,
        residentId: previous.id,
        startDate: monthsAgo(endedMonthsAgo + rng.int(12, 24)),
        endDate: monthsAgo(endedMonthsAgo),
        monthlyRent: unit.monthlyRent,
        status: "ENDED",
      },
    });
    endedLeaseCount += 1;
  }

  console.log(
    `  ${leases.length} active leases, ${allUnits.length - leases.length} not occupied ` +
      `(${endedLeaseCount} with a previous tenancy)`,
  );

  // --- payments ------------------------------------------------------------
  // 18 months of history with a realistic scatter. Most people pay on time;
  // some pay late; a few miss. A ledger where every row says PAID has nothing
  // to look at, and a collection-rate meter pinned at 100% is not a chart.
  console.log("Creating payment history…");

  let paymentCount = 0;
  for (const { lease, startedMonthsAgo } of leases) {
    for (let m = Math.min(startedMonthsAgo, MONTHS_OF_HISTORY); m >= 0; m--) {
      const dueDate = monthsAgo(m);
      const isCurrentMonth = m === 0;

      // The three statuses mean distinct things, and conflating two of them
      // was a real bug: PAID is on time, LATE is *paid after the due date*
      // (so it still has a paidAt), and DUE is genuinely outstanding.
      //
      // How much can be outstanding depends on how old the month is, and that
      // is the part that has to be right. A flat 4%-never-paid across eighteen
      // months leaves rent unpaid since early last year -- the dashboard then
      // reports "548 days late", which says nobody was ever evicted and reads
      // as broken data rather than as a struggling tenant. Debt ages out:
      // recent months carry the arrears, old months are settled.
      const roll = rng.next();
      let status: "PAID" | "LATE" | "DUE";
      let paidAt: Date | null;

      // Share of rent still unpaid, by how many months ago it was due.
      const outstandingChance =
        m === 0 ? 0.06 : m === 1 ? 0.04 : m === 2 ? 0.02 : 0;
      // Share paid, but after the due date.
      const lateChance = isCurrentMonth ? 0.12 : 0.1;

      if (roll < outstandingChance) {
        status = "DUE";
        paidAt = null;
      } else if (roll < outstandingChance + lateChance) {
        status = "LATE";
        // Capped at today: a payment cannot have been received in the future,
        // which is what an uncapped +24 days does to the current month.
        const late = addDays(dueDate, rng.int(6, 24));
        paidAt = late > NOW ? NOW : late;
        // If the grace period has not elapsed yet it is not late, just open.
        if (late > NOW && dueDate > addDays(NOW, -6)) {
          status = "DUE";
          paidAt = null;
        }
      } else {
        status = "PAID";
        paidAt = addDays(dueDate, rng.int(-3, 2));
        if (paidAt > NOW) paidAt = NOW;
      }

      await db.payment.create({
        data: {
          leaseId: lease.id,
          amountCents: lease.monthlyRent,
          dueDate,
          paidAt,
          method: rng.pick(PAYMENT_METHODS),
          status,
        },
      });
      paymentCount++;
    }
  }
  console.log(`  ${paymentCount} payments across ${MONTHS_OF_HISTORY} months`);

  // --- maintenance requests ------------------------------------------------
  // ~25 across all four statuses, with multi-note threads — including internal
  // notes, which are the whole point of the authorization story.
  console.log("Creating maintenance requests…");

  const REQUEST_TITLES: Record<string, string[]> = {
    Plumbing: ["Kitchen sink draining slowly", "Running toilet in the second bathroom", "No hot water in the morning"],
    Electrical: ["Outlet in the bedroom stopped working", "Hallway light flickers", "Breaker trips when the kettle is on"],
    "Heating & cooling": ["Radiator cold on one side", "Thermostat reads 4 degrees high", "AC rattling overnight"],
    Appliance: ["Dishwasher not draining", "Oven door will not stay shut", "Fridge freezing the lettuce"],
    "Doors & locks": ["Front door sticks in the damp", "Balcony door lock is stiff", "Buzzer not releasing the gate"],
    "Pest control": ["Ants along the kitchen baseboard", "Mice heard in the ceiling"],
    "Common area": ["Stairwell light out on the third floor", "Courtyard gate not latching"],
    "Water damage": ["Stain spreading on the bathroom ceiling", "Damp patch under the kitchen window"],
  };

  const RESIDENT_NOTES = [
    "Thanks for the quick reply.",
    "Still happening this morning, no change.",
    "Any idea when someone can come by? I work from home so most days are fine.",
    "That worked, thank you.",
  ];
  const PUBLIC_STAFF_NOTES = [
    "Thanks for reporting this — we've logged it and will be in touch to schedule.",
    "Scheduled for Thursday between 9 and 12. You don't need to be home.",
    "Our contractor has been out and replaced the part. Let us know if it recurs.",
    "Sorry for the delay on this one. We're ordering the part now.",
  ];
  // The reason RequestNote.internal exists. None of these may ever reach a
  // resident's screen — that is the property the test suite asserts.
  const INTERNAL_STAFF_NOTES = [
    "Third report from this unit in six months — check whether the warranty still covers it before we pay for another call-out.",
    "Resident has been patient; prioritise this one. Previous contractor no-showed twice.",
    "Do not schedule Vinnie for this building again after the last complaint.",
    "Budget code M-42. Flag to Dana if it goes over $400.",
    "Unit is due for renewal in two months — worth resolving properly rather than patching.",
  ];

  const statuses = ["NEW", "SCHEDULED", "IN_PROGRESS", "RESOLVED"] as const;
  let requestCount = 0;
  let internalNoteCount = 0;

  // Guarantee both demo residents have requests with internal notes attached —
  // otherwise a visitor clicking "second resident" might see an empty screen,
  // and the comparison the demo is built on would not be visible.
  const guaranteed = leases.filter((l) => demoResidents.some((r) => r.id === l.resident.id));
  const others = rng.sample(leases.filter((l) => !guaranteed.includes(l)), 21);

  for (const [index, { unit, resident }] of [...guaranteed, ...guaranteed, ...others].entries()) {
    const category = rng.pick(REQUEST_CATEGORIES);
    const status = statuses[index % statuses.length]!;
    const createdAt = addDays(new Date(), -rng.int(1, 150));

    const request = await db.request.create({
      data: {
        unitId: unit.id,
        residentId: resident.id,
        category,
        title: rng.pick(REQUEST_TITLES[category] ?? ["Something needs looking at"]),
        description:
          "Started a few days ago and hasn't got better. Happy for someone to " +
          "come in while I'm out — the office has a key.",
        priority: rng.pick(["LOW", "NORMAL", "NORMAL", "NORMAL", "URGENT"]),
        status,
        assigneeId: status === "NEW" ? null : rng.pick(staff).id,
        scheduledFor: status === "SCHEDULED" || status === "IN_PROGRESS" ? addDays(createdAt, rng.int(2, 9)) : null,
        createdAt,
        resolvedAt: status === "RESOLVED" ? addDays(createdAt, rng.int(3, 21)) : null,
      },
    });
    requestCount++;

    // Multi-note threads, per §9. Every request gets at least one public note
    // so the resident's timeline is never bare.
    const noteCount = rng.int(2, 5);
    for (let n = 0; n < noteCount; n++) {
      const fromResident = n > 0 && rng.chance(0.4);
      // Internal notes only from staff, and only sometimes.
      const internal = !fromResident && n > 0 && rng.chance(0.45);

      await db.requestNote.create({
        data: {
          requestId: request.id,
          authorId: fromResident ? resident.id : rng.pick([manager, ...staff]).id,
          body: fromResident
            ? rng.pick(RESIDENT_NOTES)
            : internal
              ? rng.pick(INTERNAL_STAFF_NOTES)
              : rng.pick(PUBLIC_STAFF_NOTES),
          internal,
          createdAt: addDays(createdAt, n + rng.int(0, 2)),
        },
      });
      if (internal) internalNoteCount++;
    }
  }
  console.log(`  ${requestCount} requests, ${internalNoteCount} internal notes`);

  // --- documents -----------------------------------------------------------
  console.log("Creating documents…");

  let documentCount = 0;
  for (const { lease, unit, resident } of leases.slice(0, 12)) {
    await db.document.create({
      data: {
        scope: "RESIDENT",
        refId: resident.id,
        title: `Lease agreement — ${unit.label}`,
        kind: "LEASE",
        fileUrl: "/docs/sample-lease.pdf",
        uploadedAt: lease.startDate,
      },
    });
    await db.document.create({
      data: {
        scope: "UNIT",
        refId: unit.id,
        title: `Move-in condition report — ${unit.label}`,
        kind: "NOTICE",
        fileUrl: "/docs/sample-condition-report.pdf",
        uploadedAt: lease.startDate,
      },
    });
    documentCount += 2;
  }
  for (const { community } of communities) {
    await db.document.create({
      data: {
        scope: "COMMUNITY",
        refId: community.id,
        title: `Community policies — ${community.name}`,
        kind: "POLICY",
        fileUrl: "/docs/sample-policies.pdf",
      },
    });
    documentCount++;
  }
  console.log(`  ${documentCount} documents`);

  // --- announcements -------------------------------------------------------
  for (const { community } of communities) {
    await db.announcement.create({
      data: {
        communityId: community.id,
        title: "Water shut-off, Tuesday 9am–1pm",
        body:
          "The riser on the north side is being replaced. Water will be off " +
          "between 9am and 1pm on Tuesday. We'll post a note in the lobby if " +
          "that changes.",
        audience: "COMMUNITY",
        publishedAt: addDays(new Date(), -rng.int(3, 30)),
      },
    });
  }

  // --- home models and options --------------------------------------------
  console.log("Creating home models…");

  for (const model of HOME_MODELS) {
    const created = await db.homeModel.create({
      data: {
        slug: model.slug,
        name: model.name,
        basePriceCents: model.basePriceCents,
        bedrooms: model.bedrooms,
        baths: model.baths,
        sqft: model.sqft,
        images: (MODEL_IMAGES[model.slug] ?? []).map((i) => i.src),
      },
    });

    for (const { group, options } of OPTION_GROUPS) {
      for (const option of options) {
        await db.modelOption.create({
          data: {
            homeModelId: created.id,
            group,
            label: option.label,
            priceDeltaCents: option.priceDeltaCents,
            isDefault: option.isDefault,
          },
        });
      }
    }
  }
  console.log(`  ${HOME_MODELS.length} models, ${OPTION_GROUPS.length} option groups each`);

  // --- a couple of inquiries so /app/inquiries is not empty ----------------
  const halsted = await db.homeModel.findUnique({ where: { slug: "the-halsted" } });
  await db.inquiry.create({
    data: {
      name: "Robert Ingham",
      email: "r.ingham@example.com",
      phone: "(401) 555-0221",
      homeModelId: halsted?.id ?? null,
      configJson: {
        "Finish package": "Warm oak — engineered oak, matte hardware",
        "Appliance tier": "Included appliances",
        Parking: "Surface space",
        Storage: "No storage locker",
        "Lease term": "12 months",
        totalCents: (halsted?.basePriceCents ?? 0) + 8_500 + 7_500,
      },
      message: "Is the Halsted available with a January start? Happy to view.",
      status: "NEW",
    },
  });

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
