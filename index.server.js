const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Lightweight .env loader (no dependency). Only for local/dev.
// Loads KEY=VALUE pairs from .env at project root if NODE_ENV !== 'production'.
try {
  if (process.env.NODE_ENV !== 'production') {
    const ENV_PATH = path.join(__dirname, '.env');
    if (fs.existsSync(ENV_PATH)) {
      const raw = fs.readFileSync(ENV_PATH, 'utf8');
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      });
    }
  }
} catch (e) {
  // ignore env loading errors in production
}

const ENV_PORT = process.env.PORT ? Number(process.env.PORT) : undefined;
const BASE_PORT = Number.isFinite(ENV_PORT) ? ENV_PORT : 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const RESERVOIR_API = process.env.RESERVOIR_API || 'https://api.reservoir.tools';
const RESERVOIR_API_KEY = process.env.RESERVOIR_API_KEY || '';
const RPC_URLS = {
  1: process.env.RPC_ETH || 'https://cloudflare-eth.com',
  8453: process.env.RPC_BASE || 'https://mainnet.base.org',
  137: process.env.RPC_POLYGON || 'https://polygon-rpc.com'
};
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded).replace(/^\\+|^\/+/, '');
  const finalPath = path.join(base, normalized);
  if (!finalPath.startsWith(base)) return null; // path traversal guard
  return finalPath;
}

