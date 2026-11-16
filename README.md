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

## Comment ça marche
1. Le site envoie tes réponses à `/api/menus`.
2. Le serveur donne à Gemini la liste des ingrédients autorisés, tes envies et tes exclusions.
3. Il vérifie chaque recette : ingrédients connus, quantités raisonnables, aucun aliment à éviter.
   Le régime, les allergènes et les étiquettes sont déduits des ingrédients par le serveur, jamais par l'IA.
4. Le site calcule lui-même les prix. L'IA ne voit pas le budget en euros du panier, seulement un objectif par repas.
5. Si l'IA est lente, en panne ou a atteint sa limite gratuite, le site retombe sur ses recettes intégrées.

## Réglages utiles
- `GEMINI_MODEL` (variable d'environnement facultative) : change de modèle sans toucher au code. Par défaut `gemini-3.8-flash`.
  Si Google renomme ou retire ce modèle, c'est ici qu'on change.
- Ajouter un ingrédient : ajoute-le dans la liste `RAW` de `index.html` ET dans `lib/catalogue.js`.
- Après chaque modification d'une variable d'environnement, il faut redéployer.

## Si ça ne marche pas
- Pas de pastille « IA » : dans Vercel, ouvre ton projet puis « Logs » (ou l'onglet « Functions »), refais un parcours et regarde l'erreur.
  - `cle_manquante` : la variable `GEMINI_API_KEY` n'existe pas ou le projet n'a pas été redéployé après l'ajout.
  - `quota` : la limite gratuite de Google est atteinte, réessaie plus tard.
  - `ia_indisponible` : erreur côté Google (modèle renommé, clé refusée). Vérifie la clé et `GEMINI_MODEL`.
- Le lien te demande de te connecter à Vercel : va dans Settings, Deployment Protection, et désactive la protection pour la production.

## Sécurité
- La clé reste dans Vercel. Elle n'apparaît dans aucun fichier du site.
- N'importe qui connaissant l'adresse peut appeler `/api/menus` et consommer ta limite gratuite. Le serveur freine les rafales (8 demandes par minute et par adresse), mais pour un vrai lancement il faudra ajouter une protection anti-abus (captcha ou comptes).
- Le serveur n'envoie à Google que des préférences de repas, aucune donnée personnelle.
