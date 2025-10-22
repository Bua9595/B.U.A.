# B.U.A Marketplace

A modern, multi-chain NFT marketplace UI and minimal API server. It ships with:

- Name search with suggestions (no API key) via CoinGecko
- On-chain EVM reader (no API key) to fetch real NFTs by contract address
- Optional Reservoir proxy for cross-market data when an API key is available
- Clean, responsive UI with filters, sorting, modal item view, and wallet stub

## Quick Start

- Requirements: Node.js >= 16
- Clone this repo, then:

```
cp .env.example .env   # on Windows: copy .env.example .env
npm start
```

Open `http://localhost:3000/marketplace.html`

## Environment

All secrets/config live in `.env` (ignored by Git). See `.env.example`.

- `PORT` — server port (default 3000)
- `RESERVOIR_API_KEY` — optional; enables Reservoir aggregation
- `RESERVOIR_API` — optional; default `https://api.reservoir.tools`
- `RPC_ETH`, `RPC_BASE`, `RPC_POLYGON` — public RPC URLs (replace with your own)

This project loads `.env` automatically in development (no external packages).

## UI Overview

- Top search bar: type a collection name and pick a suggestion; or paste a `0x...` contract and press Enter
- Chain chips: Ethereum, Base, Polygon (auto-selected from search suggestions when possible)
- Filters: Buy Now, Verified, price range, sort options
- Click a card to open the item modal

## Server Endpoints

All endpoints are served by `index.server.js`.

- CoinGecko proxy (public, no key)
  - `GET /api/cg/search?query=...` — name suggestions (includes NFT contracts)
  - `GET /api/cg/nfts/markets?asset_platform_id=ethereum|polygon-pos&...` — trending collections

- EVM on-chain reader (public RPC, no key)
  - `GET /api/evm/collection/info?address=0x...&chainId=1|8453|137`
  - `GET /api/evm/collection/tokens?address=0x...&chainId=...&start=0&limit=24`
    - Fallback for non-enumerable ERC-721: add `&scan=1` to scan mint events in recent block windows
    - Optional tuning: `&window=5000` (blocks per window), `&maxBack=100000`

- Reservoir proxy (optional; requires API key)
  - `GET /api/reservoir/*` — forwards to Reservoir with `x-api-key` and optional `x-chain-id`

## How Data Loads

1) Explore page
- Tries Reservoir collections (if key set)
- Falls back to CoinGecko NFT markets for Ethereum/Polygon

2) Collection view
- If URL is a Reservoir collection ID ? loads via Reservoir tokens API
- If URL is a `0x...` address ? loads via on-chain reader (`tokenURI` + metadata/IPFS)

## Security Notes

- Keep `.env` out of Git (already ignored)
- Prefer your own RPC endpoints over public ones
- Add rate limiting and caching (e.g., Redis) for production traffic

## Roadmap

- Solana integration (Magic Eden/Helius)
- Wallet + Trading (wagmi + viem, Seaport/Reservoir Execute)
- Trait filters, rarity ranks, activity feeds
- Server-side caching and pagination

## Scripts

- `npm start` — runs the static server + API at the chosen `PORT`

## License

Private, all rights reserved (adjust as needed).