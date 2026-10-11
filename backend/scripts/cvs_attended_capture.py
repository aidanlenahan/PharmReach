#!/usr/bin/env python3
"""Attended CVS product/store capture helper.

Opens official CVS product pages in the default browser, then asks the operator
to review the visible product and Check more stores panel and enter the results.
It does not inspect page DOM, call CVS APIs, or modify the PharmReach datasets.

Usage:
  python3 cvs_attended_capture.py /path/to/backend/data/cvs-data.json

The output is a standalone review file named cvs-capture-candidate-YYYYMMDD.json
in the current directory. It is not merged into cvs-data.json automatically.
"""

from __future__ import annotations

import json
import sys
import webbrowser
from datetime import date
from pathlib import Path


def load_data(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("medications"), list):
        raise ValueError("Expected a cvs-data.json with a medications list")
    if not isinstance(data.get("pharmacies"), list):
        raise ValueError("Expected a pharmacies list")
    if not isinstance(data.get("inventory"), dict):
        raise ValueError("Expected an inventory map")
    return data


def get_products(data: dict) -> list[dict]:
    products = []
    for med in data["medications"]:
        url = med.get("product_source") or med.get("price_source")
        if med.get("id") and med.get("name") and url and url.startswith("https://www.cvs.com/"):
            products.append(med)
    return products


def choose_unknown_stores(data: dict) -> list[dict]:
    counts = {}
    for pharmacy in data["pharmacies"]:
        store_id = pharmacy.get("id")
        if not store_id:
            continue
        counts[store_id] = sum(
            1
            for medication in data["medications"]
            if data["inventory"].get(medication["id"], {}).get(store_id, {}).get("stock") == "Unknown"
        )
    stores = [store for store in data["pharmacies"] if counts.get(store.get("id"), 0)]
    stores.sort(key=lambda store: (-counts[store["id"]], store.get("name", ""), store.get("address", "")))
    print("\nCVS stores with Unknown inventory, most gaps first:")
    for i, store in enumerate(stores, 1):
        print(f"{i:>2}. {store.get('name', 'CVS')} — {store.get('address', store['id'])} ({counts[store['id']]} products)")
    raw = input("\nStore numbers (comma-separated, or 'all'; q to quit): ").strip().lower()
    if raw == "q":
        return []
    if raw == "all":
        return stores
    try:
        indexes = [int(part.strip()) - 1 for part in raw.split(",") if part.strip()]
        if not indexes or any(index < 0 or index >= len(stores) for index in indexes):
            raise ValueError
        return [stores[index] for index in dict.fromkeys(indexes)]
    except ValueError as exc:
        raise ValueError("Enter valid store numbers, 'all', or 'q'") from exc


def choose_products(products: list[dict], inventory: dict, store_ids: set[str]) -> list[dict]:
    eligible = [
        product for product in products
        if any(inventory.get(product["id"], {}).get(store_id, {}).get("stock") == "Unknown" for store_id in store_ids)
    ]
    eligible.sort(
        key=lambda product: (
            -sum(inventory.get(product["id"], {}).get(store_id, {}).get("stock") == "Unknown" for store_id in store_ids),
            product["name"].casefold(),
        )
    )
    if not eligible:
        print("\nNo Unknown product/store pairs remain at the selected stores.")
        return []
    print("\nProducts still Unknown at the selected store(s), most coverage first:")
    for i, product in enumerate(eligible, 1):
        count = sum(inventory.get(product["id"], {}).get(store_id, {}).get("stock") == "Unknown" for store_id in store_ids)
        print(f"{i:>2}. {product['name']} [{product['id']}] — {count} selected store(s)")
    raw = input("\nProduct numbers (comma-separated, or 'all'; q to quit): ").strip().lower()
    if raw == "q":
        return []
    if raw == "all":
        return eligible
    try:
        indexes = [int(part.strip()) - 1 for part in raw.split(",") if part.strip()]
        if not indexes or any(index < 0 or index >= len(eligible) for index in indexes):
            raise ValueError
        return [eligible[index] for index in dict.fromkeys(indexes)]
    except ValueError as exc:
        raise ValueError("Enter valid product numbers, 'all', or 'q'") from exc


def ask_price(prompt: str) -> float | None:
    raw = input(prompt).strip().replace("$", "")
    if not raw:
        return None
    try:
        amount = round(float(raw), 2)
        if amount < 0:
            raise ValueError
        return amount
    except ValueError as exc:
        raise ValueError("Enter a nonnegative price, or leave blank") from exc


