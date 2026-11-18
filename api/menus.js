'use strict';
/* Serveur IA de Caddie.
   Le site envoie les préférences ici ; ce fichier interroge Gemini avec la clé secrète (jamais visible du navigateur),
   revérifie tout ce que l'IA répond, puis renvoie des recettes au format du site.
   Les prix ne passent jamais par l'IA : le site les calcule lui-même. */
const crypto = require('crypto');
const { INGREDIENTS } = require('../lib/catalogue.js');

/* gemini-3.5-flash-lite : gratuit avec une limite quotidienne bien plus haute que gemini-3.8-flash. */
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
/* Secours facultatif : à définir dans Vercel uniquement après avoir vérifié son accès et son coût. */
const FALLBACK_MODEL = (process.env.GEMINI_FALLBACK_MODEL || '').trim();
const REQUEST_TIMEOUT_MS = 38000; // le double de recettes détaillées demande plus de temps de génération
const TOTAL_BUDGET_MS = 56000;    // reste sous la limite de 60 s de Vercel (voir vercel.json)
const MIN_ATTEMPT_MS = 6000;      // on ne relance pas s'il reste moins de temps que ça
const RETRY_DELAYS_MS = [1200, 2800]; // 3 tentatives maximum au total
const IDS = Object.keys(INGREDIENTS);

/* Matériel de cuisine : mêmes identifiants que le site. */
const EQUIP_LABELS = {
  plaques: 'plaques de cuisson', four: 'four', micro: 'micro-ondes', airfryer: 'air fryer', cocotte: 'cocotte-minute',
  robot: 'robot cuiseur (type Cookeo ou Monsieur Cuisine)', mijoteuse: 'mijoteuse', cuiseurriz: 'cuiseur à riz', mixeur: 'mixeur ou blender'
};
const EQUIP_IDS = Object.keys(EQUIP_LABELS);
const DEFAULT_EQUIP = ['plaques', 'four', 'micro'];
const MAX_RECIPES = 28; // 2 × 14 repas

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
    avoid: (Array.isArray(p.avoid) ? p.avoid : []).filter(x => AVOID_TEST[x]).slice(0, 15),
    equip: Array.isArray(p.equip) ? [...new Set(p.equip.filter(x => EQUIP_IDS.includes(x)))] : DEFAULT_EQUIP
  };
}

function buildPrompt(p) {
  p.want = Math.min(MAX_RECIPES, p.meals * 2);
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
    '- Tu n’utilises QUE le matériel de cuisine disponible indiqué par la personne, jamais un autre appareil. Varie les modes de cuisson en profitant des appareils disponibles.',
    '- Chaque recette a 3 à 6 étapes courtes (une phrase, 25 mots maximum), claires pour un débutant, avec températures et durées de cuisson. Elles citent les ingrédients par leur nom, sans identifiant.',
    '- « prep » est le temps de préparation en minutes, « cook » le temps de cuisson en minutes. « equipment » liste les identifiants du matériel réellement utilisé.',
    '- Les recettes sont toutes différentes, avec au plus deux plats ayant la même base (pâtes, riz ou pommes de terre).',
    '- Tu respectes strictement les aliments à éviter.',
    '- Tu vises un coût moyen par personne et par repas proche de l’objectif, sans le dépasser, en t’aidant des prix des paquets.',
    '- Tu réponds uniquement par un objet JSON de la forme {"recipes":[{"name":"...","prep":10,"cook":20,"equipment":["plaques"],"tags":["..."],"ingredients":[{"id":"...","qty":100}],"steps":["..."]}]}, sans aucun texte autour.',
    `- Tags possibles : ${AI_TAGS.join(', ')}.`
  ].join('\n');
  const user = [
    `Compose exactement ${p.want} recettes différentes (le double des ${p.meals} repas demandés, pour que la personne puisse en changer certaines), pour ${p.people} personne(s).`,
    `Matériel disponible : ${p.equip.length ? p.equip.map(e => `${e} (${EQUIP_LABELS[e]})`).join(', ') : 'aucun appareil de cuisson, uniquement des préparations froides'}.`,
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
          prep: { type: 'integer' },
          cook: { type: 'integer' },
          equipment: { type: 'array', items: { type: 'string', enum: EQUIP_IDS } },
          steps: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          ingredients: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string', enum: IDS }, qty: { type: 'number' } }, required: ['id', 'qty'] }
          }
        },
        required: ['name', 'prep', 'cook', 'equipment', 'ingredients', 'steps']
      }
    }
  },
  required: ['recipes']
};

