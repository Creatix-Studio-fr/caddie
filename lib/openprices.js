'use strict';
/* Prix réels depuis Open Prices (Open Food Facts) : https://prices.openfoodfacts.org
   Données sous licence ODbL : la source doit être citée dans le site (c'est fait dans la liste de courses).
   Principe : pour chaque ingrédient du catalogue, on retrouve des relevés de prix récents (par catégorie de produit),
   on les ramène au prix du paquet du catalogue, puis on garde la médiane la plus proche de l'enseigne et du lieu choisis.
   Un ingrédient sans assez de relevés n'a pas de prix ici : le site garde alors son prix estimé. */

const API = 'https://prices.openfoodfacts.org/api/v1/prices';

/* Enseignes : jeton envoyé à l'API (filtre « contient », sensible à la casse) et motif pour reconnaître le magasin dans la réponse. */
const CHAINS = {
  leclerc: { name: 'E.Leclerc', token: 'Leclerc', re: /leclerc/, k: 1 },
  intermarche: { name: 'Intermarché', token: 'Intermarché', re: /intermarch/, k: 1.04 },
  auchan: { name: 'Auchan', token: 'Auchan', re: /auchan/, k: 1.06 },
  carrefour: { name: 'Carrefour', token: 'Carrefour', re: /carrefour/, k: 1.08 },
  systemeu: { name: 'Système U', token: 'Super U', re: /\b(super u|hyper u|u express|systeme u|marche u)\b/, k: 1.07 },
  lidl: { name: 'Lidl', token: 'Lidl', re: /lidl/, k: 0.94 },
  aldi: { name: 'Aldi', token: 'Aldi', re: /aldi/, k: 0.93 }
};
const AVG_K = Object.values(CHAINS).reduce((a, c) => a + c.k, 0) / Object.keys(CHAINS).length;

/* Catégories Open Food Facts de chaque ingrédient. g = groupes de tags essayés dans l'ordre (du plus précis au plus large).
   mode : 'kg' (prix ramené au kilo ou au litre, défaut), 'can' (prix d'une boîte, taille dans qty), 'count' (prix à la pièce, ex. œufs).
   cat : existe aussi en relevés « sans code-barres » (fruits et légumes en vrac). pack_g : poids du paquet du catalogue quand il est vendu à la pièce.
   item_g : poids d'une pièce, pour convertir un prix « à la pièce » en prix au kilo. */
