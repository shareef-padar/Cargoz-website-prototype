/* ============================================================
   Cargoz prototype — data + logic
   Seeded from PRD §7–§14. 20 warehouses, all 5 coupling rules.
   ============================================================ */

/* ----- Constants --------------------------------------------- */

const SIZE_LIMITS = {
  Sqft:   { min: 50, max: 5000 },
  CBM:    { min:  5, max: 1000 },
  Pallet: { min:  5, max: 1000 }
};

const PERIODS = ["1 Month","2 Months","3 Months","4 Months","5 Months","6 Months",
                 "7 Months","8 Months","9 Months","10 Months","11 Months","12 Months"];

const GOODS_INTENTS = [
  { id: "General Cargo",    cargo: ["General Cargo"] },
  { id: "Food & Beverages", cargo: ["Food & Beverages"] },
  { id: "Medical",          cargo: ["Medical"] }
];

const WAREHOUSE_TYPES = [
  "AC Warehouse","Non-AC Warehouse","Chiller Warehouse",
  "Freezer Warehouse","Open Yard","Medical Warehouse"
];

const IS_ELIGIBLE_TYPES = ["Non-AC Warehouse","AC Warehouse"];

const ITEMS_PER_PAGE = 10;

const LU_BANDS = [
  { id: "<100",     min: 0,   max: 99,   mid: 80   },
  { id: "100-150",  min: 100, max: 150,  mid: 125  },
  { id: "150-250",  min: 150, max: 250,  mid: 200  },
  { id: "250-500",  min: 250, max: 500,  mid: 375  },
  { id: "500-1000", min: 500, max: 1000, mid: 750  }
];

const SORT_OPTIONS = ["Recommended","Low to High","High to Low","Top Rated","Most Reviews"];

function defaultWhTypesForIntent(intent) {
  if (intent === "Medical") return ["AC Warehouse","Medical Warehouse"];
  if (intent === "Food & Beverages") return ["AC Warehouse","Chiller Warehouse","Freezer Warehouse"];
  return ["Non-AC Warehouse","AC Warehouse"]; // General Cargo
}

const CARGOZ_WHATSAPP = "971501234567";
const CARGOZ_SALES = "+97142345678";

/* ----- Lockable-unit helpers -------------------------------- */

function parseLURange(rangeId) {
  return LU_BANDS.find(b => b.id === rangeId) || LU_BANDS[1];
}

function getLUSizeFromRange(rangeId) {
  return parseLURange(rangeId).mid;
}

/* ----- Rate-card helpers ------------------------------------ */

function rateMatchesWhTypeList(row, selectedTypes) {
  if (!selectedTypes || selectedTypes.length === 0) return true;
  // Open Yard guard
  if (row.storageType === "Open Yard") {
    return selectedTypes.includes("Open Yard");
  }
  // Medical cargo guard
  if (selectedTypes.includes("Medical Warehouse") && row.cargo === "Medical") return true;
  if (selectedTypes.includes("Non-AC Warehouse") && row.temp === "non-ac") return true;
  if (selectedTypes.includes("AC Warehouse") && (row.temp === "ac" || row.temp === "ambient")) return true;
  if (selectedTypes.includes("Chiller Warehouse") && row.temp === "chilled") return true;
  if (selectedTypes.includes("Freezer Warehouse") && (row.temp === "frozen" || row.temp === "cold")) return true;
  return false;
}

function getValidUOMs(intent, allWarehouses) {
  const intentObj = GOODS_INTENTS.find(g => g.id === intent) || GOODS_INTENTS[0];
  const intentCargos = intentObj.cargo;
  const uoms = ["Sqft","CBM","Pallet"];
  return uoms.filter(uom =>
    allWarehouses.some(w =>
      w.rateCard.some(r => r.uom === uom && intentCargos.includes(r.cargo))
    )
  );
}

function getTempZones(w) {
  const zones = new Set();
  w.rateCard.forEach(r => {
    if (r.temp === "non-ac") zones.add("Non-AC");
    else if (r.temp === "ac" || r.temp === "ambient") zones.add("AC");
    else if (r.temp === "chilled") zones.add("Chiller");
    else if (r.temp === "frozen" || r.temp === "cold") zones.add("Freezer");
    else if (r.storageType === "Open Yard") zones.add("Open Yard");
  });
  if (w.rateCard.some(r => r.cargo === "Medical")) zones.add("Medical");
  return Array.from(zones);
}

function rateSig(row) {
  // Production 6-field signature (cargo|storageType|uom|temp|min|price)
  return `${row.cargo}|${row.storageType}|${row.uom}|${row.temp}|${row.min}|${row.price}`;
}

function findBestMatchIdx(rows) {
  if (!rows || rows.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].price < rows[bestIdx].price) bestIdx = i; // strict < → first occurrence wins on ties
  }
  return bestIdx;
}

function filterRateCard(w, ctx) {
  const intent = GOODS_INTENTS.find(g => g.id === ctx.goodsIntent) || GOODS_INTENTS[0];
  return w.rateCard.filter(r =>
    r.uom === ctx.sizeUnit &&
    intent.cargo.includes(r.cargo) &&
    rateMatchesWhTypeList(r, ctx.warehouseTypeFilters)
  );
}

function getUOMPrice(w, ctx) {
  const matched = filterRateCard(w, ctx);
  if (matched.length === 0) return Infinity;
  return matched[findBestMatchIdx(matched)].price;
}

/* ----- Instant Storage eligibility -------------------------- */

function isInstantEligible(w, ctx) {
  return Boolean(
    w.isPartner &&
    (w.instantAvailability.fixedArea > 0 || w.instantAvailability.lockableUnit > 0) &&
    ctx.sizeUnit === "Sqft" &&
    ctx.sizeInput <= 1000 &&
    (ctx.goodsIntent === "General Cargo" || ctx.goodsIntent === "Food & Beverages") &&
    !(ctx.warehouseTypeFilters || []).includes("Open Yard") &&
    // warehouse must offer AC or Non-AC zone
    getTempZones(w).some(z => z === "Non-AC" || z === "AC")
  );
}

