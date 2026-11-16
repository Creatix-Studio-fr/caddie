'use strict';
/* Serveur IA de Caddie.
   Le site envoie les préférences ici ; ce fichier interroge Gemini avec la clé secrète (jamais visible du navigateur),
   revérifie tout ce que l'IA répond, puis renvoie des recettes au format du site.
   Les prix ne passent jamais par l'IA : le site les calcule lui-même. */
const crypto = require('crypto');
const { INGREDIENTS } = require('../lib/catalogue.js');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const IDS = Object.keys(INGREDIENTS);

const STORES = ['leclerc', 'intermarche', 'auchan', 'carrefour', 'systemeu', 'lidl', 'aldi'];
const TASTE_LABELS = {
  rapide: 'rapide (25 min max)', eco: 'petit prix', leger: 'léger', confort: 'réconfortant', cremeux: 'crémeux',
  epice: 'épicé', four: 'gratins et plats au four', pates: 'pâtes', riz: 'riz', pdt: 'pommes de terre', oeufs: 'œufs',
  poulet: 'poulet', boeuf: 'bœuf', poisson: 'poisson', vegetarien: 'végétarien', legumineuses: 'légumineuses',
  francais: 'cuisine française', italien: 'cuisine italienne', mexicain: 'cuisine tex-mex', curry: 'curry',
  mediterraneen: 'cuisine méditerranéenne'
};
const AVOID_LABELS = {
  viande: 'aucune viande', porc: 'pas de porc (ni lardons, jambon, saucisses)', boeuf: 'pas de bœuf', poulet: 'pas de poulet',
  poisson: 'aucun poisson', lactose: 'pas de produits laitiers', gluten: 'pas de gluten (ni pâtes, semoule, tortillas)',
  oeuf: 'pas d’œufs', champignons: 'pas de champignons', oignons: 'ni oignons ni ail', poivrons: 'pas de poivrons',
  tomate: 'pas de tomate (ni coulis, ni tomates concassées)', legumineuses: 'pas de légumineuses (lentilles, pois chiches, haricots rouges)',
  coco: 'pas de lait de coco', epice: 'pas de plats épicés'
};
/* Étiquettes que l'IA a le droit d'ajouter. Les autres (poulet, bœuf, épice du curry) sont déduites des ingrédients. */
const AI_TAGS = ['cremeux', 'leger', 'confort', 'italien', 'francais', 'mexicain', 'curry', 'mediterraneen', 'oeufs', 'legumineuses', 'four', 'epice'];

/* Mêmes règles que le site, pour ne jamais renvoyer une recette qui viole un « à éviter ». */
const has = (r, ids) => r.ids.some(i => ids.includes(i));
const AVOID_TEST = {
  viande: r => r.d === 'viande', poisson: r => r.d === 'poisson', porc: r => r.c.includes('porc'),
  boeuf: r => r.g.includes('boeuf'), poulet: r => r.g.includes('poulet'),
  lactose: r => r.c.includes('lactose'), gluten: r => r.c.includes('gluten'), oeuf: r => r.c.includes('oeuf'),
  champignons: r => has(r, ['champis']), oignons: r => has(r, ['oignons', 'ail']), poivrons: r => has(r, ['poivrons']),
  tomate: r => has(r, ['tomates', 'passata', 'tomconc']), legumineuses: r => has(r, ['lentilles', 'poischiches', 'harirouges']),
  coco: r => has(r, ['laitcoco']), epice: r => r.g.includes('epice')
};

/* Limiteur très simple (par instance du serveur) : freine un abus sans base de données. */
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return list.length > 8;
}