function sendError(res, code, message) {
  res.writeHead(code, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(message);
}

// ---- Simple helpers ----
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

function httpFetchJson(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: { 'user-agent': 'bua-marketplace/0.1', ...headers }
    }, (resp) => {
      let data = '';
      resp.setEncoding('utf8');
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpFetchRaw(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: { 'user-agent': 'bua-marketplace/0.1', ...headers }
    }, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      resp.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function jsonRpc(chainId, method, params) {
  const rpc = RPC_URLS[Number(chainId)];
  if (!rpc) throw new Error('Unsupported chainId');
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const u = new url.URL(rpc);
  const isHttps = u.protocol === 'https:';
  const mod = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'user-agent': 'bua-marketplace/0.1'
      }
    }, (resp) => {
      let data = '';
      resp.setEncoding('utf8');
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message || 'RPC Error'));
          resolve(json.result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

function pad32Hex(bi) {
  const hex = bi.toString(16);
  return hex.padStart(64, '0');
}

function encodeUint256Hex(n) { return pad32Hex(BigInt(n)); }

function decodeUint256(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const slice = clean.slice(0, 64);
  return BigInt('0x' + slice);
}

function decodeString(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const buf = Buffer.from(clean, 'hex');
  if (buf.length < 64) return '';
  let offset = Number(BigInt('0x' + buf.subarray(0, 32).toString('hex')));
  if (!Number.isFinite(offset) || offset === 0) offset = 32; // common case
  const len = Number(BigInt('0x' + buf.subarray(offset, offset + 32).toString('hex')));
  const start = offset + 32;
  return buf.subarray(start, start + len).toString('utf8');
}

const SELECTOR = {
  name: '06fdde03',
  symbol: '95d89b41',
  totalSupply: '18160ddd',
  tokenByIndex: '4f6ccce7',
  tokenURI: 'c87b56dd',
  ownerOf: '6352211e'
};

async function ethCall(chainId, to, dataHex) {
  const callObj = { to, data: dataHex };
  return jsonRpc(chainId, 'eth_call', [callObj, 'latest']);
}

function toChecksum(addr){
  try{ return addr; }catch{ return addr; }
}

function isHexAddress(s){ return /^0x[a-fA-F0-9]{40}$/.test(s || ''); }

function ipfsToHttp(uri) {
  if (!uri) return uri;
  if (uri.startsWith('ipfs://ipfs/')) return 'https://ipfs.io/' + uri.slice('ipfs://'.length);
  if (uri.startsWith('ipfs://')) return 'https://ipfs.io/ipfs/' + uri.slice('ipfs://'.length);
  return uri;
}

async function fetchTokenMetadata(tokenUri) {
  const urlHttp = ipfsToHttp(tokenUri);
  if (!urlHttp) return null;
  try {
    const raw = await httpFetchRaw(urlHttp, { accept: 'application/json' });
    const txt = raw.toString('utf8');
    try { return JSON.parse(txt); } catch { return null; }
  } catch { return null; }
}

async function handleEvmApi(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';
  if (!pathname.startsWith('/api/evm/')) return false;

  const qp = parsed.query || {};
  const chainId = Number(qp.chainId || '1');
  if (!RPC_URLS[chainId]) return sendJSON(res, 400, { error: 'Unsupported chainId' });

  if (pathname === '/api/evm/collection/info') {
    const address = String(qp.address || '').toLowerCase();
    if (!isHexAddress(address)) return sendJSON(res, 400, { error: 'Invalid address' });
    try {
      const nameHex = await ethCall(chainId, address, '0x' + SELECTOR.name);
      const symbolHex = await ethCall(chainId, address, '0x' + SELECTOR.symbol);
      const totalHex = await ethCall(chainId, address, '0x' + SELECTOR.totalSupply);
      let enumerable = true;
      try { await ethCall(chainId, address, '0x' + SELECTOR.tokenByIndex + pad32Hex(0n)); } catch { enumerable = false; }
      const info = {
        address: toChecksum(address),
        name: decodeString(nameHex),
        symbol: decodeString(symbolHex),
        totalSupply: decodeUint256(totalHex).toString(),
        enumerable
      };
      return sendJSON(res, 200, info);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Failed to read contract' });
    }
  }

  if (pathname === '/api/evm/collection/tokens') {
    const address = String(qp.address || '').toLowerCase();
    const start = Math.max(0, Number(qp.start || 0));
    const limit = Math.min(50, Math.max(1, Number(qp.limit || 24)));
    if (!isHexAddress(address)) return sendJSON(res, 400, { error: 'Invalid address' });
    try {
      const totalHex = await ethCall(chainId, address, '0x' + SELECTOR.totalSupply);
      const total = Number(decodeUint256(totalHex));
      const end = Math.min(total, start + limit);
      const items = [];
      let enumerableFailed = false;
      for (let i = start; i < end; i++) {
        try {
          const idxHex = '0x' + SELECTOR.tokenByIndex + encodeUint256Hex(i);
          const tokenIdHex = await ethCall(chainId, address, idxHex);
          const tokenId = BigInt('0x' + String(tokenIdHex).slice(2));
          const uriHex = await ethCall(chainId, address, '0x' + SELECTOR.tokenURI + encodeUint256Hex(tokenId));
          const tokenUri = decodeString(uriHex);
          const meta = await fetchTokenMetadata(tokenUri);
          const image = ipfsToHttp(meta?.image || meta?.image_url || meta?.image_url_png || '');
          const name = meta?.name || `#${tokenId.toString()}`;
          items.push({
            kind: 'token',
            id: tokenId.toString(),
            name,
            image,
            chain: chainId === 8453 ? 'BASE' : (chainId === 137 ? 'POLYGON' : 'ETH'),
            verified: true,
            priceEth: null,
            collection: address,
            collectionName: undefined,
            attributes: Array.isArray(meta?.attributes) ? meta.attributes : []
          });
        } catch (e) {
          enumerableFailed = true;
          break;
        }
      }

      if (items.length === 0 && (enumerableFailed || qp.scan === '1')) {
        // Fallback: scan recent mint events (Transfer from 0x0)
        const latestHex = await jsonRpc(chainId, 'eth_blockNumber', []);
        const latest = Number(BigInt(latestHex));
        const window = Math.min(5000, Number(qp.window || 5000));
        const maxBack = Math.min(200000, Number(qp.maxBack || 100000));
        const collected = new Set();
        let collectedItems = [];
        for (let from = latest - window; from > latest - maxBack && collectedItems.length < limit; from -= window) {
          const to = from + window;
          try {
            const logs = await jsonRpc(chainId, 'eth_getLogs', [{
              fromBlock: '0x' + from.toString(16),
              toBlock: '0x' + to.toString(16),
              address,
              topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                '0x0000000000000000000000000000000000000000000000000000000000000000'
              ]
            }]);
            for (const log of logs || []) {
              const topics = log.topics || [];
              const idHex = topics[3];
              if (!idHex) continue;
              const tokenId = BigInt(idHex);
              const key = tokenId.toString();
              if (collected.has(key)) continue;
              collected.add(key);
              try {
                const uriHex = await ethCall(chainId, address, '0x' + SELECTOR.tokenURI + encodeUint256Hex(tokenId));
                const tokenUri = decodeString(uriHex);
                const meta = await fetchTokenMetadata(tokenUri);
                const image = ipfsToHttp(meta?.image || meta?.image_url || '');
                const name = meta?.name || `#${key}`;
                collectedItems.push({
                  kind: 'token', id: key, name, image,
                  chain: chainId === 8453 ? 'BASE' : (chainId === 137 ? 'POLYGON' : 'ETH'),
                  verified: true, priceEth: null, collection: address,
                  attributes: Array.isArray(meta?.attributes) ? meta.attributes : []
                });
                if (collectedItems.length >= limit) break;
              } catch {}
            }
          } catch {}
        }
        return sendJSON(res, 200, { items: collectedItems, total: collectedItems.length, fallback: 'scan' });
      }

      return sendJSON(res, 200, { items, total });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Failed to enumerate tokens' });
    }
  }

  sendError(res, 404, 'Not Found');
  return true;
}