/* ----- Coupling-violation detector (5 rules) ---------------- */

function detectCouplingViolation(ctx) {
  const types = ctx.warehouseTypeFilters || [];
  const intent = ctx.goodsIntent;
  const unit = ctx.sizeUnit;
  const isCold = types.includes("Chiller Warehouse") || types.includes("Freezer Warehouse")
    || intent === "Food & Beverages" && types.length === 0;
  const hasOpenYard = types.includes("Open Yard");
  const hasBulkOnly = types.length > 0 && !hasOpenYard
    && types.every(t => ["AC Warehouse","Non-AC Warehouse","Medical Warehouse"].includes(t));
  const hasRack = types.includes("AC Warehouse") && intent === "Medical"; // proxy

  // Rule 1 — chilled/frozen + Open Yard (no switchTo)
  if (isCold && hasOpenYard) return { rule: 1, switchTo: null };

  // Rule 2 — chilled/frozen and not CBM
  if ((types.includes("Chiller Warehouse") || types.includes("Freezer Warehouse")) && unit !== "CBM") {
    return { rule: 2, switchTo: "CBM" };
  }

  // Rule 3 — Open Yard and not Sqft
  if (hasOpenYard && unit !== "Sqft") return { rule: 3, switchTo: "Sqft" };

  // Rule 4 — Bulk (AC/Non-AC) and not Sqft
  if (hasBulkOnly && unit !== "Sqft" && unit !== "Pallet") {
    return { rule: 4, switchTo: "Sqft" };
  }

  // Rule 5 — Rack (encoded as Pallet UOM with bulk types) and Sqft mismatch
  // Trigger: user has Pallet selected against types that don't price by pallet — already handled by 4.
  // Specific rule 5 — Medical intent forces ambient pricing in Sqft
  if (intent === "Medical" && unit === "CBM") return { rule: 5, switchTo: "Sqft" };

  return null;
}

const COUPLING_COPY = {
  1: { headline: "Chilled and frozen cargo needs an enclosed space",
       body: "Open yards lose the temperature within minutes, so no warehouse here pairs the two. If you'd like, we can hand-pick alternatives for you." },
  2: { headline: "Chilled and frozen storage is priced by volume",
       body: u => `Warehouses price cold-chain space in cubic metres (CBM) rather than ${u}. Switch to CBM to see what's available.` },
  3: { headline: "Open yards are priced by area",
       body: u => `Yard space is always rented by the square foot, not by ${u}. Switch to sqft to see open-yard options.` },
  4: { headline: "Bulk space is priced by area",
       body: u => `Bulk storage is rented by the square foot, not by ${u}. Switch to sqft to see matching warehouses.` },
  5: { headline: "Rack space is priced by volume or pallet",
       body: u => `Racked storage is rented by the cubic metre or by pallet position, not by area. Switch to CBM or pallet to continue.` }
};

/* ----- Main filter pipeline --------------------------------- */

function matchesFilters(w, ctx) {
  // Stage 1 — Location
  if (ctx.emirate && ctx.emirate !== "Any" && w.emirate !== ctx.emirate) return false;
  if (ctx.area && w.area !== ctx.area) return false;

  // Stage 2 — joint cargo × UOM × WH-type
  const intent = GOODS_INTENTS.find(g => g.id === ctx.goodsIntent) || GOODS_INTENTS[0];
  const ok = w.rateCard.some(r =>
    r.uom === ctx.sizeUnit &&
    intent.cargo.includes(r.cargo) &&
    rateMatchesWhTypeList(r, ctx.warehouseTypeFilters)
  );
  if (!ok) return false;

  // Stage 3 — IS availability (only if FA/LU flags on — listings page leaves both false)
  if (ctx.isFixedAreaChecked) {
    if (!isInstantEligible(w, ctx)) return false;
    if (w.instantAvailability.fixedArea < (ctx.faSizeInput || 100)) return false;
  }
  if (ctx.isLockableChecked) {
    if (!isInstantEligible(w, ctx)) return false;
    const band = parseLURange(ctx.lockableRange || "100-150");
    const hasUnitInBand = (w.lockableUnits || []).some(u => u.size >= band.min && u.size <= band.max);
    if (!hasUnitInBand) return false;
  }
  return true;
}

/* ----- Sorting + IS boost ----------------------------------- */

function sortListings(list, ctx, option) {
  const cmp = {
    "Recommended":  (a,b) => b.matchScore - a.matchScore,
    "Low to High":  (a,b) => getUOMPrice(a, ctx) - getUOMPrice(b, ctx),
    "High to Low":  (a,b) => getUOMPrice(b, ctx) - getUOMPrice(a, ctx),
    "Top Rated":    (a,b) => b.rating - a.rating,
    "Most Reviews": (a,b) => b.reviews - a.reviews
  }[option] || ((a,b) => b.matchScore - a.matchScore);

  // IS-boost partition
  const eligible = list.filter(w => isInstantEligible(w, ctx)).sort(cmp);
  const rest     = list.filter(w => !isInstantEligible(w, ctx)).sort(cmp);
  return [...eligible, ...rest];
}

/* ----- Rescue helpers --------------------------------------- */

function altUomCounts(ctx, all) {
  const others = ["Sqft","CBM","Pallet"].filter(u => u !== ctx.sizeUnit);
  const out = {};
  others.forEach(u => {
    const swapped = { ...ctx, sizeUnit: u };
    const hits = all.filter(w => matchesFilters(w, swapped)).length;
    if (hits > 0) out[u] = hits;
  });
  return Object.keys(out).length ? out : null;
}

