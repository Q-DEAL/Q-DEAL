# Instructions pour Claude : site Qdeal

Ce fichier est lu automatiquement au début de chaque session de travail sur ce dépôt.
Le README décrit les pages et les règles en détail : ce fichier dit comment travailler.

## Le projet en bref

- Qdeal met en relation des entreprises (syndics de copropriété à Strasbourg en priorité) et des
  micro-entrepreneurs (étudiants, salariés, retraités, artisans) pour des missions courtes. Le
  prestataire fixe son prix et le reçoit en entier ; l'entreprise paie en plus la commission Qdeal.
- Ce dépôt est une **démonstration** : pages HTML, CSS et JavaScript, données fictives enregistrées
  dans le navigateur, sans comptes, sans serveur et sans vrai paiement. Elle sert à convaincre en
  interview. La vraie plateforme (v1 : comptes, base de données, paiement, factures) sera
  reconstruite sur une nouvelle base technique après les interviews. Ne pas sur-investir ici.
- Le fondateur, Romain Koenig, n'est pas développeur. Les sources de vérité métier (document de
  référence, Journal Qdeal) sont dans son projet Claude, pas dans ce dépôt. En cas de doute sur une
  règle métier (prix, commission, juridique), lui demander plutôt que deviner.

## Comment travailler

1. **Ne jamais pousser sur `main`.** GitHub Pages publie `main` sur
   https://q-deal.github.io/Q-DEAL/ : tout ce qui y arrive est public tout de suite.
2. Créer une branche par sujet, puis ouvrir une pull request **en français**, avec un résumé
   compréhensible par quelqu'un qui ne code pas (ce qui change pour l'utilisateur, comment le voir).
   Romain relit et clique lui-même sur « Merge ».
3. Après une modification de CSS ou de JavaScript : `python3 scripts/version-assets.py` (met à jour
   les numéros de version des fichiers, sinon les navigateurs gardent l'ancienne version en cache).
4. Avant de publier : ouvrir les pages touchées dans un navigateur (Playwright), sur ordinateur et à
   390 px de large, vérifier qu'il n'y a ni erreur JavaScript ni débordement horizontal, et faire
   des captures pour Romain.

## Données de démonstration

- `assets/demo/catalog.js` et `assets/demo/prestations.js` sont **générés** depuis la base PostGIS :
  ne jamais les modifier à la main. Modifier `db/migrations/` (catalogue, règles, en production
  aussi) ou `db/demo/extra.sql` (données de démo seulement), puis régénérer.
- `assets/demo/marketplace.js` (profils, conversations, détails des missions) se modifie à la main.
  Les identifiants de missions doivent correspondre à ceux de `prestations.js`.
- Base locale : PostgreSQL 16 et PostGIS s'installent avec `apt-get` (`postgresql-16`,
  `postgresql-16-postgis-3`) si Docker n'est pas disponible, puis `db/scripts/install-dbmate.sh`.
  Ensuite `db/scripts/test.sh` (tests), `db/scripts/export-demo.sh` (régénère) et
  `db/scripts/export-demo.sh --check` (le contrôle fait par GitHub sur chaque pull request).
- `db/fixtures/dev.sql` sert aux tests : ne pas y toucher pour la démo, utiliser `db/demo/extra.sql`.

## Règles métier à respecter

- Prix : `priceBreakdown()` dans `market.js`. Commission payée par l'entreprise : 15 % sur les 10
  premières missions du prestataire, 13 % de la 11e à la 30e, 11 % ensuite, 2 € minimum, plus 20 %
  de TVA sur la commission. Exemple de référence : 40 € donnent 47,20 € TTC.
- Les estimations de prix sont indicatives, jamais un prix ferme : le prestataire propose son prix.
- Missions au résultat, jamais à l'heure ; aucun métier réglementé (électricité, gaz, plomberie,
  sécurité privée, travaux en hauteur).
- Adresses jamais précises avant acceptation ; noms et entreprises de la démo toujours fictifs.
- Le dépôt est **public** : aucun mot de passe, clé d'API ni donnée personnelle réelle.

## Style

- Fond blanc, détails orange, logo « qdeal » en noir. Couleurs dans `styles.css` (`--orange`,
  `--orange-text`, `--peach`).
- Textes en français simple. Jamais le caractère tiret long. Pas d'emojis dans les pages.