const MAP = {
  pates: { g: [['en:dry-pastas'], ['en:pastas']] },
  riz: { g: [['en:long-grain-rices'], ['en:rices']] },
  pdt: { g: [['en:potatoes']], cat: true },
  lentilles: { g: [['en:green-lentils'], ['en:lentils']] },
  semoule: { g: [['en:semolinas'], ['fr:semoule-de-ble'], ['en:couscous']] },
  poischiches: { g: [['en:canned-chickpeas'], ['en:chickpeas']], mode: 'can', qty: [200, 1000] },
  harirouges: { g: [['en:canned-red-kidney-beans'], ['en:red-kidney-beans'], ['en:red-beans']], mode: 'can', qty: [200, 1000] },
  mais: { g: [['en:canned-sweet-corn'], ['en:sweet-corn']], mode: 'can', qty: [150, 1000] },
  tomconc: { g: [['en:chopped-tomatoes'], ['en:canned-chopped-tomatoes'], ['en:crushed-tomatoes']], mode: 'can', qty: [200, 1000] },
  passata: { g: [['en:tomato-passata'], ['en:tomato-sauces']] },
  laitcoco: { g: [['en:coconut-milks']] },
  pesto: { g: [['en:pesto-sauces'], ['en:pestos']] },
  curry: { g: [['en:curry-powders'], ['en:curry']] },
  thon: { g: [['en:canned-tunas'], ['en:tunas']], mode: 'can', qty: [100, 400] },
  tortilla: { g: [['en:wheat-tortillas'], ['en:tortillas']], pack_g: 340 },
  poulet: { g: [['en:chicken-breasts'], ['en:chicken-breast-fillets']] },
  cuisses: { g: [['en:chicken-legs'], ['en:chicken-thighs']] },
  steak: { g: [['en:ground-beef'], ['en:minced-beef'], ['fr:steaks-haches']] },
  saucisses: { g: [['fr:saucisses-de-toulouse'], ['en:toulouse-sausages'], ['en:sausages']] },
  lardons: { g: [['fr:lardons'], ['en:bacon-bits'], ['en:lardons']] },
  jambon: { g: [['fr:jambons-blancs'], ['en:white-hams'], ['en:cooked-hams']] },
  saumon: { g: [['en:salmon-fillets'], ['en:salmons']] },
  cabillaud: { g: [['en:cod-fillets'], ['en:cods']] },
  epinards: { g: [['en:frozen-spinach'], ['en:spinach']] },
  hverts: { g: [['en:frozen-green-beans'], ['en:green-beans']] },
  oeufs: { g: [['en:eggs'], ['en:chicken-eggs']], mode: 'count' },
  lait: { g: [['en:uht-milks'], ['en:milks']] },
  creme: { g: [['en:creme-fraiche'], ['en:fresh-creams']] },
  gruyere: { g: [['en:grated-cheeses'], ['en:grated-emmental'], ['en:gruyere']] },
  feta: { g: [['en:feta'], ['en:fetas']] },
  oignons: { g: [['en:onions']], cat: true },
  ail: { g: [['en:garlic'], ['en:garlics']], cat: true, pack_g: 50, item_g: 50 },
  carottes: { g: [['en:carrots']], cat: true },
  courgettes: { g: [['en:zucchini'], ['en:courgettes'], ['en:zucchinis']], cat: true },
  tomates: { g: [['en:tomatoes']], cat: true },
  poivrons: { g: [['en:bell-peppers'], ['en:peppers']], cat: true, pack_g: 600, item_g: 200 },
  champis: { g: [['en:button-mushrooms'], ['en:mushrooms']], cat: true },
  brocoli: { g: [['en:broccoli'], ['en:broccolis']], cat: true, pack_g: 450, item_g: 450 },
  salade: { g: [['en:lettuces'], ['en:salads']], cat: true, pack_g: 300, item_g: 300 }
};

const MIN_OBS = 3;          // relevés minimum pour un prix « zone » ou « France »
const RECENT_DAYS = 120;    // on préfère les relevés des 4 derniers mois
const SEARCH_DAYS = 365;    // on ne remonte pas plus loin que 1 an
const MAX_QUERIES = 6;      // appels maximum par ingrédient

const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const round2 = x => Math.round(x * 100) / 100;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const dayStr = ms => new Date(ms).toISOString().slice(0, 10);

/* Poids ou volume d'un produit en g/ml (null si inconnu). */
function grams(product) {
  if (!product) return null;
  const q = num(product.product_quantity);
  if (!q || q <= 0) return null;
  const u = plain(product.product_quantity_unit || 'g');
  const f = { g: 1, ml: 1, kg: 1000, l: 1000, cl: 10, dl: 100, mg: 0.001 }[u];
  return f ? q * f : q;
}

/* Nombre de pièces d'après le texte de quantité (« 12 œufs », « x6 »). */
function countOf(product) {
  const m = String((product && product.quantity) || '').match(/(?:^|\bx\s*)(\d{1,2})(?!\d|\s*(?:g|kg|ml|cl|l)\b)/i);
  const n = m ? Number(m[1]) : null;
  return n && n >= 2 && n <= 30 ? n : null;
}

