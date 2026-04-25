/**
 * Warehouse types — Phase 1 seed (6 warehouses), ported from prototype data.js.
 *
 * Naming choices vs. the original Task 7 plan skeleton:
 *   - We preserve the prototype's schema (rateCard array, isPartner flag, etc.)
 *     rather than the plan's flat `pricing.perSqftPerMonth` / `type` scalars,
 *     because the prototype has no nested pricing object and no single "type"
 *     per warehouse — type is implicit in rateCard rows. Reshaping would lose
 *     fidelity when we port the rest in Phase 2.
 *   - `code` mirrors the prototype's `id` (e.g. "WH-9304"). `slug` is derived
 *     (lowercased) for URL use.
 *   - `reviewCount` is the camelCase of the prototype's `reviews` (count, not list).
 *   - Phase 1 home-page consumers can read code, emirate, area, primaryType,
 *     primarySqftPrice, rating, reviewCount, images[0] directly off the object.
 *
 * Fields intentionally OMITTED from this Phase 1 seed (deferred to Phase 2):
 *   - matchScore, viewers, lastEnquiry — listings/search-page concerns.
 *   - lockableUnits[]              — instant-storage detail page.
 *   - rateCard rows beyond what's needed to derive primarySqftPrice are
 *     preserved verbatim (we keep the full rateCard array so Phase 2
 *     pricing/filtering logic ports cleanly).
 *
 * Fields the plan skeleton listed but the prototype does NOT have
 * (so they are NOT on this type — flagged for Phase 2 data work):
 *   - totalAreaSqft, availableSqft, clearHeight, accessHours-as-structured.
 *     `accessHours` is a free-text string in the prototype; kept as-is.
 *   - `pricing.minPeriodMonths` — prototype's `min` is a min-size, not min-period.
 */

export type Emirate =
  | "Dubai"
  | "Abu Dhabi"
  | "Sharjah"
  | "Ajman"
  | "Umm Al Quwain"
  | "Ras Al Khaimah";

export type WarehouseTempZone = "AC" | "Non-AC" | "Chiller" | "Freezer" | "Open Yard" | "Medical";

export type WarehouseImage = {
  url: string;
  tag: string;
  zoneType: WarehouseTempZone;
};

export type RateCardRow = {
  cargo: "General Cargo" | "Food & Beverages" | "Medical";
  storageType: "Bulk" | "Rack" | "Open Yard";
  uom: "Sqft" | "CBM" | "Pallet";
  temp: "ac" | "non-ac" | "ambient" | "chilled" | "frozen" | "cold";
  price: number;
  min: number;
};

export type Warehouse = {
  /** Unique identifier from prototype, e.g. "WH-9304". Used as display code. */
  code: string;
  /** URL-safe lowercase form of `code`. */
  slug: string;
  emirate: Emirate;
  area: string;
  /** Primary temp zone for the warehouse card label (derived from images[0].zoneType). */
  primaryType: WarehouseTempZone;
  accessHours: string;
  facilities: string[];
  images: WarehouseImage[];
  rateCard: RateCardRow[];
  /** Lowest Sqft rate across rateCard rows; null if no Sqft rate. */
  primarySqftPrice: number | null;
  rating: number;
  reviewCount: number;
  /** Cargoz-managed partner warehouse (drives "Featured" badge on home page). */
  isFeatured: boolean;
  /** Has fixed-area or lockable-unit instant inventory available. */
  isInstantMoveIn: boolean;
};

// Image asset bank (mirrors prototype IMG constant).
const IMG = {
  ac1: "https://www.figma.com/api/mcp/asset/b09ae923-6c0d-4487-8bfd-7f42af9ffe9a",
  ac2: "https://www.figma.com/api/mcp/asset/5ac0efdf-3838-4169-aba0-3a17e43a517e",
  nonac1: "https://www.figma.com/api/mcp/asset/c0749295-ec5b-4b14-b80d-cfd72c8a2e2a",
  yard1: "https://www.figma.com/api/mcp/asset/5d7dab56-f8c8-4907-a8fe-048ec611b915",
  chiller1: "https://www.figma.com/api/mcp/asset/bfba80e7-2f22-4b29-9933-e3de65cc10cc",
} as const;