async function callGemini(model, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    // Lire le corps avant de couper le timeout : Google y place le vrai motif d'échec.
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { /* réponse non JSON */ }
    return {
      status: response.status,
      ok: response.ok,
      data,
      raw: raw.slice(0, 4000),
      retryAfter: response.headers.get('retry-after')
    };
  } finally { clearTimeout(timer); }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(result, retryIndex) {
  const header = result && result.retryAfter;
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(5000, Math.max(0, seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(5000, Math.max(0, date - Date.now()));
  }
  return RETRY_DELAYS_MS[retryIndex] || 2800;
}

function logGeminiFailure(model, status, data, raw, attempt, errorName) {
  const providerError = data && data.error ? data.error : {};
  // Ne jamais journaliser la clé API ni le prompt envoyé à Google.
  console.error('Gemini request failed', JSON.stringify({
    model,
    status: status || null,
    providerStatus: providerError.status || null,
    message: String(providerError.message || raw || errorName || 'Erreur inconnue').slice(0, 1200),
    attempt,
    errorName: errorName || null
  }));
}

async function generateWithModel(model, withSchema, base, deadline) {
  let payload = withSchema;
  let last = null;
  /* Temps accordé à un appel : jamais plus que ce qu'il reste avant la limite de la fonction. */
  const slot = () => Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now() - 1500);
  for (let attempt = 0; attempt < 3; attempt++) {
    const ms = slot();
    if (ms < MIN_ATTEMPT_MS) break;
    try {
      let result = await callGemini(model, payload, ms);
      // Si le format structuré est refusé, on retente une fois sans schéma.
      if (result.status === 400 && payload === withSchema && slot() >= MIN_ATTEMPT_MS) {
        logGeminiFailure(model, result.status, result.data, result.raw, attempt + 1);
        payload = base;
        result = await callGemini(model, payload, slot());
      }
      if (result.ok) return { result, model };
      last = result;
      if (result.status === 429 || (result.status !== 500 && result.status !== 503)) {
        logGeminiFailure(model, result.status, result.data, result.raw, attempt + 1);
        return { result, model };
      }
      logGeminiFailure(model, result.status, result.data, result.raw, attempt + 1);
      if (attempt < 2) await wait(retryDelay(result, attempt));
    } catch (error) {
      last = { status: 0, ok: false, data: null, raw: '', errorName: error && error.name };
      logGeminiFailure(model, 0, null, '', attempt + 1, error && error.name);
      if (attempt < 2) await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  return { result: last || { status: 503, ok: false, data: null, raw: '' }, model };
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
  const clean = x => String(x || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  /* étapes : indispensables pour afficher la recette */
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(x => clean(x).slice(0, 280)).filter(x => x.length >= 5).slice(0, 8);
  if (steps.length < 2) return null;
  /* matériel : uniquement celui que la personne possède */
  const equipment = [...new Set((Array.isArray(raw.equipment) ? raw.equipment : []).map(String))];
  if (equipment.some(e => !EQUIP_IDS.includes(e) || !prefs.equip.includes(e))) return null;
  /* temps : préparation + cuisson, ou l'ancien champ « minutes » à défaut */
  const hasPC = raw.prep != null || raw.cook != null;
  const prep = Math.min(60, Math.max(0, Math.round(Number(raw.prep) || 0)));
  const cook = Math.min(150, Math.max(0, Math.round(Number(raw.cook) || 0)));
  const total = Math.min(180, Math.max(10, hasPC ? prep + cook : Math.round(Number(raw.minutes) || 30)));
  const prepOut = hasPC ? Math.min(prep, total) : Math.min(10, total);
  const metas = ids.map(id => INGREDIENTS[id]);
  const r = {
    n: name,
    t: total,
    p: prepOut,
    s: steps,
    eq: equipment,
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
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  const base = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 16000 }
  };
  try {
    /* Gemini peut renvoyer 503 en période de surcharge : 3 essais avec attente progressive. */
    const withSchema = {
      ...base,
      generationConfig: { ...base.generationConfig, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } } }
    };

    let outcome = await generateWithModel(MODEL, withSchema, base, deadline);
    let r = outcome.result;

    // Modèle de secours désactivé par défaut. Il faut le configurer explicitement dans Vercel.
    if ((!r || !r.ok) && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL && [0, 500, 503].includes(r && r.status)) {
      console.warn('Gemini primary unavailable; trying configured fallback model', JSON.stringify({ primary: MODEL, fallback: FALLBACK_MODEL, status: r && r.status }));
      outcome = await generateWithModel(FALLBACK_MODEL, withSchema, base, deadline);
      r = outcome.result;
    }

    if (!r || !r.ok) {
      const status = r && r.status;
      if (status === 429) return res.status(429).json({ error: 'quota' });
      return res.status(502).json({ error: status === 503 ? 'service_indisponible' : 'ia_indisponible' });
    }

    const data = r.data || {};
    const text = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
    const parsed = extractJson(text);
    const list = parsed && Array.isArray(parsed.recipes) ? parsed.recipes : [];
    const seen = new Set();
    const recipes = list.map(x => convert(x, prefs)).filter(x => x && !seen.has(x.id) && seen.add(x.id)).slice(0, prefs.want);
    if (!recipes.length) {
      const candidate = (data.candidates || [])[0] || {};
      console.error('Gemini returned no usable recipes', JSON.stringify({
        model: outcome.model,
        finishReason: candidate.finishReason || null,
        blockReason: data.promptFeedback && data.promptFeedback.blockReason || null,
        responseTextLength: text.length
      }));
      return res.status(502).json({ error: 'reponse_inutilisable' });
    }
    return res.status(200).json({ recipes, model: outcome.model });
  } catch (e) {
    console.error('Erreur IA inattendue', JSON.stringify({ name: e && e.name, message: String(e && e.message || 'Erreur inconnue').slice(0, 500) }));
    return res.status(502).json({ error: 'ia_indisponible' });
  }
};