function nearbyListings(ctx, all) {
  if (!ctx.emirate || ctx.emirate === "Any") return null;
  const cleared = { ...ctx, emirate: "Any", area: "" };
  const matches = all.filter(w => matchesFilters(w, cleared) && w.emirate !== ctx.emirate);
  return matches.length > 0 ? matches.slice(0, 6) : null;
}

function partialUomCoverage(ctx, all) {
  // For each selected type with 0 hits in current UOM but >0 in another
  const buckets = [];
  const types = ctx.warehouseTypeFilters || [];
  types.forEach(t => {
    const single = { ...ctx, warehouseTypeFilters: [t] };
    const hits = all.filter(w => matchesFilters(w, single)).length;
    if (hits === 0) {
      for (const altUom of ["Sqft","CBM","Pallet"].filter(u => u !== ctx.sizeUnit)) {
        const altHits = all.filter(w => matchesFilters(w, { ...single, sizeUnit: altUom })).length;
        if (altHits > 0) { buckets.push({ type: t, altUom, count: altHits }); break; }
      }
    }
  });
  return buckets.length ? buckets : null;
}

/* ----- Format helpers --------------------------------------- */

function formatAED(n) { return "AED " + Number(n).toLocaleString("en-AE", { maximumFractionDigits: 2 }); }
function formatAEDInt(n) { return "AED " + Math.round(n).toLocaleString("en-AE"); }
function formatPeriod(months) { return months === 1 ? "1 month" : `${months} months`; }
function periodToInt(p) { return parseInt(p, 10) || 1; }

/* ----- Image asset bank ------------------------------------- */

const IMG = {
  ac1: "https://www.figma.com/api/mcp/asset/b09ae923-6c0d-4487-8bfd-7f42af9ffe9a",
  ac2: "https://www.figma.com/api/mcp/asset/5ac0efdf-3838-4169-aba0-3a17e43a517e",
  nonac1: "https://www.figma.com/api/mcp/asset/c0749295-ec5b-4b14-b80d-cfd72c8a2e2a",
  yard1: "https://www.figma.com/api/mcp/asset/5d7dab56-f8c8-4907-a8fe-048ec611b915",
  chiller1: "https://www.figma.com/api/mcp/asset/bfba80e7-2f22-4b29-9933-e3de65cc10cc"
};

const COMMON_FACILITIES = ["Loading dock","Truck parking","Washrooms","CCTV","Fire alarm"];

/* ----- 20 warehouse seed ------------------------------------ */