export const WAREHOUSES: Warehouse[] = [
  {
    code: "WH-9304",
    slug: "wh-9304",
    emirate: "Dubai",
    area: "JAFZA",
    primaryType: "Non-AC",
    accessHours: "24/7",
    facilities: [
      "Loading dock",
      "Truck parking",
      "Washrooms",
      "CCTV",
      "Fire alarm",
      "Forklift",
      "Pallet jack",
    ],
    images: [
      { url: IMG.nonac1, tag: "WAREHOUSE INTERIOR", zoneType: "Non-AC" },
      { url: IMG.ac1, tag: "LOADING BAY", zoneType: "AC" },
      { url: IMG.yard1, tag: "YARD", zoneType: "Open Yard" },
    ],
    rateCard: [
      {
        cargo: "General Cargo",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "non-ac",
        price: 9.6,
        min: 50,
      },
    ],
    primarySqftPrice: 9.6,
    rating: 5.0,
    reviewCount: 231,
    isFeatured: true,
    isInstantMoveIn: true,
  },
  {
    code: "WH-9305",
    slug: "wh-9305",
    emirate: "Dubai",
    area: "Dubai Investment Park",
    primaryType: "AC",
    accessHours: "24/7",
    facilities: [
      "Loading dock",
      "Truck parking",
      "Washrooms",
      "CCTV",
      "Fire alarm",
      "Forklift",
      "Temperature monitoring",
    ],
    images: [
      { url: IMG.ac1, tag: "AC INTERIOR", zoneType: "AC" },
      { url: IMG.ac2, tag: "RACKING", zoneType: "AC" },
    ],
    rateCard: [
      {
        cargo: "General Cargo",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "ac",
        price: 12.0,
        min: 50,
      },
      {
        cargo: "Food & Beverages",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "ac",
        price: 14.0,
        min: 50,
      },
      {
        cargo: "General Cargo",
        storageType: "Bulk",
        uom: "CBM",
        temp: "ambient",
        price: 55.0,
        min: 5,
      },
    ],
    primarySqftPrice: 12.0,
    rating: 4.9,
    reviewCount: 188,
    isFeatured: true,
    isInstantMoveIn: true,
  },
  {
    code: "WH-9307",
    slug: "wh-9307",
    emirate: "Dubai",
    area: "DAFZA",
    primaryType: "Chiller",
    accessHours: "24/7",
    facilities: [
      "Loading dock",
      "Truck parking",
      "Washrooms",
      "CCTV",
      "Fire alarm",
      "Cold chain monitoring",
      "Forklift",
    ],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      {
        cargo: "Food & Beverages",
        storageType: "Bulk",
        uom: "CBM",
        temp: "chilled",
        price: 65.0,
        min: 5,
      },
      {
        cargo: "Food & Beverages",
        storageType: "Rack",
        uom: "Pallet",
        temp: "chilled",
        price: 90.0,
        min: 5,
      },
    ],
    primarySqftPrice: null,
    rating: 4.7,
    reviewCount: 142,
    isFeatured: false,
    isInstantMoveIn: false,
  },
  {
    code: "WH-9310",
    slug: "wh-9310",
    emirate: "Abu Dhabi",
    area: "KIZAD",
    primaryType: "AC",
    accessHours: "24/7",
    facilities: [
      "Loading dock",
      "Truck parking",
      "Washrooms",
      "CCTV",
      "Fire alarm",
      "Forklift",
      "Pallet jack",
      "24/7 access",
    ],
    images: [
      { url: IMG.ac1, tag: "AC HALL", zoneType: "AC" },
      { url: IMG.ac2, tag: "MEZZANINE", zoneType: "AC" },
    ],
    rateCard: [
      {
        cargo: "General Cargo",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "ac",
        price: 11.8,
        min: 50,
      },
      {
        cargo: "Food & Beverages",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "ac",
        price: 13.4,
        min: 50,
      },
    ],
    primarySqftPrice: 11.8,
    rating: 4.9,
    reviewCount: 207,
    isFeatured: true,
    isInstantMoveIn: true,
  },
  {
    code: "WH-9313",
    slug: "wh-9313",
    emirate: "Sharjah",
    area: "SAIF Zone",
    primaryType: "Non-AC",
    accessHours: "24/7",
    facilities: [
      "Loading dock",
      "Truck parking",
      "Washrooms",
      "CCTV",
      "Fire alarm",
      "Forklift",
      "Pallet jack",
      "Loading bay",
    ],
    images: [
      { url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" },
      { url: IMG.ac1, tag: "AC ROOM", zoneType: "AC" },
    ],
    rateCard: [
      {
        cargo: "General Cargo",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "non-ac",
        price: 7.9,
        min: 50,
      },
      {
        cargo: "General Cargo",
        storageType: "Rack",
        uom: "Pallet",
        temp: "non-ac",
        price: 30.0,
        min: 5,
      },
      {
        cargo: "Food & Beverages",
        storageType: "Bulk",
        uom: "Sqft",
        temp: "ac",
        price: 12.8,
        min: 50,
      },
    ],
    primarySqftPrice: 7.9,
    rating: 4.8,
    reviewCount: 264,
    isFeatured: true,
    isInstantMoveIn: true,
  },
  {
    code: "WH-9319",
    slug: "wh-9319",
    emirate: "Ajman",
    area: "Ajman Industrial",
    primaryType: "Open Yard",
    accessHours: "Mon–Sat 7am–6pm",
    facilities: ["Truck parking", "CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      {
        cargo: "General Cargo",
        storageType: "Open Yard",
        uom: "Sqft",
        temp: "ambient",
        price: 5.0,
        min: 100,
      },
    ],
    primarySqftPrice: 5.0,
    rating: 4.3,
    reviewCount: 28,
    isFeatured: false,
    isInstantMoveIn: false,
  },
];