function proxyReservoir(req, res) {
  const parsed = url.parse(req.url, true);
  const prefix = '/api/reservoir/';
  if (!parsed.pathname.startsWith(prefix)) return false;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 405, 'Method Not Allowed');
    return true;
  }

  const restPath = parsed.pathname.slice(prefix.length); // everything after prefix
  const searchParams = new url.URLSearchParams(parsed.query);
  const chainId = searchParams.get('chainId');
  // Remove chainId from query so it is not forwarded as query param (optional)
  if (chainId) searchParams.delete('chainId');

  const upstreamPath = `/${restPath}${searchParams.toString() ? ('?' + searchParams.toString()) : ''}`;

  const upstreamUrl = new url.URL(RESERVOIR_API);
  const options = {
    protocol: upstreamUrl.protocol,
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || 443,
    path: upstreamPath,
    method: req.method,
    headers: {
      'accept': req.headers['accept'] || 'application/json',
      'user-agent': 'bua-marketplace/0.1',
      'x-api-key': RESERVOIR_API_KEY
    }
  };
  if (chainId) options.headers['x-chain-id'] = chainId;

  const upstream = https.request(options, (up) => {
    // Forward status and headers (filter hop-by-hop)
    const headers = Object.assign({}, up.headers);
    delete headers['transfer-encoding'];
    delete headers['connection'];
    res.writeHead(up.statusCode || 500, headers);
    up.pipe(res);
  });

  upstream.on('error', () => {
    sendError(res, 502, 'Upstream Error');
  });

  upstream.end();
  return true;
}

function proxyCoinGecko(req, res) {
  const parsed = url.parse(req.url, true);
  const prefix = '/api/cg/';
  if (!parsed.pathname.startsWith(prefix)) return false;

  const rest = parsed.pathname.slice(prefix.length);
  // allow only specific endpoints for safety
  if (rest !== 'search' && rest !== 'nfts/markets') {
    return sendError(res, 404, 'Not Found');
  }

  const qs = new url.URLSearchParams(parsed.query).toString();
  const target = `${COINGECKO_API}/${rest}?${qs}`;
  https.get(target, { headers: { 'user-agent': 'bua-marketplace/0.1', 'accept': 'application/json' } }, (up) => {
    res.writeHead(up.statusCode || 500, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, up.headers));
    up.pipe(res);
  }).on('error', () => sendError(res, 502, 'Upstream Error'));
  return true;
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url);
    let pathname = parsed.pathname || '/';

    // API proxy: Reservoir (EVM NFT aggregator)
    if (pathname.startsWith('/api/reservoir/')) {
      if (proxyReservoir(req, res)) return; // handled
    }
    // API proxy: CoinGecko (public, no key) for name search and markets
    if (pathname.startsWith('/api/cg/')) {
      if (proxyCoinGecko(req, res)) return; // handled
    }
    // API: EVM on-chain reader (no API key required)
    if (pathname.startsWith('/api/evm/')) {
      handleEvmApi(req, res); return;
    }

    if (pathname === '/' || pathname.endsWith('/')) pathname = pathname + 'index.html';

    const safePath = safeJoin(PUBLIC_DIR, pathname);
    if (!safePath) {
      return sendError(res, 400, 'Bad Request');
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        return sendError(res, 404, 'Not Found');
      }

      const ext = path.extname(safePath).toLowerCase();
      const type = mimeTypes[ext] || 'application/octet-stream';

      const headers = {
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': ext === '.html' || ext === '.htm' ? 'no-cache' : 'public, max-age=3600'
      };

      res.writeHead(200, headers);
      const stream = fs.createReadStream(safePath);
      stream.on('error', () => sendError(res, 500, 'Server Error'));
      stream.pipe(res);
    });
  } catch (e) {
    sendError(res, 500, 'Server Error');
  }
});

function listenWithFallback(port, attemptsLeft = 10) {
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const next = port + 1;
      console.warn(`Port ${port} in use, retrying on ${next} ...`);
      // Remove the error listener before retry
      server.removeAllListeners('error');
      listenWithFallback(next, attemptsLeft - 1);
    } else {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}`);
  });
}

listenWithFallback(BASE_PORT);
