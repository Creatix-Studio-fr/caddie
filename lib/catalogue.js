/* Catalogue des ingrédients connus du site.
   À garder identique à la liste RAW de index.html : quand tu ajoutes un ingrédient, ajoute-le aux deux endroits.
   d = viande/poisson, c = allergènes, t = étiquettes. L'IA ne décide jamais de ces champs. */
'use strict';
module.exports={INGREDIENTS:{
 "pates": {
  "name": "Pâtes",
  "unit": "g",
  "pack": 500,
  "price": 0.95,
  "noun": "",
  "d": null,
  "c": [
   "gluten"
  ],
  "t": []
 },
 "riz": {
  "name": "Riz long",
  "unit": "g",
  "pack": 1000,
  "price": 2.2,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "pdt": {
  "name": "Pommes de terre",
  "unit": "g",
  "pack": 2500,
  "price": 3.8,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "lentilles": {
  "name": "Lentilles vertes",
  "unit": "g",
  "pack": 500,
  "price": 1.9,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "semoule": {
  "name": "Semoule",
  "unit": "g",
  "pack": 500,
  "price": 1.25,
  "noun": "",
  "d": null,
  "c": [
   "gluten"
  ],
  "t": []
 },
 "poischiches": {
  "name": "Pois chiches",
  "unit": "pc",
  "pack": 1,
  "price": 0.95,
  "noun": "boîte",
  "d": null,
  "c": [],
  "t": []
 },
 "harirouges": {
  "name": "Haricots rouges",
  "unit": "pc",
  "pack": 1,
  "price": 0.9,
  "noun": "boîte",
  "d": null,
  "c": [],
  "t": []
 },
 "mais": {
  "name": "Maïs",
  "unit": "pc",
  "pack": 1,
  "price": 0.85,
  "noun": "boîte",
  "d": null,
  "c": [],
  "t": []
 },
 "tomconc": {
  "name": "Tomates concassées",
  "unit": "pc",
  "pack": 1,
  "price": 0.85,
  "noun": "boîte",
  "d": null,
  "c": [],
  "t": []
 },
 "passata": {
  "name": "Coulis de tomate",
  "unit": "g",
  "pack": 500,
  "price": 1,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "laitcoco": {
  "name": "Lait de coco",
  "unit": "ml",
  "pack": 400,
  "price": 1.6,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "pesto": {
  "name": "Pesto",
  "unit": "g",
  "pack": 190,
  "price": 1.95,
  "noun": "",
  "d": null,
  "c": [
   "lactose"
  ],
  "t": []
 },
 "curry": {
  "name": "Curry en poudre",
  "unit": "g",
  "pack": 40,
  "price": 1.6,
  "noun": "",
  "d": null,
  "c": [],
  "t": [
   "epice"
  ]
 },
 "thon": {
  "name": "Thon au naturel",
  "unit": "pc",
  "pack": 1,
  "price": 1.6,
  "noun": "boîte",
  "d": "poisson",
  "c": [],
  "t": []
 },
 "tortilla": {
  "name": "Tortillas de blé",
  "unit": "pc",
  "pack": 8,
  "price": 1.95,
  "noun": "tortilla",
  "d": null,
  "c": [
   "gluten"
  ],
  "t": []
 },
 "poulet": {
  "name": "Filets de poulet",
  "unit": "g",
  "pack": 500,
  "price": 4.9,
  "noun": "",
  "d": "viande",
  "c": [],
  "t": [
   "poulet"
  ]
 },
 "cuisses": {
  "name": "Cuisses de poulet",
  "unit": "g",
  "pack": 1000,
  "price": 5.5,
  "noun": "",
  "d": "viande",
  "c": [],
  "t": [
   "poulet"
  ]
 },
 "steak": {
  "name": "Steak haché",
  "unit": "g",
  "pack": 500,
  "price": 5.2,
  "noun": "",
  "d": "viande",
  "c": [],
  "t": [
   "boeuf"
  ]
 },
 "saucisses": {
  "name": "Saucisses de Toulouse",
  "unit": "g",
  "pack": 400,
  "price": 3.6,
  "noun": "",
  "d": "viande",
  "c": [
   "porc"
  ],
  "t": []
 },
 "lardons": {
  "name": "Lardons fumés",
  "unit": "g",
  "pack": 200,
  "price": 1.99,
  "noun": "",
  "d": "viande",
  "c": [
   "porc"
  ],
  "t": []
 },
 "jambon": {
  "name": "Jambon blanc",
  "unit": "g",
  "pack": 160,
  "price": 2.4,
  "noun": "",
  "d": "viande",
  "c": [
   "porc"
  ],
  "t": []
 },
 "saumon": {
  "name": "Pavés de saumon",
  "unit": "g",
  "pack": 250,
  "price": 4.9,
  "noun": "",
  "d": "poisson",
  "c": [],
  "t": []
 },
 "cabillaud": {
  "name": "Filets de cabillaud",
  "unit": "g",
  "pack": 400,
  "price": 4.5,
  "noun": "",
  "d": "poisson",
  "c": [],
  "t": []
 },
 "epinards": {
  "name": "Épinards surgelés",
  "unit": "g",
  "pack": 750,
  "price": 2.1,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "hverts": {
  "name": "Haricots verts surgelés",
  "unit": "g",
  "pack": 1000,
  "price": 2.6,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "oeufs": {
  "name": "Œufs",
  "unit": "pc",
  "pack": 12,
  "price": 3.1,
  "noun": "œuf",
  "d": null,
  "c": [
   "oeuf"
  ],
  "t": []
 },
 "lait": {
  "name": "Lait",
  "unit": "ml",
  "pack": 1000,
  "price": 1.15,
  "noun": "",
  "d": null,
  "c": [
   "lactose"
  ],
  "t": []
 },
 "creme": {
  "name": "Crème fraîche",
  "unit": "ml",
  "pack": 200,
  "price": 1.2,
  "noun": "",
  "d": null,
  "c": [
   "lactose"
  ],
  "t": []
 },
 "gruyere": {
  "name": "Gruyère râpé",
  "unit": "g",
  "pack": 200,
  "price": 2.1,
  "noun": "",
  "d": null,
  "c": [
   "lactose"
  ],
  "t": []
 },
 "feta": {
  "name": "Feta",
  "unit": "g",
  "pack": 200,
  "price": 2.3,
  "noun": "",
  "d": null,
  "c": [
   "lactose"
  ],
  "t": []
 },
 "oignons": {
  "name": "Oignons",
  "unit": "g",
  "pack": 1000,
  "price": 1.7,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "ail": {
  "name": "Ail",
  "unit": "pc",
  "pack": 10,
  "price": 0.45,
  "noun": "gousse",
  "d": null,
  "c": [],
  "t": []
 },
 "carottes": {
  "name": "Carottes",
  "unit": "g",
  "pack": 1000,
  "price": 1.3,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "courgettes": {
  "name": "Courgettes",
  "unit": "g",
  "pack": 500,
  "price": 1.4,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "tomates": {
  "name": "Tomates",
  "unit": "g",
  "pack": 500,
  "price": 1.9,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "poivrons": {
  "name": "Poivrons",
  "unit": "pc",
  "pack": 3,
  "price": 2.6,
  "noun": "poivron",
  "d": null,
  "c": [],
  "t": []
 },
 "champis": {
  "name": "Champignons de Paris",
  "unit": "g",
  "pack": 250,
  "price": 1.6,
  "noun": "",
  "d": null,
  "c": [],
  "t": []
 },
 "brocoli": {
  "name": "Brocoli",
  "unit": "pc",
  "pack": 1,
  "price": 1.6,
  "noun": "brocoli",
  "d": null,
  "c": [],
  "t": []
 },
 "salade": {
  "name": "Salade verte",
  "unit": "pc",
  "pack": 1,
  "price": 1.1,
  "noun": "salade",
  "d": null,
  "c": [],
  "t": []
 }
}};
