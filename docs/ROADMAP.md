# Roadmap – B.U.A Marketplace

Diese Roadmap beschreibt sinnvolle Ausbaustufen. Zeitangaben sind grob.

## Phase 1 – Stabilisieren (Kurzfristig)
- Fehler‑Handling im API‑Server (Timeouts, Rate‑Limits, CORS‑Header feinjustieren)
- Caching‑Layer (in‑Memory) für häufige CoinGecko/Reservoir‑Antworten
- UI‑Polish: Ladeindikatoren, leere Zustände, Abbruch bei parallelen Requests
- Grundlegende CI: ESLint (blocking) + Syntax‑Check, `npm audit` (non‑blocking)

## Phase 2 – Features (Kurz‑/Mittelfristig)
- Wallet‑Stub → echte Wallet‑Integration (wagmi + viem)
- Kauf/Listing‑Flow über Reservoir Execute/Seaport
- Trait‑Filter, Rarity‑Ranks, Activity‑Feeds
- Server‑seitige Pagination und HTTP‑Caching (ETag/Last‑Modified)

## Phase 3 – Performance & DX
- Lighthouse CI für `marketplace.html` (Budget für LCP/CLS/TBT)
- Server‑seitiges Caching (Redis) inkl. invalidation
- Bundle‑Optimierung (falls später Build‑Step eingeführt wird)

## Phase 4 – Chains & Ökosystem
- Solana‑Integration (Magic Eden/Helius)
- Optional: weitere EVM‑Chains (Arbitrum, Optimism), stabile RPCs via Provider
- Monitoring/Observability (OpenTelemetry, zentralisierte Logs)

## Optional – Sicherheit
- Secret‑Scanning & Leaks (gitleaks/GH‑AS), Abhängigkeits‑Checks (`audit-ci`)
- CodeQL‑Analyse (JavaScript)
- Threat‑Model für Proxy‑Endpunkte (Rate Limit, Allow‑Lists)

## Offene Fragen
- Anforderungen an Trading (nur Lesen vs. Kaufen/Listen?)
- Hosting/Deployment‑Ziel (Vercel/Netlify/Docker)
- Benötigte Datenquellen (Reservoir only vs. gemischt)

