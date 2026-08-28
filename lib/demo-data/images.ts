/**
 * Image paths for the seed.
 *
 * ## Why this is a stub
 *
 * The plan has the seed reading a manifest emitted by `scripts/prep-images.ts`
 * — the sharp pipeline that resizes the moodboard frames and writes an AVIF /
 * WebP / JPEG set with dimensions and blur placeholders. That script is Phase 0
 * work which has been deferred to a later session, so the manifest does not
 * exist yet.
 *
 * The alternatives were to block the seed on it, or to silently seed rows with
 * empty image fields and discover the gap when the first `<Image>` renders a
 * broken frame. Neither is good. So this module publishes the manifest's future
 * shape with hardcoded paths: the seed can be written and tested now, and when
 * `prep-images.ts` lands it replaces the body of this file without touching a
 * single call site.
 *
 * The paths deliberately point at files that do not exist yet. That is honest —
 * a missing image is visible immediately, whereas an empty string renders as
 * nothing and looks like a layout bug.
 */

export type ImageRef = {
  /** Path under /public, without extension — the responsive set shares a stem. */
  src: string;
  alt: string;
};

export const COMMUNITY_IMAGES: Record<string, ImageRef> = {
  "brookline-court": {
    src: "/img/communities/brookline-court",
    alt: "Brookline Court's brick facade at golden hour, seen across the courtyard",
  },
  "arbor-row": {
    src: "/img/communities/arbor-row",
    alt: "The planted courtyard at Arbor Row at dusk, lit from the ground floor",
  },
  "the-mercer": {
    src: "/img/communities/the-mercer",
    alt: "The Mercer's corner elevation, balconies stepping back above the street",
  },
};

export const MODEL_IMAGES: Record<string, ImageRef[]> = {
  "the-halsted": [
    { src: "/img/models/halsted-living", alt: "Living room with oak floors and a south-facing window" },
    { src: "/img/models/halsted-kitchen", alt: "Galley kitchen with pale stone counters" },
  ],
  "the-parkline": [
    { src: "/img/models/parkline-living", alt: "Open-plan living and dining with a balcony door" },
    { src: "/img/models/parkline-bath", alt: "Bathroom with matte tile and a wide mirror" },
  ],
  "the-clayton": [
    { src: "/img/models/clayton-living", alt: "Corner living room with windows on two walls" },
    { src: "/img/models/clayton-kitchen", alt: "Kitchen island seen from the dining side" },
  ],
  "the-westbrook": [
    { src: "/img/models/westbrook-living", alt: "Double-height living room with a mezzanine above" },
    { src: "/img/models/westbrook-kitchen", alt: "Kitchen with full-height cabinetry in warm oak" },
  ],
};