const WAREHOUSES = [

  /* ── Dubai (5) ── */
  { id: "WH-9304", emirate: "Dubai", area: "JAFZA", isPartner: true,
    rating: 5.0, reviews: 231, matchScore: 96, viewers: 14, lastEnquiry: "23 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [
      { url: IMG.nonac1, tag: "WAREHOUSE INTERIOR", zoneType: "Non-AC" },
      { url: IMG.ac1,    tag: "LOADING BAY",        zoneType: "AC" },
      { url: IMG.yard1,  tag: "YARD",               zoneType: "Open Yard" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 9.60, min: 50 }
    ],
    instantAvailability: { fixedArea: 800, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 80,  price: 320 },
      { id: "U-2", size: 120, price: 520 },
      { id: "U-3", size: 220, price: 880 },
      { id: "U-4", size: 380, price: 1450 }
    ]
  },

  { id: "WH-9305", emirate: "Dubai", area: "Dubai Investment Park", isPartner: true,
    rating: 4.9, reviews: 188, matchScore: 94, viewers: 11, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Temperature monitoring"],
    images: [
      { url: IMG.ac1, tag: "AC INTERIOR", zoneType: "AC" },
      { url: IMG.ac2, tag: "RACKING",     zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",      price: 12.00, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",      price: 14.00, min: 50 },
      { cargo: "General Cargo",    storageType: "Bulk", uom: "CBM",  temp: "ambient", price: 55.00, min: 5  }
    ],
    instantAvailability: { fixedArea: 1200, lockableUnit: 5 },
    lockableUnits: [
      { id: "U-1", size: 95,   price: 480 },
      { id: "U-2", size: 140,  price: 660 },
      { id: "U-3", size: 200,  price: 920 },
      { id: "U-4", size: 320,  price: 1380 },
      { id: "U-5", size: 600,  price: 2520 }
    ]
  },

  { id: "WH-9306", emirate: "Dubai", area: "Al Quoz", isPartner: false,
    rating: 4.6, reviews: 72, matchScore: 81, viewers: 6, lastEnquiry: "4 hours ago",
    accessHours: "Mon–Sat 7am–7pm",
    facilities: ["Truck parking","CCTV","Fire alarm"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 6.50, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9307", emirate: "Dubai", area: "DAFZA", isPartner: false,
    rating: 4.7, reviews: 142, matchScore: 88, viewers: 9, lastEnquiry: "30 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring", "Forklift"],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM",    temp: "chilled", price: 65.00, min: 5 },
      { cargo: "Food & Beverages", storageType: "Rack", uom: "Pallet", temp: "chilled", price: 90.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9308", emirate: "Dubai", area: "Dubai South", isPartner: true,
    rating: 4.8, reviews: 154, matchScore: 91, viewers: 10, lastEnquiry: "12 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack", "Loading bay"],
    images: [
      { url: IMG.ac2,    tag: "AC HALL",    zoneType: "AC" },
      { url: IMG.nonac1, tag: "BULK FLOOR", zoneType: "Non-AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 11.50, min: 50 },
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.90,  min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 13.20, min: 50 }
    ],
    instantAvailability: { fixedArea: 600, lockableUnit: 6 },
    lockableUnits: [
      { id: "U-1", size: 70,   price: 290 },
      { id: "U-2", size: 110,  price: 490 },
      { id: "U-3", size: 180,  price: 770 },
      { id: "U-4", size: 240,  price: 1010 },
      { id: "U-5", size: 420,  price: 1690 },
      { id: "U-6", size: 850,  price: 3320 }
    ]
  },

  /* ── Abu Dhabi (4) ── */
  { id: "WH-9309", emirate: "Abu Dhabi", area: "Mussafah", isPartner: false,
    rating: 4.5, reviews: 96, matchScore: 78, viewers: 5, lastEnquiry: "2 hours ago",
    accessHours: "Mon–Sat 8am–8pm",
    facilities: ["Loading dock","Truck parking","CCTV","Forklift"],
    images: [{ url: IMG.nonac1, tag: "NON-AC FLOOR", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.20, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9310", emirate: "Abu Dhabi", area: "KIZAD", isPartner: true,
    rating: 4.9, reviews: 207, matchScore: 93, viewers: 13, lastEnquiry: "18 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack", "24/7 access"],
    images: [
      { url: IMG.ac1, tag: "AC HALL", zoneType: "AC" },
      { url: IMG.ac2, tag: "MEZZANINE", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 11.80, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 13.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 500, lockableUnit: 3 },
    lockableUnits: [
      { id: "U-1", size: 120,  price: 580 },
      { id: "U-2", size: 220,  price: 1020 },
      { id: "U-3", size: 480,  price: 2080 }
    ]
  },

  { id: "WH-9311", emirate: "Abu Dhabi", area: "ICAD", isPartner: false,
    rating: 4.7, reviews: 118, matchScore: 86, viewers: 7, lastEnquiry: "55 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring", "Forklift"],
    images: [{ url: IMG.chiller1, tag: "FREEZER", zoneType: "Freezer" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "frozen", price: 80.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9312", emirate: "Abu Dhabi", area: "Mussafah Industrial", isPartner: false,
    rating: 4.4, reviews: 41, matchScore: 74, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 7am–6pm",
    facilities: ["Truck parking","CCTV","Fence"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 5.80, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Sharjah (4) ── */
  { id: "WH-9313", emirate: "Sharjah", area: "SAIF Zone", isPartner: true,
    rating: 4.8, reviews: 264, matchScore: 95, viewers: 16, lastEnquiry: "8 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack", "Loading bay"],
    images: [
      { url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" },
      { url: IMG.ac1,    tag: "AC ROOM", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft",   temp: "non-ac", price: 7.90,  min: 50 },
      { cargo: "General Cargo",    storageType: "Rack", uom: "Pallet", temp: "non-ac", price: 30.00, min: 5  },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft",   temp: "ac",     price: 12.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 1000, lockableUnit: 8 },
    lockableUnits: [
      { id: "U-1", size: 60,   price: 240 },
      { id: "U-2", size: 90,   price: 380 },
      { id: "U-3", size: 130,  price: 540 },
      { id: "U-4", size: 180,  price: 740 },
      { id: "U-5", size: 240,  price: 980 },
      { id: "U-6", size: 360,  price: 1420 },
      { id: "U-7", size: 580,  price: 2240 },
      { id: "U-8", size: 900,  price: 3380 }
    ]
  },

  { id: "WH-9314", emirate: "Sharjah", area: "Hamriyah Free Zone", isPartner: false,
    rating: 4.6, reviews: 87, matchScore: 82, viewers: 6, lastEnquiry: "3 hours ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "chilled", price: 60.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9315", emirate: "Sharjah", area: "Industrial Area 12", isPartner: false,
    rating: 4.5, reviews: 53, matchScore: 76, viewers: 4, lastEnquiry: "5 hours ago",
    accessHours: "Mon–Sat 8am–7pm",
    facilities: ["Loading dock","Truck parking","CCTV"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9316", emirate: "Sharjah", area: "Al Sajaa", isPartner: false,
    rating: 4.7, reviews: 94, matchScore: 84, viewers: 5, lastEnquiry: "1 hour ago",
    accessHours: "Mon–Sat 9am–6pm",
    facilities: [...COMMON_FACILITIES, "Temperature monitoring", "GDP-certified"],
    images: [{ url: IMG.ac1, tag: "MEDICAL ROOM", zoneType: "Medical" }],
    rateCard: [
      { cargo: "Medical", storageType: "Bulk", uom: "Sqft", temp: "ambient", price: 22.00, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Ajman (3) ── */
  { id: "WH-9317", emirate: "Ajman", area: "Ajman Free Zone", isPartner: true,
    rating: 4.7, reviews: 132, matchScore: 90, viewers: 8, lastEnquiry: "40 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [
      { url: IMG.ac2, tag: "AC HALL", zoneType: "AC" },
      { url: IMG.ac1, tag: "RACKING",  zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac", price: 10.80, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 12.20, min: 50 }
    ],
    instantAvailability: { fixedArea: 700, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 110,  price: 460 },
      { id: "U-2", size: 200,  price: 820 },
      { id: "U-3", size: 320,  price: 1280 },
      { id: "U-4", size: 540,  price: 2080 }
    ]
  },

  { id: "WH-9318", emirate: "Ajman", area: "Al Jurf", isPartner: false,
    rating: 4.4, reviews: 39, matchScore: 72, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Loading dock","Truck parking","CCTV"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.50, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9319", emirate: "Ajman", area: "Ajman Industrial", isPartner: false,
    rating: 4.3, reviews: 28, matchScore: 70, viewers: 2, lastEnquiry: "2 days ago",
    accessHours: "Mon–Sat 7am–6pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 5.00, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Ras Al Khaimah (2) ── */
  { id: "WH-9320", emirate: "Ras Al Khaimah", area: "RAKEZ", isPartner: true,
    rating: 4.8, reviews: 113, matchScore: 89, viewers: 7, lastEnquiry: "25 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [
      { url: IMG.ac1, tag: "AC HALL", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 10.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 400, lockableUnit: 2 },
    lockableUnits: [
      { id: "U-1", size: 140,  price: 580 },
      { id: "U-2", size: 280,  price: 1080 }
    ]
  },

  { id: "WH-9321", emirate: "Ras Al Khaimah", area: "Al Hamra Industrial", isPartner: false,
    rating: 4.6, reviews: 76, matchScore: 80, viewers: 5, lastEnquiry: "2 hours ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "FREEZER", zoneType: "Freezer" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "frozen", price: 75.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Umm Al Quwain (2) ── */
  { id: "WH-9322", emirate: "Umm Al Quwain", area: "UAQ Free Zone", isPartner: true,
    rating: 4.7, reviews: 89, matchScore: 85, viewers: 5, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [
      { url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" },
      { url: IMG.ac1,    tag: "AC ROOM", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.20, min: 50 }
    ],
    instantAvailability: { fixedArea: 900, lockableUnit: 5 },
    lockableUnits: [
      { id: "U-1", size: 85,   price: 320 },
      { id: "U-2", size: 130,  price: 500 },
      { id: "U-3", size: 220,  price: 820 },
      { id: "U-4", size: 360,  price: 1320 },
      { id: "U-5", size: 720,  price: 2540 }
    ]
  },

  { id: "WH-9323", emirate: "Umm Al Quwain", area: "Al Salamah", isPartner: false,
    rating: 4.5, reviews: 47, matchScore: 75, viewers: 3, lastEnquiry: "4 hours ago",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Loading dock","Truck parking","CCTV","Pallet jack"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "non-ac", price: 7.20, min: 50 },
      { cargo: "General Cargo", storageType: "Rack", uom: "Pallet", temp: "non-ac", price: 35.00, min: 5  }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ════════════════════════════════════════════════════════════
     Expansion set — WH-9324 to WH-9363 (40 warehouses)
     ════════════════════════════════════════════════════════════ */

  /* ── Dubai expansion (+10) ── */
  { id: "WH-9324", emirate: "Dubai", area: "Al Quoz", isPartner: true,
    rating: 4.9, reviews: 312, matchScore: 95, viewers: 18, lastEnquiry: "5 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack", "Loading bay"],
    images: [
      { url: IMG.ac1,    tag: "AC HALL",      zoneType: "AC" },
      { url: IMG.nonac1, tag: "NON-AC FLOOR", zoneType: "Non-AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 12.40, min: 50 },
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 9.20,  min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 14.00, min: 50 }
    ],
    instantAvailability: { fixedArea: 1500, lockableUnit: 7 },
    lockableUnits: [
      { id: "U-1", size: 65,   price: 280 },
      { id: "U-2", size: 110,  price: 480 },
      { id: "U-3", size: 165,  price: 720 },
      { id: "U-4", size: 230,  price: 980 },
      { id: "U-5", size: 360,  price: 1480 },
      { id: "U-6", size: 540,  price: 2160 },
      { id: "U-7", size: 880,  price: 3520 }
    ]
  },

  { id: "WH-9325", emirate: "Dubai", area: "Jebel Ali", isPartner: true,
    rating: 4.7, reviews: 198, matchScore: 90, viewers: 11, lastEnquiry: "22 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Cold chain monitoring"],
    images: [
      { url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" },
      { url: IMG.ac1,      tag: "AC ROOM", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM",  temp: "chilled", price: 62.00, min: 5  },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",      price: 13.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 600, lockableUnit: 3 },
    lockableUnits: [
      { id: "U-1", size: 100, price: 460 },
      { id: "U-2", size: 200, price: 880 },
      { id: "U-3", size: 380, price: 1620 }
    ]
  },

  { id: "WH-9326", emirate: "Dubai", area: "Ras Al Khor", isPartner: false,
    rating: 4.6, reviews: 84, matchScore: 82, viewers: 6, lastEnquiry: "1 hour ago",
    accessHours: "Mon–Sat 7am–8pm",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9327", emirate: "Dubai", area: "Dubai Industrial City", isPartner: true,
    rating: 4.8, reviews: 167, matchScore: 88, viewers: 9, lastEnquiry: "33 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [
      { url: IMG.nonac1, tag: "BULK FLOOR", zoneType: "Non-AC" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "non-ac", price: 8.50,  min: 50 },
      { cargo: "General Cargo", storageType: "Rack", uom: "Pallet", temp: "non-ac", price: 32.00, min: 5  }
    ],
    instantAvailability: { fixedArea: 1100, lockableUnit: 5 },
    lockableUnits: [
      { id: "U-1", size: 80,   price: 320 },
      { id: "U-2", size: 140,  price: 560 },
      { id: "U-3", size: 220,  price: 880 },
      { id: "U-4", size: 380,  price: 1480 },
      { id: "U-5", size: 700,  price: 2680 }
    ]
  },

  { id: "WH-9328", emirate: "Dubai", area: "Al Khabaisi", isPartner: false,
    rating: 4.5, reviews: 62, matchScore: 78, viewers: 4, lastEnquiry: "3 hours ago",
    accessHours: "Mon–Sat 8am–7pm",
    facilities: ["Loading dock","Truck parking","CCTV","Fire alarm"],
    images: [{ url: IMG.ac2, tag: "AC HALL", zoneType: "AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 11.20, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9329", emirate: "Dubai", area: "Warsan", isPartner: false,
    rating: 4.4, reviews: 38, matchScore: 73, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Truck parking","CCTV","Fence"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 6.10, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9330", emirate: "Dubai", area: "Dubai Healthcare City", isPartner: true,
    rating: 4.9, reviews: 142, matchScore: 92, viewers: 8, lastEnquiry: "12 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Temperature monitoring", "GDP-certified", "DHA licensed"],
    images: [{ url: IMG.ac1, tag: "MEDICAL ROOM", zoneType: "Medical" }],
    rateCard: [
      { cargo: "Medical", storageType: "Bulk", uom: "Sqft", temp: "ambient", price: 26.00, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9331", emirate: "Dubai", area: "DIC", isPartner: true,
    rating: 4.7, reviews: 156, matchScore: 87, viewers: 10, lastEnquiry: "45 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "FREEZER", zoneType: "Freezer" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "frozen", price: 82.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9332", emirate: "Dubai", area: "Umm Ramool", isPartner: false,
    rating: 4.5, reviews: 71, matchScore: 79, viewers: 5, lastEnquiry: "2 hours ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9333", emirate: "Dubai", area: "Al Awir", isPartner: false,
    rating: 4.3, reviews: 29, matchScore: 70, viewers: 2, lastEnquiry: "2 days ago",
    accessHours: "Mon–Sat 7am–6pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 5.40, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Abu Dhabi expansion (+8) ── */
  { id: "WH-9334", emirate: "Abu Dhabi", area: "KIZAD", isPartner: true,
    rating: 4.8, reviews: 178, matchScore: 91, viewers: 11, lastEnquiry: "20 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [
      { url: IMG.ac1,    tag: "AC HALL",  zoneType: "AC" },
      { url: IMG.nonac1, tag: "BULK",     zoneType: "Non-AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.10,  min: 50 },
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 11.00, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 12.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 800, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 90,   price: 360 },
      { id: "U-2", size: 160,  price: 640 },
      { id: "U-3", size: 280,  price: 1100 },
      { id: "U-4", size: 480,  price: 1840 }
    ]
  },

  { id: "WH-9335", emirate: "Abu Dhabi", area: "Mussafah", isPartner: true,
    rating: 4.6, reviews: 102, matchScore: 84, viewers: 7, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.ac2, tag: "AC HALL", zoneType: "AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "ac",     price: 10.60, min: 50 },
      { cargo: "General Cargo", storageType: "Rack", uom: "Pallet", temp: "ac",     price: 38.00, min: 5  }
    ],
    instantAvailability: { fixedArea: 500, lockableUnit: 3 },
    lockableUnits: [
      { id: "U-1", size: 120, price: 520 },
      { id: "U-2", size: 220, price: 940 },
      { id: "U-3", size: 420, price: 1720 }
    ]
  },

  { id: "WH-9336", emirate: "Abu Dhabi", area: "ICAD II", isPartner: false,
    rating: 4.5, reviews: 56, matchScore: 77, viewers: 4, lastEnquiry: "4 hours ago",
    accessHours: "Mon–Sat 7am–7pm",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "chilled", price: 64.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9337", emirate: "Abu Dhabi", area: "Al Markaz", isPartner: false,
    rating: 4.4, reviews: 33, matchScore: 71, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Truck parking","CCTV","Fence"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 5.50, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9338", emirate: "Abu Dhabi", area: "Khalifa Industrial Zone", isPartner: true,
    rating: 4.7, reviews: 124, matchScore: 86, viewers: 8, lastEnquiry: "55 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.90, min: 50 }
    ],
    instantAvailability: { fixedArea: 700, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 75,   price: 300 },
      { id: "U-2", size: 150,  price: 580 },
      { id: "U-3", size: 260,  price: 980 },
      { id: "U-4", size: 460,  price: 1720 }
    ]
  },

  { id: "WH-9339", emirate: "Abu Dhabi", area: "Mohammed Bin Zayed City", isPartner: false,
    rating: 4.8, reviews: 89, matchScore: 85, viewers: 6, lastEnquiry: "30 minutes ago",
    accessHours: "Mon–Sat 9am–6pm",
    facilities: [...COMMON_FACILITIES, "Temperature monitoring", "GDP-certified"],
    images: [{ url: IMG.ac1, tag: "MEDICAL ROOM", zoneType: "Medical" }],
    rateCard: [
      { cargo: "Medical", storageType: "Bulk", uom: "Sqft", temp: "ambient", price: 23.50, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9340", emirate: "Abu Dhabi", area: "Al Ain Industrial", isPartner: false,
    rating: 4.3, reviews: 24, matchScore: 69, viewers: 2, lastEnquiry: "3 days ago",
    accessHours: "Mon–Sat 8am–5pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9341", emirate: "Abu Dhabi", area: "Mussafah West", isPartner: false,
    rating: 4.6, reviews: 67, matchScore: 81, viewers: 5, lastEnquiry: "2 hours ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.ac2, tag: "AC HALL", zoneType: "AC" }],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac", price: 10.80, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 12.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Sharjah expansion (+9) ── */
  { id: "WH-9342", emirate: "Sharjah", area: "SAIF Zone", isPartner: true,
    rating: 4.9, reviews: 245, matchScore: 94, viewers: 14, lastEnquiry: "8 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack", "Loading bay"],
    images: [
      { url: IMG.ac1,    tag: "AC HALL",  zoneType: "AC" },
      { url: IMG.nonac1, tag: "BULK",     zoneType: "Non-AC" },
      { url: IMG.ac2,    tag: "RACKING",  zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 11.40, min: 50 },
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 8.20,  min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 13.00, min: 50 }
    ],
    instantAvailability: { fixedArea: 1300, lockableUnit: 6 },
    lockableUnits: [
      { id: "U-1", size: 70,   price: 280 },
      { id: "U-2", size: 130,  price: 520 },
      { id: "U-3", size: 200,  price: 800 },
      { id: "U-4", size: 320,  price: 1240 },
      { id: "U-5", size: 540,  price: 2080 },
      { id: "U-6", size: 820,  price: 3160 }
    ]
  },

  { id: "WH-9343", emirate: "Sharjah", area: "Hamriyah Free Zone", isPartner: true,
    rating: 4.7, reviews: 134, matchScore: 87, viewers: 9, lastEnquiry: "35 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.60, min: 50 }
    ],
    instantAvailability: { fixedArea: 600, lockableUnit: 3 },
    lockableUnits: [
      { id: "U-1", size: 95,   price: 380 },
      { id: "U-2", size: 180,  price: 700 },
      { id: "U-3", size: 340,  price: 1280 }
    ]
  },

  { id: "WH-9344", emirate: "Sharjah", area: "Industrial Area 5", isPartner: false,
    rating: 4.5, reviews: 49, matchScore: 76, viewers: 4, lastEnquiry: "3 hours ago",
    accessHours: "Mon–Sat 7am–8pm",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.ac2, tag: "AC HALL", zoneType: "AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 10.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9345", emirate: "Sharjah", area: "Al Sajaa Industrial", isPartner: false,
    rating: 4.6, reviews: 73, matchScore: 80, viewers: 5, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "FREEZER", zoneType: "Freezer" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "frozen", price: 78.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9346", emirate: "Sharjah", area: "Industrial Area 18", isPartner: false,
    rating: 4.4, reviews: 36, matchScore: 72, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Truck parking","CCTV","Fence"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 5.20, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9347", emirate: "Sharjah", area: "Al Khan", isPartner: true,
    rating: 4.8, reviews: 156, matchScore: 88, viewers: 10, lastEnquiry: "20 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [
      { url: IMG.ac1, tag: "AC HALL", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac", price: 11.00, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 12.60, min: 50 }
    ],
    instantAvailability: { fixedArea: 900, lockableUnit: 5 },
    lockableUnits: [
      { id: "U-1", size: 80,   price: 320 },
      { id: "U-2", size: 140,  price: 580 },
      { id: "U-3", size: 240,  price: 980 },
      { id: "U-4", size: 380,  price: 1500 },
      { id: "U-5", size: 620,  price: 2400 }
    ]
  },

  { id: "WH-9348", emirate: "Sharjah", area: "Industrial Area 13", isPartner: false,
    rating: 4.7, reviews: 81, matchScore: 83, viewers: 6, lastEnquiry: "2 hours ago",
    accessHours: "Mon–Sat 9am–6pm",
    facilities: [...COMMON_FACILITIES, "Temperature monitoring", "GDP-certified"],
    images: [{ url: IMG.ac1, tag: "MEDICAL", zoneType: "Medical" }],
    rateCard: [
      { cargo: "Medical", storageType: "Bulk", uom: "Sqft", temp: "ambient", price: 21.00, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9349", emirate: "Sharjah", area: "Hamriyah Phase 2", isPartner: false,
    rating: 4.5, reviews: 58, matchScore: 78, viewers: 4, lastEnquiry: "5 hours ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "non-ac", price: 7.40,  min: 50 },
      { cargo: "General Cargo", storageType: "Rack", uom: "Pallet", temp: "non-ac", price: 33.00, min: 5  }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9350", emirate: "Sharjah", area: "Industrial Area 2", isPartner: false,
    rating: 4.3, reviews: 22, matchScore: 68, viewers: 2, lastEnquiry: "2 days ago",
    accessHours: "Mon–Sat 8am–5pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 4.80, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Ajman expansion (+6) ── */
  { id: "WH-9351", emirate: "Ajman", area: "Ajman Free Zone", isPartner: true,
    rating: 4.6, reviews: 98, matchScore: 85, viewers: 7, lastEnquiry: "45 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [
      { url: IMG.nonac1, tag: "BULK",   zoneType: "Non-AC" },
      { url: IMG.ac2,    tag: "AC ROOM", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 7.40, min: 50 },
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 9.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 600, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 95,   price: 380 },
      { id: "U-2", size: 170,  price: 660 },
      { id: "U-3", size: 280,  price: 1080 },
      { id: "U-4", size: 480,  price: 1820 }
    ]
  },

  { id: "WH-9352", emirate: "Ajman", area: "Al Jurf Industrial", isPartner: false,
    rating: 4.5, reviews: 47, matchScore: 76, viewers: 4, lastEnquiry: "2 hours ago",
    accessHours: "Mon–Sat 8am–7pm",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "chilled", price: 58.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9353", emirate: "Ajman", area: "Ajman Industrial 2", isPartner: false,
    rating: 4.4, reviews: 31, matchScore: 71, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 7am–6pm",
    facilities: ["Loading dock","Truck parking","CCTV"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 6.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9354", emirate: "Ajman", area: "Al Jurf 2", isPartner: false,
    rating: 4.3, reviews: 19, matchScore: 67, viewers: 2, lastEnquiry: "3 days ago",
    accessHours: "Mon–Sat 8am–5pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 4.60, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9355", emirate: "Ajman", area: "Ajman Free Zone Phase 2", isPartner: true,
    rating: 4.7, reviews: 76, matchScore: 84, viewers: 5, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [{ url: IMG.ac1, tag: "AC HALL", zoneType: "AC" }],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 9.60, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac",     price: 11.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 400, lockableUnit: 2 },
    lockableUnits: [
      { id: "U-1", size: 110, price: 420 },
      { id: "U-2", size: 230, price: 880 }
    ]
  },

  { id: "WH-9356", emirate: "Ajman", area: "Industrial Area 1", isPartner: false,
    rating: 4.6, reviews: 52, matchScore: 79, viewers: 4, lastEnquiry: "3 hours ago",
    accessHours: "Mon–Sat 9am–6pm",
    facilities: [...COMMON_FACILITIES, "Temperature monitoring", "GDP-certified"],
    images: [{ url: IMG.ac1, tag: "MEDICAL", zoneType: "Medical" }],
    rateCard: [
      { cargo: "Medical", storageType: "Bulk", uom: "Sqft", temp: "ambient", price: 19.50, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Ras Al Khaimah expansion (+4) ── */
  { id: "WH-9357", emirate: "Ras Al Khaimah", area: "RAKEZ", isPartner: true,
    rating: 4.7, reviews: 89, matchScore: 86, viewers: 6, lastEnquiry: "30 minutes ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift", "Pallet jack"],
    images: [
      { url: IMG.nonac1, tag: "BULK",   zoneType: "Non-AC" },
      { url: IMG.ac1,    tag: "AC ROOM", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "non-ac", price: 7.20,  min: 50 },
      { cargo: "General Cargo", storageType: "Rack", uom: "Pallet", temp: "non-ac", price: 28.00, min: 5  },
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft",   temp: "ac",     price: 9.40,  min: 50 }
    ],
    instantAvailability: { fixedArea: 700, lockableUnit: 4 },
    lockableUnits: [
      { id: "U-1", size: 100, price: 380 },
      { id: "U-2", size: 180, price: 660 },
      { id: "U-3", size: 300, price: 1080 },
      { id: "U-4", size: 520, price: 1820 }
    ]
  },

  { id: "WH-9358", emirate: "Ras Al Khaimah", area: "Al Ghail", isPartner: false,
    rating: 4.4, reviews: 34, matchScore: 72, viewers: 3, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: ["Loading dock","Truck parking","CCTV"],
    images: [{ url: IMG.nonac1, tag: "BULK", zoneType: "Non-AC" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Bulk", uom: "Sqft", temp: "non-ac", price: 6.40, min: 50 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9359", emirate: "Ras Al Khaimah", area: "Al Hamra Phase 2", isPartner: false,
    rating: 4.5, reviews: 42, matchScore: 75, viewers: 3, lastEnquiry: "2 hours ago",
    accessHours: "Mon–Sat 9am–6pm",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "CHILLER", zoneType: "Chiller" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "chilled", price: 56.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9360", emirate: "Ras Al Khaimah", area: "RAK Industrial", isPartner: false,
    rating: 4.3, reviews: 18, matchScore: 66, viewers: 2, lastEnquiry: "3 days ago",
    accessHours: "Mon–Sat 8am–5pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 4.40, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  /* ── Umm Al Quwain expansion (+3) ── */
  { id: "WH-9361", emirate: "Umm Al Quwain", area: "UAQ Free Zone", isPartner: true,
    rating: 4.6, reviews: 64, matchScore: 81, viewers: 4, lastEnquiry: "1 hour ago",
    accessHours: "24/7",
    facilities: [...COMMON_FACILITIES, "Forklift"],
    images: [
      { url: IMG.ac1, tag: "AC HALL", zoneType: "AC" }
    ],
    rateCard: [
      { cargo: "General Cargo",    storageType: "Bulk", uom: "Sqft", temp: "ac", price: 9.20, min: 50 },
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "Sqft", temp: "ac", price: 10.80, min: 50 }
    ],
    instantAvailability: { fixedArea: 500, lockableUnit: 3 },
    lockableUnits: [
      { id: "U-1", size: 100, price: 380 },
      { id: "U-2", size: 200, price: 740 },
      { id: "U-3", size: 380, price: 1380 }
    ]
  },

  { id: "WH-9362", emirate: "Umm Al Quwain", area: "Al Salamah", isPartner: false,
    rating: 4.4, reviews: 28, matchScore: 70, viewers: 2, lastEnquiry: "yesterday",
    accessHours: "Mon–Sat 8am–6pm",
    facilities: [...COMMON_FACILITIES, "Cold chain monitoring"],
    images: [{ url: IMG.chiller1, tag: "FREEZER", zoneType: "Freezer" }],
    rateCard: [
      { cargo: "Food & Beverages", storageType: "Bulk", uom: "CBM", temp: "frozen", price: 70.00, min: 5 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  },

  { id: "WH-9363", emirate: "Umm Al Quwain", area: "UAQ Industrial", isPartner: false,
    rating: 4.3, reviews: 16, matchScore: 65, viewers: 2, lastEnquiry: "3 days ago",
    accessHours: "Mon–Sat 8am–5pm",
    facilities: ["Truck parking","CCTV"],
    images: [{ url: IMG.yard1, tag: "OPEN YARD", zoneType: "Open Yard" }],
    rateCard: [
      { cargo: "General Cargo", storageType: "Open Yard", uom: "Sqft", temp: "ambient", price: 4.60, min: 100 }
    ],
    instantAvailability: { fixedArea: 0, lockableUnit: 0 },
    lockableUnits: []
  }

];

/* ----- Normalize: every warehouse has at least 5 images ----- */
(function padWarehouseImages() {
  const POOL = [
    { url: IMG.ac1,      tag: "WAREHOUSE INTERIOR", zoneType: "AC" },
    { url: IMG.ac2,      tag: "RACKING",            zoneType: "AC" },
    { url: IMG.nonac1,   tag: "NON-AC INTERIOR",    zoneType: "Non-AC" },
    { url: IMG.yard1,    tag: "OPEN YARD",          zoneType: "Open Yard" },
    { url: IMG.chiller1, tag: "CHILLER ZONE",       zoneType: "Chiller" }
  ];
  const MIN_IMAGES = 5;
  WAREHOUSES.forEach(w => {
    if (!w.images) w.images = [];
    const existingUrls = new Set(w.images.map(i => i.url));
    POOL.forEach(p => {
      if (w.images.length >= MIN_IMAGES) return;
      if (!existingUrls.has(p.url)) {
        w.images.push(p);
        existingUrls.add(p.url);
      }
    });
    let i = 0;
    while (w.images.length < MIN_IMAGES) {
      w.images.push(POOL[i % POOL.length]);
      i++;
    }
  });
})();

/* ----- Default state ---------------------------------------- */

const DEFAULT_SEARCH_STATE = {
  goodsIntent: "General Cargo",
  emirate: "Dubai",
  area: "",
  period: "1 Month"
};

const DEFAULT_FILTERS = {
  sizeInput: 100,
  sizeUnit: "Sqft",
  period: "1 Month",
  warehouseTypeFilters: ["Non-AC Warehouse","AC Warehouse"],
  goodsType: "General Cargo",
  isFixedAreaChecked: false,
  isLockableChecked: false,
  faSizeInput: 100,
  lockableRange: "100-150"
};
