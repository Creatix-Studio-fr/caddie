'use strict';
/* Prix réels pour Caddie, depuis Open Prices (Open Food Facts).
   GET /api/prix?store=leclerc&lat=49.44&lon=1.10   (lat et lon facultatifs : prix autour de chez toi)
   La réponse est mise en cache 6 h par le CDN de Vercel pour chaque combinaison enseigne + zone :
   le calcul (une centaine d'appels à Open Prices) n'est donc fait qu'une fois toutes les quelques heures. */
const { INGREDIENTS } = require('../lib/catalogue.js');
const { buildPrices, CHAINS } = require('../lib/openprices.js');

const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return list.length > 12;
}

/* Position arrondie à 0,01° (≈ 1 km) et limitée à la France : améliore le cache et évite de garder une position précise. */
function cleanGeo(lat, lon) {
  lat = Number(lat); lon = Number(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 41 || lat > 51.5 || lon < -5.5 || lon > 9.8) return null;
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Cache-Control', 'no-store'); return res.status(405).json({ error: 'method' }); }
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'inconnue';
  if (tooMany(ip)) { res.setHeader('Cache-Control', 'no-store'); return res.status(429).json({ error: 'trop_de_demandes' }); }
  const q = req.query || {};
  const store = Object.prototype.hasOwnProperty.call(CHAINS, q.store) ? q.store : 'leclerc';
  const geo = cleanGeo(q.lat, q.lon);
  try {
    const out = await buildPrices({
      store, lat: geo && geo.lat, lon: geo && geo.lon, catalogue: INGREDIENTS,
      ua: process.env.OPEN_PRICES_UA, budgetMs: 50000
    });
    if (!q.debug) delete out.debug;
    /* Bon résultat : 6 h de cache. Résultat vide (API indisponible) : 5 min seulement. */
    res.setHeader('Cache-Control', out.stats.live ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'public, s-maxage=300');
    return res.status(200).json(out);
  } catch (e) {
    console.error('Caddie prix :', e && e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'prix_indisponibles' });
  }
};
