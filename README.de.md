# B.U.A Marketplace – Deutsch

Ein moderner, mehrkettiger (EVM) NFT‑Marketplace (UI + minimaler API‑Server). Ziel ist eine schnelle, lokale Demo ohne externe Abhängigkeiten für das Laden von `.env` und mit optionaler Einbindung externer Marktdaten.

## Funktionen
- Namenssuche mit Vorschlägen (ohne API‑Key) via CoinGecko
- On‑Chain‑Reader für EVM (ohne API‑Key): echte NFTs per Contract‑Adresse laden
- Optionaler Reservoir‑Proxy (mit API‑Key) für Cross‑Market‑Daten
- Schlanke, responsive UI mit Filtern, Sortierung, Item‑Modal und Wallet‑Stub

## Schnellstart
Voraussetzung: Node.js ≥ 16

```
cp .env.example .env   # Windows: copy .env.example .env
npm start
```

Dann öffnen: `http://localhost:3000/marketplace.html`

## Umgebung (.env)
Alle Konfigurationen/Secrets liegen in `.env` (durch `.gitignore` geschützt). Beispielwerte in `.env.example`.

- `PORT` – Server‑Port (Standard 3000)
- `RESERVOIR_API_KEY` – optional; aktiviert Aggregation über Reservoir
- `RESERVOIR_API` – optional; Standard `https://api.reservoir.tools`
- `RPC_ETH`, `RPC_BASE`, `RPC_POLYGON` – öffentliche RPC‑URLs (ggf. eigene Endpoints verwenden)

Im Development wird `.env` automatisch geladen (keine zusätzliche Lib nötig).

## UI Überblick
- Suchleiste: Namen eingeben und Vorschlag wählen; oder `0x…` Contract einfügen und Enter
- Chain‑Chips: Ethereum, Base, Polygon (automatische Auswahl, sofern möglich)
- Filter: Buy Now, Verified, Preisspanne, Sortierung
- Karten‑Klick öffnet Item‑Modal

## API Endpunkte (lokaler Server)
Bereitgestellt von `index.server.js`.

- CoinGecko‑Proxy (öffentlich, kein Key)
  - `GET /api/cg/search?query=...` – Namensvorschläge (inkl. NFT‑Contracts)
  - `GET /api/cg/nfts/markets?asset_platform_id=ethereum|polygon-pos&...` – Trends

- EVM On‑Chain Reader (öffentliche RPCs, kein Key)
  - `GET /api/evm/collection/info?address=0x...&chainId=1|8453|137`
  - `GET /api/evm/collection/tokens?address=0x...&chainId=...&start=0&limit=24`
    - Fallback für nicht‑enumerierbare ERC‑721: `&scan=1`
    - Tuning: `&window=5000` (Blöcke pro Fenster), `&maxBack=100000`

- Reservoir‑Proxy (optional, Key benötigt)
  - `GET /api/reservoir/*` – Weiterleitung mit `x-api-key` und optional `x-chain-id`

## Sicherheit
- `.env` niemals committen – ist bereits in `.gitignore`
- Eigene RPC‑Endpoints bevorzugen (stabiler/performanter)
- Für Produktion: Rate‑Limiting und Caching (z. B. Redis) ergänzen

## Roadmap (Kurzfassung)
- Solana‑Integration (Magic Eden/Helius)
- Wallet + Trading (wagmi + viem, Seaport/Reservoir Execute)
- Trait‑Filter, Rarity‑Ranks, Activity‑Feeds
- Server‑seitiges Caching und Pagination

Ausführlich: siehe `docs/ROADMAP.md`.

## CI‑Varianten (was möglich ist)
- Lint & Format
  - ESLint (JavaScript), optional Prettier für Format
  - Reichweite: Stil‑ und Qualitäts‑Checks; schneller, wenige Minuten
  - Wirkung: kann non‑blocking (Warnungen) oder blocking (Fehler brechen Build) sein
- Typprüfung
  - TypeScript (falls TS) oder JS‑Type‑Checks (z. B. `tsc --checkJs` mit JSDoc)
  - Reichweite: entdeckt viele Klasse‑/Objekt‑Fehler vor Laufzeit
- Unit‑/API‑Tests
  - Vitest/Jest + Supertest für Endpunkte
  - Wirkung: Absicherung von Kernlogik, Build kann bei Fehlschlag blocken
- E2E/Browser‑Tests
  - Playwright/Cypress gegen `public/` (Navigieren, Filtern, Modal öffnen)
  - Reichweite: hohe Aussagekraft, aber längere Laufzeit
- Security/Quality
  - `npm audit`/`audit-ci`, `license-checker`, Secret‑Scan (gitleaks/GitHub Secret Scanning), CodeQL
  - Wirkung: findet Abhängigkeitsrisiken/Leaks; kann false positives liefern (konfigurierbar)
- Performance
  - Lighthouse CI für `marketplace.html` (Budgets/Regressions)
  - Wirkung: hält UI‑Qualität stabil, dauert einige Minuten
- Build/Release
  - Z. B. Docker‑Build/Publish (falls benötigt), Tagging, Release Notes

Aktueller Stand: keine CI aktiviert. Empfehlung fürs Erste:
1) ESLint (blocking) + `npm audit` (non‑blocking)
2) Syntax‑Check (`node -c` Äquivalent via `eslint --no-eslintrc --rule 'no-undef:2'`/`tsc`)
3) 1–2 Playwright‑Flows (optional), später ausbauen

## Lizenz
Privat (anpassen, falls gewünscht).

