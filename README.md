# Caddie avec l'IA

Ce dossier contient le site complet et son petit serveur IA.

```
index.html          le site (déjà réglé pour appeler /api/menus)
api/menus.js        le serveur : il appelle Gemini avec ta clé secrète et vérifie les réponses
lib/catalogue.js    la liste des ingrédients que l'IA a le droit d'utiliser
```

## Mise en ligne, pas à pas

### 1. Obtenir une clé Gemini (gratuit)
1. Va sur https://aistudio.google.com et connecte-toi avec ton compte Google.
2. Cherche « Get API key » (obtenir une clé API), crée une clé, copie-la.
3. Garde-la pour toi. Ne la colle jamais dans index.html ni dans un message.

### 2. Mettre les fichiers sur GitHub
1. Crée un compte sur https://github.com si besoin.
2. « New repository » : nom `caddie`, laisse-le en **Private**, puis « Create repository ».
3. Clique « uploading an existing file », glisse tout le contenu du dossier (index.html, api, lib), puis « Commit changes ».
   Vérifie que les dossiers `api` et `lib` sont bien présents.

### 3. Publier avec Vercel (gratuit)
1. Va sur https://vercel.com et connecte-toi avec GitHub.
2. « Add New… » puis « Project », choisis le dépôt `caddie`, « Import ».
3. Ne change aucun réglage de build. Avant de cliquer « Deploy », ouvre « Environment Variables » et ajoute :
   - Name : `GEMINI_API_KEY`
   - Value : ta clé
4. Clique « Deploy ». Au bout d'une minute, Vercel te donne l'adresse de ton site.

### 4. Tester
Ouvre l'adresse, fais le parcours jusqu'à « Composer mes menus ». Les recettes venant de l'IA ont une pastille « IA ».
Si aucune pastille n'apparaît, le site a utilisé ses recettes de secours. Voir « Si ça ne marche pas ».

## Nouveautés
- **Matériel** : une étape du questionnaire (après « À éviter ») où l'on coche ce que l'on possède : plaques, four, micro-ondes, air fryer, cocotte-minute, robot cuiseur, mijoteuse, cuiseur à riz, mixeur. Les recettes qui demandent un appareil absent sont écartées, et l'IA ne peut utiliser que le matériel coché.
- **Le double de recettes** : l'IA génère 2 fois plus de recettes que de repas demandés (28 maximum). Le site garde les meilleures pour le budget ; les autres sont des « idées de réserve » utilisées par « Autre idée » et « Ajouter une recette ».
- **Détail d'une recette** : toucher une recette du menu ouvre une fiche (préparation, cuisson, temps total, quantités pour le nombre de personnes, matériel, étapes, allergènes).
- **Onglet Recettes** : sur l'écran « Ta liste de courses », l'onglet « Recettes » déplie le détail de toutes les recettes du menu, avec un bouton pour les copier.

## Comment ça marche
1. Le site envoie tes réponses (dont le matériel) à `/api/menus`.
2. Le serveur donne à Gemini la liste des ingrédients autorisés, ton matériel, tes envies et tes exclusions, et lui demande le double de recettes avec leurs étapes.
3. Il vérifie chaque recette : ingrédients connus, quantités raisonnables, aucun aliment à éviter, matériel possédé, étapes présentes.
   Le régime, les allergènes et les étiquettes sont déduits des ingrédients par le serveur, jamais par l'IA.
4. Le site calcule lui-même les prix. L'IA ne voit pas le budget en euros du panier, seulement un objectif par repas.
5. Si l'IA est lente, en panne ou a atteint sa limite gratuite, le site retombe sur ses recettes intégrées.

## Réglages utiles
- `GEMINI_MODEL` (variable facultative) : modèle principal. Par défaut `gemini-3.5-flash-lite`.
- `GEMINI_FALLBACK_MODEL` (facultative, vide par défaut) : modèle de secours essayé uniquement après 3 échecs temporaires du modèle principal. Ne l'active qu'après avoir vérifié qu'il est disponible pour ton projet et consulté son tarif/quotas. Il peut consommer un quota différent ou être payant.
- En cas de 500/503 ou de timeout, le serveur effectue jusqu'à 3 tentatives avec attente progressive. Les erreurs 429 (quota) ne sont pas répétées automatiquement.
- `vercel.json` fixe la durée maximale de la fonction IA à 60 secondes ; vérifie que ton offre Vercel autorise cette durée. Comme l'IA écrit maintenant le double de recettes avec leurs étapes, une génération prend de 10 à 30 secondes. Le serveur arrête de relancer Gemini avant la limite des 60 s, et le site retombe alors sur ses recettes intégrées (qui ont aussi leurs étapes).
- Ajouter un ingrédient : ajoute-le dans la liste `RAW` de `index.html` ET dans `lib/catalogue.js`.
- Après chaque modification d'une variable d'environnement, il faut redéployer.

## Si ça ne marche pas
- Pas de pastille « IA » : dans Vercel, ouvre ton projet puis « Logs » (ou l'onglet « Functions »), refais un parcours et regarde l'erreur.
  - `cle_manquante` : la variable `GEMINI_API_KEY` n'existe pas ou le projet n'a pas été redéployé après l'ajout.
  - `quota` : la limite gratuite de Google est atteinte, réessaie plus tard.
  - `service_indisponible` : Google a renvoyé 503 après les nouvelles tentatives ; consulte les logs Vercel pour le message détaillé. C'est généralement une surcharge temporaire côté Google.
  - `ia_indisponible` : autre erreur Google ou problème réseau ; les logs Vercel affichent maintenant le statut et le message renvoyés par Google. Vérifie aussi la clé et `GEMINI_MODEL`.
- Le lien te demande de te connecter à Vercel : va dans Settings, Deployment Protection, et désactive la protection pour la production.

## Combien de personnes par jour ?
Chaque parcours terminé fait une requête à l'IA, et « Tout recomposer » en fait une de plus.
Google ne publie plus ses limites gratuites. Mesures relevées par des tiers en automne 2026, par projet et sans garantie :
- `gemini-3.5-flash-lite` : environ 15 requêtes par minute et 500 par jour, soit entre 250 et 500 personnes par jour selon qu'elles recomposent ou non.
- `gemini-3.8-flash` : environ 5 par minute et 20 par jour.
Le compteur du jour repart à zéro vers 9 h, heure de Paris. Tes vraies limites sont visibles dans ton compte AI Studio.
Quand la limite est atteinte, personne n'est bloqué : le site utilise ses recettes intégrées pour les visiteurs suivants.

## Sécurité
- La clé reste dans Vercel. Elle n'apparaît dans aucun fichier du site.
- N'importe qui connaissant l'adresse peut appeler `/api/menus` et consommer ta limite gratuite. Le serveur freine les rafales (8 demandes par minute et par adresse), mais pour un vrai lancement il faudra ajouter une protection anti-abus (captcha ou comptes).
- Le serveur n'envoie à Google que des préférences de repas, aucune donnée personnelle.
