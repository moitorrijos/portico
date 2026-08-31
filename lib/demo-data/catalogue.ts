/**
 * The fixed, hand-written parts of the demo: communities, home models and their
 * option groups, and the three demo accounts.
 *
 * Everything here is invented. Spec §2 is strict that no real business's name,
 * branding or logo appears anywhere, and §9 asks for names that are *"boring,
 * plausible"* — a demo undermines itself the moment it reads as a joke or as a
 * real company someone might look up.
 *
 * `.example` is used for the company's own domain because it is reserved by
 * RFC 2606 and can never be registered by anyone. Resident addresses use
 * `example.com`, reserved by the same RFC. Nothing here can ever reach a real
 * inbox, which matters when the app writes to an EmailLog that a visitor reads.
 */

export const COMPANY = {
  name: "Pórtico Living",
  domain: "porticoliving.example",
} as const;

/** Spec §9: three communities. */
export const COMMUNITIES = [
  {
    slug: "brookline-court",
    name: "Brookline Court",
    city: "Providence",
    state: "RI",
    description:
      "Sixteen apartments around a planted courtyard, five minutes from the " +
      "Blackstone bike path. The building went up in 1994 and was renovated " +
      "floor by floor between 2019 and 2022.",
    amenities: ["Courtyard", "Bike storage", "Package room", "Laundry", "Parking"],
    /** Unit labels are floor + letter. Counts here MUST match the prose above:
     *  a description that says forty-two while the table shows sixteen is the
     *  kind of detail that quietly tells a visitor the data is fake. */
    floors: 4,
    unitsPerFloor: 4,
  },
  {
    slug: "arbor-row",
    name: "Arbor Row",
    city: "Worcester",
    state: "MA",
    description:
      "Fourteen townhouse-style homes on a quiet street off Pleasant. " +
      "Each has its own entrance, which residents consistently rate as the " +
      "reason they stay.",
    amenities: ["Private entrances", "Resident lounge", "Package room", "Parking"],
    floors: 2,
    unitsPerFloor: 7,
  },
  {
    slug: "the-mercer",
    name: "The Mercer",
    city: "New Haven",
    state: "CT",
    description:
      "A 1920s commercial building converted in 2016. High ceilings, original " +
      "steel windows, and a ground-floor cafe that is not run by us but might " +
      "as well be.",
    amenities: ["Fitness room", "Roof terrace", "Package room", "Elevator", "Laundry"],
    floors: 4,
    unitsPerFloor: 3,
  },
] as const;

/** Spec §9: four home models, five option groups each. */
export const HOME_MODELS = [
  {
    slug: "the-halsted",
    name: "The Halsted",
    basePriceCents: 1_845_00,
    bedrooms: 1,
    baths: 1,
    sqft: 712,
  },
  {
    slug: "the-parkline",
    name: "The Parkline",
    basePriceCents: 2_190_00,
    bedrooms: 2,
    baths: 1.5,
    sqft: 968,
  },
  {
    slug: "the-clayton",
    name: "The Clayton",
    basePriceCents: 2_675_00,
    bedrooms: 2,
    baths: 2,
    sqft: 1104,
  },
  {
    slug: "the-westbrook",
    name: "The Westbrook",
    basePriceCents: 3_240_00,
    bedrooms: 3,
    baths: 2,
    sqft: 1386,
  },
] as const;

/**
 * Five option groups, applied to every model.
 *
 * Exactly one option per group is the default, and the configurator picks one
 * per group — which is why `group` exists on ModelOption rather than the options
 * being a flat list. Deltas are monthly, in cents, and deliberately not round:
 * a configurator whose every option is +$50 looks like placeholder data.
 */
