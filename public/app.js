document.addEventListener('DOMContentLoaded', () => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const API = { reservoir: '/api/reservoir', cg: '/api/cg' };
  const CHAIN_IDS = { ETH: 1, BASE: 8453, POLYGON: 137 };

  // App state
  const state = {
    view: 'explore',
    query: '',
    buynow: false,
    verified: false,
    chain: 'ETH',
    priceMin: null,
    priceMax: null,
    sort: 'trending',
    connected: false,
    items: [],
  };

  const grid = q('#grid');
  const resultsCount = q('#results-count');
  const walletBtn = q('#walletBtn');
  const suggest = q('#suggest');

  // Helpers
  const formatEth = (v) => `${Number(v).toFixed(3)} ETH`;
  const shortAddr = (addr) => addr.slice(0,6) + '...' + addr.slice(-4);
  const randAddr = () => '0x' + Array.from({length:40}).map(()=>Math.floor(Math.random()*16).toString(16)).join('');
  const setActiveNav = (hash) => { qa('.nav-links a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===hash)); };

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Explore: try Reservoir (if available), fallback to CoinGecko markets
  async function loadExplore() {
    const chainId = CHAIN_IDS[state.chain];
    if (!chainId && state.chain === 'SOL') {
      state.items = [];
      resultsCount.textContent = 'Solana-Integration folgt';
      grid.innerHTML = emptyState('Solana-Integration folgt.');
      return;
    }
    // Try Reservoir (may require API key) then CoinGecko
    try {
      const data = await fetchJSON(`${API.reservoir}/collections/v5?sortBy=volume24h&limit=24&chainId=${chainId}`);
      const cols = (data.collections || []).map(c => ({
        kind: 'collection',
        id: c.id,
        name: c.name,
        image: c.image,
        chain: state.chain,
        verified: c.openseaVerificationStatus === 'verified',
        floorEth: c.floorAsk?.price?.amount?.decimal ?? null,
      }));
      state.items = cols; render(); return;
    } catch {}
    try {
      const platform = state.chain === 'ETH' ? 'ethereum' : (state.chain === 'POLYGON' ? 'polygon-pos' : '');
      if (!platform) throw new Error('no platform');
      const data = await fetchJSON(`${API.cg}/nfts/markets?asset_platform_id=${encodeURIComponent(platform)}&order=h24_volume_desc&per_page=24&page=1`);
      const cols = (data || []).map(c => ({
        kind: 'collection',
        id: c.contract_address,
        name: c.name,
        image: c.image_url,
        chain: state.chain,
        verified: true,
        floorEth: c.floor_price?.native_currency_price ?? null
      }));
      state.items = cols; render();
    } catch (e) {
      state.items = mockCollections(); render();
    }
  }

  // Reservoir: load tokens in collection (by reservoir ID)
  async function loadCollectionReservoir(collectionId) {
    const chainId = CHAIN_IDS[state.chain];
    if (!chainId && state.chain === 'SOL') {
      state.items = [];
      resultsCount.textContent = 'Solana-Integration folgt';
      grid.innerHTML = emptyState('Solana-Integration folgt.');
      return;
    }
    const params = new URLSearchParams({ collection: collectionId, limit: '48' });
    if (state.buynow) params.set('status', 'buyNow');
    try {
      const data = await fetchJSON(`${API.reservoir}/tokens/v6?${params.toString()}&chainId=${chainId}`);
      const toks = (data.tokens || []).map(t => ({
        kind: 'token',
        id: t.token?.tokenId,
        name: t.token?.name || `${t.token?.contract} #${t.token?.tokenId}`,
        image: t.token?.image,
        chain: state.chain,
        verified: Boolean(t.token?.isFlagged) === false,
        priceEth: t.market?.floorAsk?.price?.amount?.decimal ?? null,
        collection: t.token?.collection?.id,
        collectionName: t.token?.collection?.name,
        attributes: t.token?.attributes || []
      }));
      state.items = toks;
      render();
    } catch (e) {
      state.items = mockTokens();
      render();
    }
  }

  // EVM: load tokens by contract address (0x...)
  async function loadCollectionEvm(address) {
    try {
      const base = `/api/evm/collection/tokens?address=${encodeURIComponent(address)}&limit=24&chainId=${CHAIN_IDS[state.chain]}`;
      const data = await fetchJSON(base);
      state.items = (data.items || []).map(x => ({ ...x, chain: state.chain }));
      render();
    } catch (e) {
      state.items = [];
      grid.innerHTML = emptyState('Konnte Kollektion nicht laden. Prüfe Adresse/Chain.');
      resultsCount.textContent = '0 Ergebnisse';
    }
  }

  // Rendering
  function render() {
    const items = applyFilters(state.items);
    resultsCount.textContent = `${items.length} Ergebnisse`;
    grid.innerHTML = items.map(toCard).join('');
  }

  function applyFilters(list) {
    let items = [...list];
    if (state.query) {
      const ql = state.query.toLowerCase();
      items = items.filter(x => (x.name||'').toLowerCase().includes(ql));
    }
    if (state.verified) items = items.filter(x => x.verified);
    if (state.priceMin != null) items = items.filter(x => (x.priceEth ?? Infinity) >= state.priceMin);
    if (state.priceMax != null) items = items.filter(x => (x.priceEth ?? -Infinity) <= state.priceMax);

    switch (state.sort) {
      case 'price-asc': items.sort((a,b)=> (a.priceEth??Infinity)-(b.priceEth??Infinity)); break;
      case 'price-desc': items.sort((a,b)=> (b.priceEth??-Infinity)-(a.priceEth??-Infinity)); break;
      case 'new': items.sort((a,b)=> (b.createdAt??0)-(a.createdAt??0)); break;
      default:
        items.sort((a,b)=> (b.verified?1:0) - (a.verified?1:0));
    }
    return items;
  }

  function toCard(item) {
    if (item.kind === 'collection') {
      return `
        <article class="card" data-kind="collection" data-id="${item.id}">
          <div class="thumb" style="position:relative">
            ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:100%;height:100%;object-fit:cover"/>` : '<div class="media-sparkle"></div>'}
          </div>
          <div class="card-body">
            <div class="title">${item.name}</div>
            <div class="sub">
              <span class="pill">${item.chain}</span>
              ${item.verified ? '<span class="pill">Verifiziert</span>' : ''}
            </div>
            <div class="price">
              <span class="muted">Floor</span>
              <strong>${item.floorEth != null ? formatEth(item.floorEth) : '-'}</strong>
            </div>
          </div>
        </article>`;
    }
    return `
      <article class="card" data-kind="token" data-id="${item.id}" data-collection="${item.collection||''}">
        <div class="thumb">
          ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:100%;height:100%;object-fit:cover"/>` : '<div class="media-sparkle"></div>'}
        </div>
        <div class="card-body">
          <div class="title">${item.name}</div>
          <div class="sub">
            <span class="pill">${item.chain}</span>
            ${item.verified ? '<span class="pill">Verifiziert</span>' : ''}
            ${item.collectionName ? `<span class="muted">${escapeHtml(item.collectionName)}</span>` : ''}
          </div>
          <div class="price">
            <span class="muted">Preis</span>
            <strong>${item.priceEth != null ? formatEth(item.priceEth) : '-'}</strong>
          </div>
        </div>
      </article>`;
  }

  // Search: suggestions via CoinGecko
  let suggestIndex = -1; let suggestItems = [];
  const searchInput = q('#search');
  searchInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    state.query = val; render();
    if (val.length < 2) { hideSuggest(); return; }
    try {
      const data = await fetchJSON(`${API.cg}/search?query=${encodeURIComponent(val)}`);
      const nfts = (data.nfts || []).slice(0, 8)
        .map(n => ({ name: n.name, address: n.contract_address, platform: n.asset_platform_id }))
        .filter(n => n.address);
      showSuggest(nfts);
    } catch { hideSuggest(); }
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && suggestItems.length) { e.preventDefault(); moveSuggest(1); }
    else if (e.key === 'ArrowUp' && suggestItems.length) { e.preventDefault(); moveSuggest(-1); }
    else if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (suggestIndex >= 0 && suggestItems[suggestIndex]) { selectSuggest(suggestItems[suggestIndex]); return; }
      if (/^0x[a-fA-F0-9]{40}$/.test(val)) { navigate(`#/collection/${val}`); return; }
      state.query = val; render(); hideSuggest();
    } else if (e.key === 'Escape') { hideSuggest(); }
  });
  document.addEventListener('click', (e) => { const el = q('.search'); if (el && !el.contains(e.target)) hideSuggest(); });

  function showSuggest(items){
    suggestItems = items; suggestIndex = -1;
    if (!items.length) { hideSuggest(); return; }
    suggest.innerHTML = items.map((n,i)=>
      `<div class="item${i===suggestIndex?' active':''}" role="option" data-i="${i}">
        <div>${escapeHtml(n.name)}</div>
        <div class="muted">${escapeHtml(platformToLabel(n.platform))}</div>
      </div>`).join('');
    suggest.classList.remove('hidden');
    Array.from(suggest.children).forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.i); selectSuggest(suggestItems[i]);
    }));
  }
  function hideSuggest(){ if (suggest) { suggest.classList.add('hidden'); suggest.innerHTML=''; } suggestItems = []; suggestIndex = -1; }
  function moveSuggest(delta){ suggestIndex = (suggestIndex + delta + suggestItems.length) % suggestItems.length; showSuggest(suggestItems); }
  function selectSuggest(n){ hideSuggest(); const chain = platformToChain(n.platform); if (chain) { state.chain = chain; selectChainChip(chain); } navigate(`#/collection/${n.address}`); }
  function platformToChain(p){ switch((p||'').toLowerCase()){ case 'ethereum': return 'ETH'; case 'polygon-pos': return 'POLYGON'; default: return 'ETH'; } }
  function platformToLabel(p){ switch((p||'').toLowerCase()){ case 'ethereum': return 'Ethereum'; case 'polygon-pos': return 'Polygon'; default: return p||'Unbekannt'; } }
  function selectChainChip(chain){ qa('.chip').forEach(c=>c.classList.toggle('active', c.dataset.chain===chain)); }

  // Filters
  q('#f-buynow').addEventListener('change', async (e) => {
    state.buynow = e.target.checked;
    if (state.view.startsWith('collection:')) {
      const id = state.view.split(':')[1];
      if (/^0x[a-fA-F0-9]{40}$/.test(id)) await loadCollectionEvm(id); else await loadCollectionReservoir(id);
    } else render();
  });
  q('#f-verified').addEventListener('change', (e) => { state.verified = e.target.checked; render(); });
  q('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  // Chain chips
  qa('.chip').forEach(btn => btn.addEventListener('click', async () => {
    qa('.chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.chain = btn.dataset.chain;
    if (state.chain === 'SOL') { await loadExplore(); return; }
    if (state.view.startsWith('collection:')) {
      const id = state.view.split(':')[1];
      if (/^0x[a-fA-F0-9]{40}$/.test(id)) await loadCollectionEvm(id); else await loadCollectionReservoir(id);
    } else { await loadExplore(); }
  }));

  // Price apply
  q('#price-apply').addEventListener('click', async () => {
    const min = parseFloat(q('#price-min').value);
    const max = parseFloat(q('#price-max').value);
    state.priceMin = Number.isFinite(min) ? min : null;
    state.priceMax = Number.isFinite(max) ? max : null;
    render();
  });

  // Wallet stub (MetaMask if present)
  walletBtn.addEventListener('click', async () => {
    if (!state.connected) {
      try {
        if (window.ethereum && window.ethereum.request) {
          const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
          state.connected = true;
          walletBtn.textContent = shortAddr(addr);
          walletBtn.classList.remove('primary');
          walletBtn.title = addr;
        } else {
          state.connected = true;
          const addr = randAddr();
          walletBtn.textContent = shortAddr(addr);
          walletBtn.classList.remove('primary');
          walletBtn.title = addr;
        }
      } catch (e) {}
    } else {
      state.connected = false;
      walletBtn.textContent = 'Wallet verbinden';
      walletBtn.classList.add('primary');
      walletBtn.removeAttribute('title');
    }
  });

  // Modal
  const modal = q('#modal');
  const modalClose = q('#modal-close');
  const modalTitle = q('#modal-title');
  const modalPrice = q('#modal-price');
  const modalMedia = q('#modal-media');
  const modalAttrs = q('#modal-attrs');
  const modalActivity = q('#modal-activity');

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const kind = card.dataset.kind;
    if (kind === 'collection') {
      const id = card.dataset.id;
      navigate(`#/collection/${encodeURIComponent(id)}`);
      return;
    }
    if (kind === 'token') {
      const id = card.dataset.id;
      const item = state.items.find(x => String(x.id) === String(id));
      if (item) openModal(item);
    }
  });

  function openModal(item) {
    modalTitle.textContent = item.name || '-';
    modalPrice.textContent = item.priceEth != null ? formatEth(item.priceEth) : '-';
    modalMedia.innerHTML = item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name || '')}" style="max-width:100%;max-height:100%;object-fit:contain"/>` : '<div class="media-sparkle" style="width:70%;height:70%"></div>';
    modalAttrs.innerHTML = (item.attributes||[]).slice(0,8).map(a=>`<span class="pill">${escapeHtml(a?.key||a?.trait_type||'')} : ${escapeHtml(a?.value||'')}</span>`).join('') || '<div class="muted">Keine Attribute</div>';
    modalActivity.innerHTML = '<div class="muted">Aktivität (via API später)</div>';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
  }

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  modalClose.addEventListener('click', closeModal);
  function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }

  // Router
  function navigate(hash){ location.hash = hash; }
  async function route(){
    const h = location.hash || '#/explore';
    setActiveNav(h.startsWith('#/collection/') ? '#/collections' : h.split('/').slice(0,2).join('/'));
    if (h.startsWith('#/collection/')){
      const id = decodeURIComponent(h.replace('#/collection/',''));
      state.view = `collection:${id}`;
      if (/^0x[a-fA-F0-9]{40}$/.test(id)) await loadCollectionEvm(id); else await loadCollectionReservoir(id);
      return;
    }
    state.view = 'explore';
    await loadExplore();
  }
  window.addEventListener('hashchange', route);

  // Utilities / Mock / Empty states
  function emptyState(text){ return `<div class="card" style="padding:16px;text-align:center"><div class="muted">${escapeHtml(text)}</div></div>`; }
  function mockCollections(){ return Array.from({length:12}).map((_,i)=>({kind:'collection',id:`mock-${i}`,name:`Mock Kollektion ${i+1}`,image:null,chain:state.chain,verified:i%3===0,floorEth:Math.random()*0.2+0.02})); }
  function mockTokens(){ return Array.from({length:24}).map((_,i)=>({kind:'token',id:i+1,name:`BUA #${String(i+1).padStart(3,'0')}`,image:null,chain:state.chain,verified:i%3===0,priceEth:Math.random()*0.2+0.02,collection:'mock',collectionName:'Mock'})); }
  function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }

  // Start
  route();
});

