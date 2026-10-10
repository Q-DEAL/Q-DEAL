# Q DEAL · localisation (PostGIS)

Base de données de la fonctionnalité de localisation : PostgreSQL 17 + PostGIS 3.5, migrations versionnées avec [dbmate](https://github.com/amacneil/dbmate), environnement GitHub Codespaces et tests automatiques.

## Démarrer dans un Codespace

Sur GitHub, branche `localisation-postgis` : **Code → Codespaces → Create codespace**, ou <https://codespaces.new/Q-DEAL/Q-DEAL?ref=localisation-postgis>.

À la création, le Codespace démarre PostGIS, applique les migrations et charge les données fictives de développement (Strasbourg). Ensuite, depuis la racine du dépôt :

```bash
psql                             # console SQL sur la base qdeal
bash db/scripts/test.sh          # migrations + règles de confidentialité (bases jetables)
bash db/scripts/dev-setup.sh     # remet la base de développement à zéro
dbmate new nom_du_changement     # crée une nouvelle migration dans db/migrations
```

Si GitHub refuse la création, l’organisation Q-DEAL doit autoriser Codespaces (Settings → Codespaces).

## Ce qui va où

| | Contenu | Environnements |
| --- | --- | --- |
| `db/migrations/` | Tables, règles, fonctions, droits, données de référence (catalogue des services de ménage, missions d’exemple, réglages) | Tous, production comprise |
| `db/fixtures/dev.sql` | Entreprises, prestataires et missions fictifs | Développement et tests uniquement |

`dev-setup.sh` refuse de s’exécuter sur une base qui n’est pas locale : les données fictives ne peuvent pas partir en production par erreur.

## Avant les premières inscriptions : missions d’exemple

**Côté prestataire.** Tant que sa zone compte moins de 3 missions réelles ouvertes, sa liste est complétée par des missions d’exemple :

- elles sont placées autour de lui, toujours au même endroit d’une visite à l’autre ;
- celles qui correspondent à ses compétences apparaissent en premier ;
- elles arrivent par la même fonction et dans le même format que les vraies, avec `is_example = true`, sans identifiant de mission, sans entreprise et sans adresse ;
- elles ne peuvent pas être acceptées.

L’écran doit afficher un badge « Exemple » sur ces missions.

La transition se fait toute seule, zone par zone : chaque mission réelle publiée près d’un prestataire remplace un exemple, sans déploiement ni changement de code. Une fois l’activité lancée, on peut aussi couper les exemples partout d’un coup.

**Côté entreprise.** Aucun exemple et aucun faux prestataire : le compteur ne compte que des prestataires réels. Sous 3, il renvoie `qualified_count = NULL` et l’écran affiche « Moins de 3 prestataires qualifiés à moins de 10 km pour l’instant : votre mission leur sera proposée dès leur inscription ».

Afficher un faux compteur ou de faux candidats ferait publier des entreprises qui n’auraient aucune réponse. C’est une pratique commerciale trompeuse, et cela ferait perdre ces premiers clients. Le seuil empêche aussi de localiser un prestataire seul dans sa zone en déplaçant un brouillon.

**Réglages** (table `core.config`, une seule ligne, modifiable sans déploiement) :

```sql
UPDATE core.config SET examples_target = 5;        -- nombre minimum de missions affichées (exemples compris)
UPDATE core.config SET examples_enabled = false;   -- coupe tous les exemples
UPDATE core.config SET count_display_min = 5;      -- seuil d’affichage du compteur entreprise
```

## Fonctions appelées par l’application (schéma `api`)

**Prestataire**

- `missions_near_provider(prestataire, rayon_km, langue, limite)` : carte et liste, les plus proches d’abord, 100 lignes par défaut (500 au maximum).

  | | Avant acceptation | Après acceptation |
  | --- | --- | --- |
  | Point | Flouté, cercle de 1 km (`precision_m = 1000`) | Exact (`precision_m = 0`) |
  | Distance | Au kilomètre | À 100 m |
  | Adresse | Code postal et ville | Adresse complète |

- `accept_mission(prestataire, mission)` : vérifie la mission, les compétences et le rayon, puis renvoie l’adresse exacte.
- `decline_mission(prestataire, mission)` : retire la mission de sa liste.
- `set_provider_location(prestataire, lon, lat, rayon_km)` : met à jour sa position et son rayon (1 à 50 km).

**Entreprise**

- `create_mission(entreprise, titre, adresse, code_postal, ville, lon, lat, début, compétences[], description)` : crée un brouillon.
- `qualified_providers(entreprise, mission, 10)` : renvoie le compteur (`qualified_count`, `display_min`).
- `publish_mission(entreprise, mission)` : publie et renvoie le compteur.
- `mission_applicants(entreprise, mission)` : ceux qui ont accepté (prénom, compétences, note, nombre d’avis, distance au kilomètre).

**Codes d’erreur**, à traduire en réponses HTTP :

| Code | Signification | HTTP |
| --- | --- | --- |
| `QD001` | Prestataire introuvable ou inactif | 404 |
| `QD002` | Mission introuvable, pas ouverte, ou d’une autre entreprise | 404 |
| `QD003` | Compétence requise manquante | 422 |
| `QD004` | Mission hors du rayon du prestataire | 422 |
| `QD005` | Paramètre invalide | 422 |
| `QD006` | Entreprise introuvable | 404 |

Une entreprise reçoit la même erreur pour une mission inexistante et pour la mission d’une autre entreprise : elle ne peut pas deviner les identifiants des autres.

## Pages Missions et Publier une mission (GitHub Pages)

GitHub Pages ne sert que des fichiers statiques : `missions*.html` et `post-task*.html` lisent un instantané produit par `bash db/scripts/export-demo.sh`. Le script applique les migrations sur une base jetable, charge `db/fixtures/dev.sql` et `db/demo/extra.sql` (données fictives), puis appelle les fonctions `api` :

- pour chaque lieu proposé par la recherche (Strasbourg et ses quartiers, Colmar, les grandes villes…), un visiteur placé là, avec toutes les compétences et un rayon de 10 km : missions avant et après acceptation, missions d’exemple ;
- pour cinq adresses du formulaire et chacun des vingt-quatre services : compteur et candidats.

Il écrit `assets/demo/missions.js` (données des deux pages) et `assets/demo/catalog.js` (lieux, familles et services, chargé par la barre de recherche sur toutes les pages).

`localisation.js` ne rejoue que deux règles : combien d’exemples complètent une liste, et quels candidats proposent le service demandé. Le script échoue si ce rejeu diffère de ce que renvoie la base, et la CI vérifie que l’instantané committé est à jour (`export-demo.sh --check`).

Les pages indiquent qu’il s’agit de missions et de prestataires fictifs. Leurs adresses ne désignent aucun logement précis : lieux publics, ou rue avec un numéro d’appartement fictif.

## Protection des adresses

- **Point flouté tiré une seule fois par adresse**, conservé ensuite. S’il était retiré à chaque lecture, quelques lectures suffiraient à retrouver l’adresse par moyenne.
- **Distances calculées depuis le point flouté et arrondies au kilomètre.** Sinon, un prestataire qui se déplace en relevant des distances exactes pourrait retrouver l’adresse par triangulation.
- **Accès verrouillé dans la base.** Le rôle `qdeal_app` ne peut ni lire ni modifier les tables (schéma `core`) : il ne peut qu’appeler les fonctions `api`. Une erreur dans le code de l’application ne peut donc pas exposer une position exacte.

## Mise en production

1. **Base.** PostgreSQL 17 avec l’extension PostGIS disponible. C’est le cas de la plupart des offres managées (Scaleway, OVHcloud, AWS RDS, Supabase…).
2. **Migrations.** Avec un compte propriétaire de la base :

   ```bash
   DATABASE_URL='postgres://…?sslmode=require' DBMATE_MIGRATIONS_DIR=db/migrations DBMATE_NO_DUMP_SCHEMA=true dbmate up
   ```

   À lancer depuis la CI ou le pipeline de déploiement à chaque mise en production. Ne jamais charger `db/fixtures/`.
3. **Compte de l’API.** Créé une seule fois, avec un mot de passe tiré du gestionnaire de secrets (jamais écrit dans le dépôt) :

   ```sql
   CREATE ROLE qdeal_api LOGIN PASSWORD '…';
   GRANT qdeal_app TO qdeal_api;
   ```

   L’API se connecte avec `qdeal_api` et n’a ainsi que les droits de `qdeal_app`.
4. **Évolutions.** Toute modification passe par une nouvelle migration (`dbmate new …`), avec sa section `migrate:down`. On ne modifie jamais une migration déjà appliquée en production.

La CI (`.github/workflows/db.yml`) rejoue `db/scripts/test.sh` à chaque changement de `db/`. Le script applique toutes les migrations sur une base vide, les annule toutes, les réapplique, puis vérifie chaque règle de confidentialité.

## Côté API

- Passer aux fonctions l’identifiant du prestataire ou de l’entreprise **connecté**, jamais une valeur envoyée par le navigateur.
- Géocoder l’adresse saisie par l’entreprise avant `create_mission`, par exemple avec la Base Adresse Nationale (api-adresse.data.gouv.fr).
- Limiter le nombre d’appels à `qualified_providers` par entreprise.

**Point à trancher :** l’adresse exacte est révélée dès qu’un prestataire accepte. Pour les conciergeries, on peut préférer la réserver au prestataire retenu : il faut alors une étape « choisir un prestataire » côté entreprise.