/* Un relevé Open Prices -> une observation comparable (null si inutilisable). */
function extract(it, m, packG) {
  if (!it || it.currency !== 'EUR') return null;
  const loc = it.location || {};
  if (loc.type === 'ONLINE') return null;
  const cc = String(loc.osm_address_country_code || '').toUpperCase();
  if (cc && cc !== 'FR') return null;
  const paid = num(it.price), regular = num(it.price_without_discount);
  const price = it.price_is_discounted && regular > 0 ? regular : paid; // prix habituel, pas la promo du jour
  if (!(price > 0)) return null;
  const product = it.product || null, isCat = it.type === 'CATEGORY' || !product;
  const per = it.price_per === 'KILOGRAM' ? 'KILOGRAM' : 'UNIT';
  const mode = m.mode || 'kg';
  let v = null;
  if (mode === 'can') {
    const g = grams(product);
    if (isCat || !g || g < m.qty[0] || g > m.qty[1] || per !== 'UNIT') return null;
    v = price;
  } else if (mode === 'count') {
    const n = !isCat && per === 'UNIT' ? countOf(product) : null;
    if (!n) return null;
    v = price / n;
  } else if (per === 'KILOGRAM') {
    v = price;
  } else if (isCat) {
    v = m.item_g ? price / (m.item_g / 1000) : null;
  } else {
    const g = grams(product);
    v = g ? price / (g / 1000) : null;
  }
  if (!(v > 0.05)) return null;
  const labels = [...(it.labels_tags || []), ...((product && product.labels_tags) || [])];
  return {
    v, id: it.id, date: String(it.date || '').slice(0, 10), org: labels.includes('en:organic'),
    code: it.product_code || (product && product.code) || null,
    shop: loc.osm_name || loc.osm_brand || '', brand: plain(`${loc.osm_name || ''} ${loc.osm_brand || ''}`),
    city: loc.osm_address_city || ''
  };
}

/* Valeur robuste : médiane après avoir écarté les relevés aberrants. */
function robust(list) {
  const vals = list.map(o => o.v), m = median(vals);
  const keep = list.filter(o => o.v >= m * 0.5 && o.v <= m * 2);
  const use = keep.length >= 2 ? keep : list;
  return { v: median(use.map(o => o.v)), used: use };
}

/* Choisit le meilleur niveau de précision disponible pour un ingrédient. */
function choose(obs, chain, packFactor, refPrice, now) {
  const today = now || Date.now();
  const clean = list => { const nb = list.filter(o => !o.org); return nb.length >= 2 ? nb : list; }; // on évite le bio sauf s'il n'y a que ça
  const recent = list => { const r = list.filter(o => o.date && today - Date.parse(o.date) <= RECENT_DAYS * 864e5); return r.length >= 2 ? r : list; };
  const tiers = [
    ['magasin_local', o => o.chain && o.near, 2, 1],
    ['magasin', o => o.chain, MIN_OBS, 1],
    ['zone', o => o.near, MIN_OBS, chain.k / AVG_K],
    ['france', () => true, MIN_OBS, chain.k / AVG_K]
  ];
  for (const [src, test, min, adj] of tiers) {
    const pool = recent(clean(obs.filter(test)));
    if (pool.length < min) continue;
    const { v, used } = robust(pool);
    const p = round2(v * packFactor * adj);
    if (refPrice && (p < refPrice * 0.35 || p > refPrice * 3)) return { rejected: { src, p } };
    const latest = [...used].sort((a, b) => b.date.localeCompare(a.date))[0];
    const shops = {};
    used.forEach(o => { if (o.shop) shops[o.shop] = (shops[o.shop] || 0) + 1; });
    const shop = Object.keys(shops).sort((a, b) => shops[b] - shops[a])[0] || '';
    return { p, src, n: used.length, d: latest.date, st: src.startsWith('magasin') ? shop : '', code: latest.code, pid: latest.id };
  }
  return null;
}