export const OPTION_GROUPS = [
  {
    group: "Finish package",
    options: [
      { label: "Standard — laminate, white cabinets", priceDeltaCents: 0, isDefault: true },
      { label: "Warm oak — engineered oak, matte hardware", priceDeltaCents: 8_500, isDefault: false },
      { label: "Stone — quartz counters, full-height tile", priceDeltaCents: 14_500, isDefault: false },
    ],
  },
  {
    group: "Appliance tier",
    options: [
      { label: "Included appliances", priceDeltaCents: 0, isDefault: true },
      { label: "Upgraded — induction range, quiet dishwasher", priceDeltaCents: 6_500, isDefault: false },
    ],
  },
  {
    group: "Parking",
    options: [
      { label: "No parking", priceDeltaCents: 0, isDefault: true },
      { label: "Surface space", priceDeltaCents: 7_500, isDefault: false },
      { label: "Covered space", priceDeltaCents: 12_000, isDefault: false },
    ],
  },
  {
    group: "Storage",
    options: [
      { label: "No storage locker", priceDeltaCents: 0, isDefault: true },
      { label: "Basement locker, 4×6", priceDeltaCents: 3_500, isDefault: false },
    ],
  },
  {
    group: "Lease term",
    options: [
      { label: "12 months", priceDeltaCents: 0, isDefault: true },
      { label: "18 months — reduced rate", priceDeltaCents: -4_500, isDefault: false },
      { label: "Month to month", priceDeltaCents: 22_500, isDefault: false },
    ],
  },
] as const;

/**
 * The three accounts a visitor can enter as, per spec §9.
 *
 * These emails are the contract with `lib/demo-personas.ts` — the demo entry
 * routes look users up by exactly these strings, so changing one here without
 * changing it there produces a 503 at the moment a prospect clicks the button.
 * The seed asserts they match before writing anything.
 *
 * The two residents are placed in DIFFERENT communities on purpose. The whole
 * point of the second resident is that a visitor can log in as each and see
 * that the data genuinely differs; two residents in the same building sharing
 * community-scoped documents would blunt the demonstration.
 */
export const DEMO_ACCOUNTS = {
  manager: {
    email: `dana.whitfield@${COMPANY.domain}`,
    name: "Dana Whitfield",
    phone: "(401) 555-0147",
    role: "OWNER",
  },
  resident: {
    email: "marcus.ellery@example.com",
    name: "Marcus Ellery",
    phone: "(401) 555-0192",
    role: "RESIDENT",
    communitySlug: "brookline-court",
  },
  residentTwo: {
    email: "priya.raghavan@example.com",
    name: "Priya Raghavan",
    phone: "(203) 555-0168",
    role: "RESIDENT",
    communitySlug: "the-mercer",
  },
} as const;

/** Staff who appear as request assignees and note authors. */
export const STAFF = [
  { email: `ray.okafor@${COMPANY.domain}`, name: "Ray Okafor", phone: "(401) 555-0113" },
  { email: `nina.castellanos@${COMPANY.domain}`, name: "Nina Castellanos", phone: "(508) 555-0176" },
  { email: `tom.bridger@${COMPANY.domain}`, name: "Tom Bridger", phone: "(203) 555-0134" },
] as const;

/** Resident names. Boring and plausible, per §9, and drawn from nowhere real. */
export const RESIDENT_NAMES = [
  "Alice Nkemdirim", "Brian Halloway", "Carmen Ruiz-Ortega", "Daniel Oyelaran",
  "Eleanor Whitcombe", "Farid Haddad", "Grace Lindqvist", "Hugo Marchetti",
  "Imani Boateng", "Jonas Petrauskas", "Karen Mbeki", "Liam Donnelly",
  "Maya Sundaram", "Nathan Priestley", "Olive Tanaka", "Patrick Osei",
  "Quentin Duval", "Rosa Villanueva", "Samuel Adeyemi", "Tessa Lindgren",
  "Umar Chaudhry", "Vera Kaminski", "Wesley Amankwah", "Ximena Cordero",
  "Yusuf Rahimi", "Zoe Fairbairn", "Adrian Kovacs", "Bianca Moreau",
  "Cormac Sheehan", "Delphine Aubry",
] as const;

/**
 * People who used to live here.
 *
 * Kept separate from RESIDENT_NAMES so a former tenant never also appears as a
 * current one -- the same person listed as both the occupant of 2C and the
 * previous occupant of 4B is the sort of detail that makes seeded data read as
 * generated.
 */
export const FORMER_RESIDENT_NAMES = [
  "Anneke Vos", "Desmond Achebe", "Freya Lindholm",
  "Ibrahim Toure", "Marta Kowalczyk", "Rufus Beaumont",
] as const;

export const REQUEST_CATEGORIES = [
  "Plumbing", "Electrical", "Heating & cooling", "Appliance",
  "Doors & locks", "Pest control", "Common area", "Water damage",
] as const;

export const PAYMENT_METHODS = ["ACH transfer", "Card", "Check"] as const;