def capture_product(product: dict, pharmacies: list[dict], inventory: dict) -> dict | None:
    print("\n" + "=" * 72)
    print(f"Product: {product['name']} [{product['id']}]")
    print(f"Page: {product.get('product_source') or product.get('price_source')}")
    if input("Open this official CVS product page? [Y/n] ").strip().lower() == "n":
        return None
    url = product.get("product_source") or product.get("price_source")
    webbrowser.open_new_tab(url)
    input("Review the visible product identity and open 'Check more stores'. Press Enter when ready...")
    identity = input("Does the selected size/form match this catalog item? [y/n/skip] ").strip().lower()
    if identity == "skip":
        return None
    if identity != "y":
        print("Skipped: confirm or correct product mapping before collecting store data.")
        return None

    checked_on = input(f"Observation date [{date.today().isoformat()}]: ").strip() or date.today().isoformat()
    shared_price = ask_price("Displayed CVS price for this selected item (blank if unclear): $")
    print("\nFor each branch, enter only what the visible CVS UI showed.")
    print("i = In stock, o = explicitly says out of stock, n = direct product/store search returned no listing")
    print("u = not checked, blocked, or unclear; s = stop this product")
    print("Policy: a direct search for this exact product at a selected store with no listing is treated as not stocked (Out of stock).\n")

    stores = []
    for pharmacy in pharmacies:
        store_id = pharmacy.get("id")
        if not store_id or inventory.get(product["id"], {}).get(store_id, {}).get("stock") != "Unknown":
            continue
        print(f"{pharmacy.get('name', 'CVS')} — {pharmacy.get('address', store_id)} [{store_id}]")
        status_input = input("  status [i/o/n/u/s]: ").strip().lower()
        if status_input == "s":
            break
        no_listing = status_input == "n"
        status = {"i": "In stock", "o": "Out of stock", "n": "Out of stock", "u": "Unknown"}.get(status_input)
        if status is None:
            print("  Unrecognized entry; recording Unknown.")
            status = "Unknown"
        price = ask_price("  observed price for this branch (Enter = use product price): $")
        if price is None:
            price = shared_price
        source = url if status != "Unknown" or price is not None else None
        row = {
            "store_id": store_id,
            "price": price,
            "stock": status,
            "checked_on": checked_on if status != "Unknown" else None,
            "availability_source": source if status != "Unknown" else None,
            "price_source": url if price is not None else None,
        }
        if no_listing:
            row["availability_evidence"] = "direct_product_store_search_no_listing"
            row["availability_note"] = (
                "The exact product was searched for at this selected store and no listing was returned; "
                "treated as not stocked per user guidance."
            )
        stores.append(row)

    return {
        "product_id": product["id"],
        "product_name": product["name"],
        "product_url": url,
        "identity_confirmed": True,
        "checked_on": checked_on,
        "stores": stores,
    }


def review(captures: list[dict]) -> bool:
    print("\n" + "=" * 72)
    print("Review candidate observations before saving:")
    for capture in captures:
        print(f"\n{capture['product_name']} [{capture['product_id']}]")
        for store in capture["stores"]:
            evidence = f"; evidence={store['availability_evidence']}" if store.get("availability_evidence") else ""
            print(f"  {store['store_id']}: {store['stock']}; price={store['price']}{evidence}")
    return input("\nSave this separate candidate JSON? Type SAVE to confirm: ").strip() == "SAVE"


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        data = load_data(Path(sys.argv[1]).expanduser())
        stores = choose_unknown_stores(data)
        store_ids = {store["id"] for store in stores}
        products = choose_products(get_products(data), data["inventory"], store_ids) if store_ids else []
        captures = []
        for product in products:
            result = capture_product(product, stores, data["inventory"])
            if result:
                captures.append(result)
        if not captures:
            print("No observations captured.")
            return 0
        if not review(captures):
            print("Discarded; no file written.")
            return 0
        output = Path.cwd() / f"cvs-capture-candidate-{date.today().isoformat()}.json"
        payload = {
            "source": "CVS public product pages, manually reviewed in visible browser",
            "generated_on": date.today().isoformat(),
            "reviewed_before_write": True,
            "merge_into_cvs_data": False,
            "observations": captures,
        }
        output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Saved separate review candidate: {output}")
        print("Inspect and reconcile it before any manual merge into cvs-data.json.")
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