async function opFetch(params, o) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs);
  try {
    const res = await o.fetchImpl(`${API}?${new URLSearchParams(params).toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': o.ua }, signal: ctrl.signal
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    return Array.isArray(data && data.items) ? data.items : [];
  } finally { clearTimeout(timer); }
}

async function priceOne(id, ing, ctx) {
  const m = MAP[id], dbg = { queries: 0, errors: 0, obs: 0, groups: 0 };
  if (!m) return { dbg };
  const packG = m.pack_g || ing.pack;
  const packFactor = (m.mode === 'can') ? 1 : (m.mode === 'count') ? ing.pack : packG / 1000;
  const obs = [], seen = new Set();
  const run = async (params, near) => {
    if (dbg.queries >= MAX_QUERIES || Date.now() > ctx.deadline) return;
    dbg.queries++;
    let items;
    try { items = await opFetch({ ...ctx.base, ...params }, ctx); } catch (e) { dbg.errors++; return; }
    items.forEach(it => {
      const o = extract(it, m, packG);
      if (!o || seen.has(o.id)) return;
      seen.add(o.id); o.near = near; o.chain = ctx.chain.re.test(o.brand); obs.push(o);
    });
  };
  for (const group of m.g) {
    dbg.groups++;
    const tags = { product__categories_tags__overlap: group.join(',') };
    await run(tags, false);
    if (ctx.geo) await run({ ...tags, ...ctx.geo }, true);
    if (m.cat && group === m.g[0]) {
      await run({ type: 'CATEGORY', category_tag: group[0] }, false);
      if (ctx.geo) await run({ type: 'CATEGORY', category_tag: group[0], ...ctx.geo }, true);
    }
    if (obs.filter(o => o.chain).length < MIN_OBS) await run({ ...tags, location__osm_name__contains: ctx.chain.token }, false);
    if (obs.length >= MIN_OBS) break;
  }
  dbg.obs = obs.length;
  const refPrice = ing.price * ctx.chain.k;
  const res = choose(obs, ctx.chain, packFactor, refPrice, ctx.now);
  if (res && res.rejected) { dbg.rejected = res.rejected; return { dbg }; }
  return { res, dbg };
}

/* Point d'entrée : prix réels pour tous les ingrédients du catalogue. */
async function buildPrices(opts) {
  const chain = CHAINS[opts.store] || CHAINS.leclerc;
  const fetchImpl = opts.fetchImpl || fetch;
  const now = opts.now || Date.now();
  const ctx = {
    chain, fetchImpl, timeoutMs: opts.timeoutMs || 8000, deadline: Date.now() + (opts.budgetMs || 50000), now,
    ua: opts.ua || 'CaddieIA/2.0 (site de courses ; lecture seule)',
    base: { currency: 'EUR', order_by: '-date', size: '80', date__gte: dayStr(now - SEARCH_DAYS * 864e5), duplicate_of__isnull: 'true' },
    geo: opts.lat != null && opts.lon != null ? { lat: String(opts.lat), lon: String(opts.lon), radius_km: String(opts.radiusKm || 40) } : null
  };
  const ids = Object.keys(opts.catalogue).filter(id => MAP[id]);
  const items = {}, debug = {};
  let next = 0;
  const worker = async () => {
    while (next < ids.length && Date.now() < ctx.deadline) {
      const id = ids[next++];
      const { res, dbg } = await priceOne(id, opts.catalogue[id], ctx);
      if (res) items[id] = res;
      debug[id] = { ...dbg, found: res ? { src: res.src, p: res.p, n: res.n } : null };
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency || 6 }, worker));
  const bySrc = {};
  Object.values(items).forEach(x => { bySrc[x.src] = (bySrc[x.src] || 0) + 1; });
  return {
    store: opts.store in CHAINS ? opts.store : 'leclerc', storeName: chain.name, geo: !!ctx.geo,
    generated: new Date(now).toISOString(), items,
    stats: { live: Object.keys(items).length, total: Object.keys(opts.catalogue).length, bySrc },
    source: 'Open Prices (Open Food Facts), licence ODbL', debug
  };
}

module.exports = { buildPrices, extract, choose, robust, CHAINS, MAP, AVG_K };