function cleanPrefs(p) {
  p = p && typeof p === 'object' ? p : {};
  const num = (v, min, max, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
  return {
    people: Math.round(num(p.people, 1, 12, 2)),
    meals: Math.round(num(p.meals, 1, 14, 6)),
    budget: num(p.budget, 1, 1000, 40),
    store: STORES.includes(p.store) ? p.store : 'leclerc',
    tastes: (Array.isArray(p.tastes) ? p.tastes : []).filter(x => TASTE_LABELS[x]).slice(0, 12),
    avoid: (Array.isArray(p.avoid) ? p.avoid : []).filter(x => AVOID_TEST[x]).slice(0, 15)
  };
}

function buildPrompt(p) {
  const perMeal = Math.round((p.budget / (p.meals * p.people)) * 100) / 100;
  const catalogue = IDS.map(id => {
    const g = INGREDIENTS[id];
    const unit = g.unit === 'pc' ? `pièces (${g.noun})` : g.unit;
    return `${id} | ${g.name} | quantité en ${unit} | paquet de ${g.pack} à ${g.price} €`;
  }).join('\n');
  const system = [
    'Tu es un cuisinier français qui compose des menus simples, variés et économiques.',
    'Règles strictes :',
    '- Tu utilises UNIQUEMENT les ingrédients de la liste fournie, avec leur identifiant exact.',
    '- Les quantités sont PAR PERSONNE : en g ou ml pour les ingrédients en g ou ml, en nombre de pièces sinon (0,5 est possible).',
    '- Chaque recette a 3 à 7 ingrédients. Jamais de sel, poivre, huile, beurre, sucre, farine ni épices de base : ils sont déjà dans le placard.',
    '- Recettes réalisables en 15 à 60 minutes, avec un nom de plat clair en français.',
    '- Les recettes sont toutes différentes, avec au plus deux plats ayant la même base (pâtes, riz ou pommes de terre).',
    '- Tu respectes strictement les aliments à éviter.',
    '- Tu vises un coût moyen par personne et par repas proche de l’objectif, sans le dépasser, en t’aidant des prix des paquets.',
    '- Tu réponds uniquement par un objet JSON de la forme {"recipes":[{"name":"...","minutes":30,"tags":["..."],"ingredients":[{"id":"...","qty":100}]}]}, sans aucun texte autour.',
    `- Tags possibles : ${AI_TAGS.join(', ')}.`
  ].join('\n');
  const user = [
    `Compose exactement ${p.meals} recettes différentes, pour ${p.people} personne(s).`,
    `Objectif de coût : environ ${perMeal} € par personne et par repas.`,
    p.tastes.length ? `Envies : ${p.tastes.map(t => TASTE_LABELS[t]).join(', ')}.` : 'Envies : aucune préférence, varie les plats.',
    p.avoid.length ? `À éviter absolument : ${p.avoid.map(a => AVOID_LABELS[a]).join(' ; ')}.` : 'À éviter : rien.',
    '',
    'Ingrédients autorisés (identifiant | nom | unité | paquet) :',
    catalogue
  ].join('\n');
  return { system, user };
}

const SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          minutes: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          ingredients: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string', enum: IDS }, qty: { type: 'number' } }, required: ['id', 'qty'] }
          }
        },
        required: ['name', 'minutes', 'ingredients']
      }
    }
  },
  required: ['recipes']
};

async function callGemini(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 22000);
  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } finally { clearTimeout(timer); }
}

function extractJson(text) {
  const t = String(text || '').replace(/```json|```/gi, '').trim();
  try { return JSON.parse(t); } catch (e) { /* on tente d'isoler l'objet */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a > -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* abandon */ } }
  return null;
}

/* Vérifie une recette de l'IA et la convertit au format du site. Renvoie null si elle n'est pas fiable. */
function convert(raw, prefs) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 80);
  if (name.length < 3 || !Array.isArray(raw.ingredients)) return null;
  const i = {};
  for (const it of raw.ingredients) {
    const g = it && INGREDIENTS[it.id];
    const qty = Number(it && it.qty);
    if (!g || !Number.isFinite(qty) || qty <= 0) return null;
    const max = g.unit === 'pc' ? 4 : 400;
    if (qty > max) return null;
    i[it.id] = Math.round(qty * 100) / 100;
  }
  const ids = Object.keys(i);
  if (ids.length < 2 || ids.length > 8) return null;
  const metas = ids.map(id => INGREDIENTS[id]);
  const r = {
    n: name,
    t: Math.min(120, Math.max(10, Math.round(Number(raw.minutes) || 30))),
    d: metas.some(m => m.d === 'viande') ? 'viande' : metas.some(m => m.d === 'poisson') ? 'poisson' : 'vegetarien',
    b: ids.includes('pates') ? 'pates' : ids.includes('riz') ? 'riz' : ids.includes('pdt') ? 'pdt' : 'autre',
    c: [...new Set(metas.flatMap(m => m.c))],
    g: [...new Set([...metas.flatMap(m => m.t), ...(Array.isArray(raw.tags) ? raw.tags : []).filter(x => AI_TAGS.includes(x))])],
    i, ids
  };
  if (prefs.avoid.some(a => AVOID_TEST[a](r))) return null;
  const id = 'ia-' + crypto.createHash('sha1').update(name + JSON.stringify(i)).digest('hex').slice(0, 10);
  delete r.ids;
  return { id, ...r };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'cle_manquante' });
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'inconnue';
  if (tooMany(ip)) return res.status(429).json({ error: 'trop_de_demandes' });

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'json' }); }
  const prefs = cleanPrefs(body && body.prefs);
  const { system, user } = buildPrompt(prefs);

  const base = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 6000 }
  };
  try {
    /* 1re tentative avec un format de réponse imposé ; si Google le refuse (400), on réessaie avec la consigne seule. */
    let r = await callGemini({
      ...base,
      generationConfig: { ...base.generationConfig, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } } }
    });
    if (r.status === 400) r = await callGemini(base);
    if (r.status === 429) return res.status(429).json({ error: 'quota' });
    if (!r.ok) { console.error('Gemini HTTP', r.status); return res.status(502).json({ error: 'ia_indisponible' }); }

    const data = await r.json();
    const text = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
    const parsed = extractJson(text);
    const list = parsed && Array.isArray(parsed.recipes) ? parsed.recipes : [];
    const seen = new Set();
    const recipes = list.map(x => convert(x, prefs)).filter(x => x && !seen.has(x.id) && seen.add(x.id)).slice(0, prefs.meals);
    if (!recipes.length) return res.status(502).json({ error: 'reponse_inutilisable' });
    return res.status(200).json({ recipes, model: MODEL });
  } catch (e) {
    console.error('Erreur IA', e && e.name);
    return res.status(502).json({ error: 'ia_indisponible' });
  }
};
