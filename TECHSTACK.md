# Tech Stack — Pharmacy Searcher (HackRU 2026)

## Overview
All-TypeScript Next.js app, self-hosted on a Proxmox Linux VM, exposed via Cloudflare Tunnel on our `.tech` domain.

## Frontend
| Tool | Purpose |
|---|---|
| **Next.js (App Router) + TypeScript** | UI + API routes in one app |
| **Vanilla CSS** | Styling, mobile-responsive layout |
| **Leaflet + react-leaflet** | Map; OpenStreetMap / CARTO tiles (HTTPS, no API key) |
| **Fuse.js** | Client-side fuzzy autocomplete over drug list |
| **Browser Geolocation API** | Current location (requires HTTPS — provided by Cloudflare) |
| **Nominatim** | Address → lat/lng fallback when location is denied |

## Backend (Next.js API routes)
| Route | Input | Output |
|---|---|---|
| `POST /api/search` | `SearchRequest` | `SearchResult[]` (ranked) |
| `POST /api/chat` | `{ messages }` | `{ reply, suggestions: { drugId, name, reason }[] }` |

| Tool | Purpose |
|---|---|
| **SQLite** (`better-sqlite3`) | Pharmacies, drugs, inventory, transit stops |
| **turf.js / haversine** | Distances, radius checks, nearest transit stop |
| **`@google/genai` (Gemini)** | Help chatbot; structured JSON output constrained to our drug list. Server-side only. |

## Data Sources
| Data | Source | Notes |
|---|---|---|
| Pharmacy locations | **OpenStreetMap Overpass API** (`amenity=pharmacy`, NJ) | Includes lat/lng. Pulled once → DB. (NPI Registry = "production" source in pitch.) |
| Transit stops | **NJ Transit GTFS static feed** (`stops.txt`) | Bus + rail stops with coordinates |
| Drug names | Hardcoded JSON (~150 drugs) | Generic + brand names + strengths |
| Stock / prices | **Simulated** via seed script | Fixed random seed → deterministic demo |

## Data Model
```
pharmacies(id, name, lat, lng, address, chain)
drugs(id, generic_name, brand_names, strengths)
inventory(pharmacy_id, drug_id, strength, in_stock, quantity, price, last_updated)
transit_stops(id, name, lat, lng, type)   -- type: bus | rail
```

## Core Logic (constants — tune together, don't change silently)
**Transport modes (MVP):** walk, transit, car (bike = stretch).

| Constant | Value |
|---|---|
| Walk speed | 3 mph |
| Max comfortable walk | 0.5 mi |
| Max walk to transit stop | 0.4 mi |
| Bus speed (avg) | 20 mph |
| Train speed (avg) | 35 mph |
| Avg transit wait | 10 min |
| Max car distance | 15 mi |
| Bus fare | ~$2–4 (hardcoded) |
| Train fare | ~$5–10 (hardcoded) |
| Car cost | $0.70 / mi |

**Transit ETA (heuristic):**
`walk to stop + avg wait + ride (straight-line ÷ mode speed) + walk from stop`

**Ranking:**
`score = w1·inStock + w2·(1/totalCost) + w3·(1/etaMin) + w4·reachableByPreferredMode`
Out-of-stock results filtered out or pushed to bottom. `totalCost = rxPrice + travelCost`.

## Shared Contract
`lib/types.ts` is the source of truth for `Pharmacy`, `Drug`, `InventoryRow`, `SearchRequest`, `SearchResult`, `Mode`. **Don't change it without telling the team.**

## Infrastructure
| Piece | Choice |
|---|---|
| Host | Proxmox VM (Ubuntu/Debian), Node 20+ |
| Process manager | pm2 (`pm2 startup` + `pm2 save`) |
| Public access | Cloudflare Tunnel (`cloudflared` as systemd service) → `localhost:3000` |
| Domain | `.tech` domain, nameservers on Cloudflare |
| Deploy | `deploy.sh`: `git pull && npm ci && npm run build && pm2 restart pharm` |
| Secrets | `.env` on VM only (`GEMINI_API_KEY`); `.env.example` committed |
| Team access | VS Code Live Share; fallback: per-person SSH keys, each person edits only their owned files |
| Backup | Proxmox snapshot after setup; app runnable locally on a laptop; pre-recorded demo video |

## Dev Tooling
- **Claude Code**: multi-file features, refactors
- **Codex**: isolated tasks (data scripts, tests, single modules)
- **Gemini**: in-product chatbot + quick lookups
- `CLAUDE.md` + `AGENTS.md` (identical) give agents the stack, folder ownership, and constants above

## Folder Ownership
| Person | Owns |
|---|---|
| **A: Data + engine** | `scripts/`, `data/`, `lib/engine/`, `app/api/search/` |
| **B: Map + UI** | `app/page.tsx`, `components/` (except chat) |
| **C: Gemini + infra + pitch** | `app/api/chat/`, `components/chat/`, `deploy.sh`, VM/tunnel/domain, Devpost |

## Out of Scope (post-hackathon)
Real NJ Transit realtime API / true transit routing, Google Maps business info, crowdsourced corrections, insurance/copay (Plaid), user accounts, PWA/mobile app.
