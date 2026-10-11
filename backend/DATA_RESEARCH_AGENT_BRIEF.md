# PharmReach pharmacy data research brief

You are adding verified CVS data to the CVS source dataset at `backend/data/cvs-data.json`.
The app now compares that source with a separate, already integrated Walgreens snapshot
in `backend/data/walgreens-data.json`. Keep this task focused on CVS products or locations;
do not edit the Walgreens snapshot, shared app code, or the retailer merge logic.

## Choose one contribution

Pick one track so the result is easy to review and merge:

1. **New CVS products:** Find 5-10 common OTC products sold by CVS and collect the
   exact CVS item, pack size, current online price, and store-specific availability
   at the nine existing CVS locations listed below.
2. **More CVS locations:** Find additional CVS pharmacies in New Jersey beyond the
   nine already listed below. Collect official CVS store details and exact OSM
   pharmacy coordinates, then check the existing products at those stores.

For a product-specific search at a selected store, record `Out of stock` if the exact product returns no listing/result. The user wants this treated as not stocked at that store and excluded from stocked results. Use `Unknown` only if the lookup was not performed, blocked, or ambiguous; never use `Unknown` for a completed direct search that returned no listing. Add an evidence note such as `direct_product_store_search_no_listing`.

## Current dataset

File: `backend/data/cvs-data.json` (JSON is read on every API request).

Current catalog has 34 OTC products (27 CVS listings and seven Walgreens-only listings) and nine CVS stores. The earlier nine-product CVS expansion (budesonide spray, guaifenesin/dextromethorphan ER, Tussin DM liquid, loperamide softgels, saline nasal spray, polyethylene glycol 3350, magnesium citrate, famotidine, and docusate sodium) has current online prices; retain its existing branch-level statuses unless new store-specific evidence is collected. Friend research also covered hydrocortisone, loperamide softgels, and saline spray; these matched existing product IDs, and their store observations are merged into the existing records. Chlorpheniramine maleate 4 mg tablets (100 count) and docosanol 10% cream pump (2 g) are new CVS products. All five friend records have inventory rows for all nine CVS stores; unverified branches remain `Unknown`. Avoid duplicating any exact product IDs/listings, especially those five. Seven Walgreens-only products are present, with branch data in the companion Walgreens file. Three CVS stores were added from official CVS locator records; for products without a product-specific check at those stores, keep `Unknown`:

- CVS Pharmacy, 811 Clinton St, Hoboken, NJ 07030 (store 2209)
- CVS Pharmacy, 59 Washington St / Court Street Plaza, Hoboken, NJ 07030 (1928)
- CVS Pharmacy, 210 14th St, Hoboken, NJ 07030 (4443)
- CVS at Target, 100 14th St, Jersey City, NJ 07310 (17006)
- CVS Pharmacy, 714 Summit Ave, Union City, NJ 07087 (4615)
- CVS Pharmacy, 88 Morgan St, Jersey City, NJ 07302 (11088)
- CVS Pharmacy, 70 Hudson St, Jersey City, NJ 07302 (11135)
- CVS at Target, 104 Sip Ave, Jersey City, NJ 07306 (17919)
- CVS Pharmacy y más, 4700 Bergenline Ave, Union City, NJ 07087 (7400)

The captured CVS snapshot is dated 2026-10-10. Availability coverage varies by item and store. Low-dose aspirin was listed in stock with pickup at 811 Clinton, 59 Washington, 210 14th, 714 Summit, and 88 Morgan. A direct low-dose aspirin search returned no listing for the 100 14th Target store, so it is classified `Out of stock` and excluded from stocked results.

## Rules for collection

- Use public CVS product/store pages and the normal visible **Check more stores**
  flow. Do not bypass access controls, automate around a block, use private endpoints,
  or collect authenticated/private information.
- Limit pharmacy records to New Jersey. The user wants CVS pharmacy product/store records limited to New Jersey; separate Walgreens records are already integrated.
- Record data only after confirming the exact CVS product and exact pack/strength/form.
  Similar ingredients with a different form or pack are not the same SKU.
- Use a product-specific result for the selected store. If a completed direct search
  returns no listing, record `Out of stock` and exclude that store from stocked results.
  Use `Unknown` only when the lookup was blocked, not completed, or ambiguous.
