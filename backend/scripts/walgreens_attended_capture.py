#!/usr/bin/env python3
"""Attended Walgreens / Duane Reade product-store capture helper.

Opens an existing public Walgreens product page in the default browser. The
operator reviews the visible item and selected-store availability UI, then
enters the observations. It does not inspect page DOM, call Walgreens APIs,
or write directly to PharmReach inventory.

Usage from the repository root:
  python3 backend/scripts/walgreens_attended_capture.py \
    backend/data/walgreens-data.json backend/data/cvs-data.json

Writes a separate review candidate JSON in the current directory.
"""
from __future__ import annotations

import json
import sys
import webbrowser
from datetime import date
from pathlib import Path


def read_json(path: Path) -> dict:
    value = json.loads(path.expanduser().read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def load_inputs(walgreens_path: Path, catalog_path: Path) -> tuple[dict, dict]:
    walgreens = read_json(walgreens_path)
    catalog = read_json(catalog_path)
    if not isinstance(walgreens.get("pharmacies"), list) or not isinstance(walgreens.get("inventory"), dict):
        raise ValueError("Expected walgreens-data.json with pharmacies and inventory")
    if not isinstance(catalog.get("medications"), list):
        raise ValueError("Expected cvs-data.json with a medications list")
    return walgreens, catalog


def med_map(catalog: dict) -> dict[str, dict]:
    return {item["id"]: item for item in catalog["medications"] if item.get("id")}


def unknown_count(inventory: dict, product_ids: list[str], store_id: str) -> int:
    return sum(inventory.get(pid, {}).get(store_id, {}).get("stock", "Unknown") == "Unknown" for pid in product_ids)


def choose_stores(data: dict) -> list[dict]:
    inventory = data["inventory"]
    product_ids = list(inventory)
    stores = [store for store in data["pharmacies"] if unknown_count(inventory, product_ids, store.get("id", ""))]
    stores.sort(key=lambda store: (-unknown_count(inventory, product_ids, store["id"]), store.get("name", ""), store.get("address", "")))
    print("\nWalgreens / Duane Reade stores with Unknown product inventory, most gaps first:")
    for i, store in enumerate(stores, 1):
        print(f"{i:>2}. {store.get('name', 'Walgreens')} — {store.get('address', store['id'])} ({unknown_count(inventory, product_ids, store['id'])} products)")
    raw = input("\nStore numbers (comma-separated, or 'all'; q to quit): ").strip().lower()
    if raw == "q":
        return []
    if raw == "all":
        return stores
    try:
        indexes = [int(part.strip()) - 1 for part in raw.split(",") if part.strip()]
        if not indexes or any(index < 0 or index >= len(stores) for index in indexes):
            raise ValueError
        return [stores[i] for i in dict.fromkeys(indexes)]
    except ValueError as exc:
        raise ValueError("Enter valid store numbers, 'all', or 'q'") from exc


def get_product_url(rows: dict) -> str | None:
    for row in rows.values():
        url = row.get("product_source") or row.get("availability_source") or row.get("price_source")
        if url and url.startswith("https://www.walgreens.com/"):
            return url
    return None


def choose_products(data: dict, medications: dict[str, dict], selected_store_ids: set[str]) -> list[dict]:
    products = []
    for product_id, rows in data["inventory"].items():
        med = medications.get(product_id)
        url = get_product_url(rows)
        if not med or not url:
            continue
        unknowns = [sid for sid in selected_store_ids if rows.get(sid, {}).get("stock", "Unknown") == "Unknown"]
        if unknowns:
            products.append({"id": product_id, "medication": med, "rows": rows, "url": url, "unknowns": unknowns})
    products.sort(key=lambda product: (-len(product["unknowns"]), product["medication"].get("name", "").casefold()))
    if not products:
        print("\nNo Unknown product/store pairs remain at the selected stores.")
        return []
    print("\nProducts with a Walgreens URL and Unknown status at selected store(s):")
    for i, product in enumerate(products, 1):
        med = product["medication"]
        print(f"{i:>2}. {med['name']} [{product['id']}] — {len(product['unknowns'])} selected store(s)")
    raw = input("\nProduct numbers (comma-separated, or 'all'; q to quit): ").strip().lower()
    if raw == "q":
        return []
    if raw == "all":
        return products
    try:
        indexes = [int(part.strip()) - 1 for part in raw.split(",") if part.strip()]
        if not indexes or any(index < 0 or index >= len(products) for index in indexes):
            raise ValueError
        return [products[i] for i in dict.fromkeys(indexes)]
    except ValueError as exc:
        raise ValueError("Enter valid product numbers, 'all', or 'q'") from exc


def ask_money(prompt: str) -> float | None:
    raw = input(prompt).strip().replace("$", "")
    if not raw:
        return None
    try:
        amount = round(float(raw), 2)
        if amount < 0:
            raise ValueError
        return amount
    except ValueError as exc:
        raise ValueError("Enter a nonnegative price or leave blank") from exc


def ask_count(prompt: str) -> int | None:
    raw = input(prompt).strip()
    if not raw:
        return None
    try:
        count = int(raw)
        if count < 0:
            raise ValueError
        return count
    except ValueError as exc:
        raise ValueError("Enter a nonnegative stock count or leave blank") from exc


def capture_product(product: dict, stores: list[dict]) -> dict | None:
    med = product["medication"]
    print("\n" + "=" * 72)
    print(f"Product: {med['name']} [{product['id']}]")
    print(f"Catalog description: {med.get('strength', '')}; {med.get('quantity_label', '')}")
    print(f"Walgreens page: {product['url']}")
    if input("Open this public Walgreens product page? [Y/n] ").strip().lower() == "n":
        return None
    webbrowser.open_new_tab(product["url"])
    input(
        "On the visible Walgreens page, select Pickup. If the selected store says "
        "'Not sold', open 'Check other stores'. In its drawer, click the 'Stores near' "
        "ZIP link and search the target branch ZIP. Turn off 'Show stores that have it "
        "in stock' to include out-of-stock branches. Match the exact branch address, "
        "then read its status, stock count, and displayed price. Do not click 'Add for "
        "pickup'. Press Enter when you have checked the target branch..."
    )
    identity = input("Does the exact strength/form/pack match the catalog item? [y/n/skip] ").strip().lower()
    if identity == "skip":
        return None
    if identity != "y":
        print("Skipped: resolve the product mapping before recording stock.")
        return None
    checked_on = input(f"Observation date [{date.today().isoformat()}]: ").strip() or date.today().isoformat()
    rows = []
    print("\ni = In stock, o = target branch explicitly says Out of stock")
    print("n = exact product searched for at the target branch, but no listing was returned")
    print("u = unchecked, blocked, or unclear; s = stop this product")
    print("Only enter o/n after using the ZIP lookup and matching the exact branch address.")
    print("A missing branch in a broad/nearby list is not enough: use u unless the exact branch lookup is clear.\n")
    for store in stores:
        store_id = store["id"]
        if store_id not in product["unknowns"]:
            continue
        print(f"{store.get('name', 'Walgreens')} — {store.get('address', store_id)} [{store_id}]")
        entry = input("  status [i/o/n/u/s]: ").strip().lower()
        if entry == "s":
            break
        direct_no_listing = entry == "n"
        stock = {"i": "In stock", "o": "Out of stock", "n": "Out of stock", "u": "Unknown"}.get(entry, "Unknown")
        if entry not in {"i", "o", "n", "u"}:
            print("  Unrecognized entry; recording Unknown.")
        price = ask_money("  displayed item price (blank if not shown or out of stock): $")
        regular_price = ask_money("  regular price if a sale is displayed (blank if not shown): $")
        count = ask_count("  exact stock count if displayed (blank if not shown): ")
        pickup_raw = input("  pickup available? [y/n/u]: ").strip().lower()
        pickup = {"y": True, "n": False, "u": None, "": None}.get(pickup_raw)
        row = {
            "store_id": store_id,
            "stock": stock,
            "stock_count": count,
            "price": price,
            "regular_price": regular_price,
            "price_type": "sale" if price is not None and regular_price is not None and price < regular_price else "regular",
            "pickup_available": pickup,
            "checked_on": checked_on if stock != "Unknown" else None,
            "product_source": product["url"],
            "availability_source": product["url"] if stock != "Unknown" else None,
            "price_source": product["url"] if price is not None else None,
        }
        if direct_no_listing:
            row["availability_evidence"] = "direct_product_store_search_no_listing"
            row["availability_note"] = "The exact item was searched for at this selected store and no listing was returned; treated as not stocked per user guidance."
        rows.append(row)
    return {
        "product_id": product["id"],
        "product_name": med["name"],
        "catalog_strength": med.get("strength"),
        "catalog_quantity": med.get("quantity_label"),
        "product_url": product["url"],
        "identity_confirmed": True,
        "checked_on": checked_on,
        "stores": rows,
    }


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        data, catalog = load_inputs(Path(sys.argv[1]), Path(sys.argv[2]))
        stores = choose_stores(data)
        if not stores:
            print("No stores selected.")
            return 0
        products = choose_products(data, med_map(catalog), {store["id"] for store in stores})
        observations = []
        for product in products:
            record = capture_product(product, stores)
            if record:
                observations.append(record)
        if not observations:
            print("No observations captured.")
            return 0
        print("\nReview summary:")
        for record in observations:
            print(f"\n{record['product_name']} [{record['product_id']}]")
            for row in record["stores"]:
                print(f"  {row['store_id']}: {row['stock']}; count={row['stock_count']}; price={row['price']}")
        if input("\nSave this separate candidate file? Type SAVE to confirm: ").strip() != "SAVE":
            print("Discarded; no file written.")
            return 0
        output = Path.cwd() / f"walgreens-capture-candidate-{date.today().isoformat()}.json"
        payload = {
            "source": "Visible Walgreens/Duane Reade product and selected-store pages, manually reviewed",
            "generated_on": date.today().isoformat(),
            "reviewed_before_write": True,
            "merge_into_walgreens_data": False,
            "observations": observations,
        }
        output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Saved separate review candidate: {output}")
        print("Reconcile and review the candidate before merging into walgreens-data.json.")
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