- If CVS exposes an exact stock count, include it in your report as evidence; do not
  invent or round a count. The current app schema uses status and pickup availability,
  so do not change the schema unless you also propose the UI/API updates.
- Prices are CVS online product-page prices. Record when checked and link the exact
  CVS product page. Do not substitute coupons, ExtraCare prices, third-party prices,
  insurance catalog prices, or a sale price without labeling the price type.
- Each store must link to its official CVS locator page. Coordinates must come from
  OpenStreetMap; include an OSM link and coordinates. If the precise pharmacy has no
  OSM feature, use a clearly labeled building/address proxy and say so.
- Keep the checked date in ISO format (`YYYY-MM-DD`). Inventory changes, so never
  describe the snapshot as guaranteed current after that date.
- Keep generic ingredient/product wording for the app-facing name when possible.
  Preserve the CVS product title and SKU in the source URL and metadata.
- Do not overwrite other people's changes. Return a small patch or JSON additions
  and a concise evidence report; leave existing records untouched unless asked.

## `cvs-data.json` structure

Top-level keys are `source_info`, `medications`, `pharmacies`, and `inventory`.

### New product entry

Add a medication object to `medications`:

```json
{
  "id": "cvs-generic-name-strength-pack",
  "name": "Generic ingredient or product name",
  "strength": "Strength and form",
  "aka": "common names and search aliases",
  "category": "Pain relief",
  "quantity": 30,
  "quantity_label": "30 tablets",
  "product_id": "CVS product id",
  "product_source": "https://www.cvs.com/shop/...",
  "price_source": "https://www.cvs.com/shop/...",
  "price_checked_on": "2026-10-10",
  "variants": [
    {
      "id": "cvs-generic-name-strength-pack",
      "strength": "Strength and form",
      "form": "",
      "quantity": 30,
      "quantity_label": "30 tablets",
      "price_multiplier": 1
    }
  ]
}
```

Add an inventory entry under `inventory[product_id][store_id]` for every store being
reported:

```json
{
  "price": 8.59,
  "stock": "In stock",
  "pickup_available": true,
  "checked_on": "2026-10-10",
  "availability_source": "https://www.cvs.com/shop/...",
  "price_source": "https://www.cvs.com/shop/...",
  "price_checked_on": "2026-10-10"
}
```

Allowed `stock` values: `In stock`, `Out of stock`, `Unknown`. Use
`pickup_available: true` only when CVS explicitly offers pickup; use `false` when the
page explicitly says pickup is unavailable; otherwise use `null`. Unknown entries
should have `stock: "Unknown"`, `pickup_available: null`, `checked_on: null`, and
`availability_source: null`.

### New store entry

Add a pharmacy object to `pharmacies` with the fields already used in the file:

```json
{
  "id": "cvs-city-street",
  "name": "CVS Pharmacy",
  "tag": "CVS · City",
  "address": "100 Main St · City, NJ 07000",
  "latitude": 40.0000000,
  "longitude": -74.0000000,
  "coordinates_source": "https://www.openstreetmap.org/way/123456",
  "distance": 1.0,
  "walk": 20,
  "transit": 15,
  "depart": 4,
  "drive": 8,
  "driveCost": 1.0,
  "bike": 7,
  "ship": null,
  "days": null,
  "phone": "201-555-0100",
  "location_source": "https://www.cvs.com/store-locator/...",
  "location_verified_on": "2026-10-10",
  "state": "NJ",
  "city": "City",
  "zip": "07000",
  "cvs_store_id": "1234"
}
```

Route values are only placeholders for the no-OTP fallback. Do not claim they are
CVS-provided. If the app is using OTP, its OSM/GTFS routing replaces these fallback
values. Use realistic local fallback estimates and clearly report that they are
estimates. Do not include non-NJ locations even if CVS shows them as nearby.

## Deliverables

Return:

1. The selected track and the list of products or stores added.
2. The exact official CVS product/store URLs and OSM coordinate sources.
3. A table of store-by-product status, pickup state, price, and checked date.
4. Only blocked or incomplete lookups as `Unknown`; selected-store product searches with no listing as `Out of stock`, with evidence `direct_product_store_search_no_listing`.
5. A JSON patch/additions file or a commit-sized diff. Do not include scraped HTML,
   cookies, session data, credentials, or private endpoint responses.

Before handing it back, validate JSON syntax and confirm every inventory product/store
key points to an existing medication and CVS pharmacy ID.
