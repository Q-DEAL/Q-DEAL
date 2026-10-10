# Q DEAL · localisation (PostGIS)

Base de données de la fonctionnalité de localisation, avec un environnement GitHub Codespaces prêt à l’emploi.

## Ouvrir le Codespace

1. Sur GitHub, ouvrez le dépôt sur la branche `localisation-postgis`, puis **Code → Codespaces → Create codespace**.
   Lien direct : <https://codespaces.new/Q-DEAL/Q-DEAL?ref=localisation-postgis>
2. À la création, le Codespace démarre PostgreSQL 17 + PostGIS 3.5, crée la base `qdeal` et charge les données de démonstration (environ 1 minute).
3. Dans le terminal du Codespace :

```bash
psql                      # console SQL, déjà connectée à la base qdeal
bash db/scripts/test.sh   # vérifie les règles de confidentialité
bash db/scripts/setup.sh  # remet la base à zéro avec les données de démo
```

L’extension SQLTools est installée avec une connexion « qdeal (PostGIS) » déjà configurée.

Si GitHub refuse la création, l’organisation Q-DEAL doit autoriser Codespaces dans ses paramètres (Settings → Codespaces).

## Règles appliquées

### Côté prestataire

`api.missions_near_provider(prestataire, rayon_km)` renvoie la carte et la liste des missions autour du prestataire :

| | Avant acceptation | Après acceptation |
| --- | --- | --- |
| Point sur la carte | Point flouté, à 1 km près (`precision_m = 1000`) | Point exact (`precision_m = 0`) |
| Distance | Au kilomètre près | À 100 m près |
| Adresse | Code postal et ville | Adresse complète |

`api.accept_mission(prestataire, mission)` vérifie que la mission est publiée, que le prestataire a toutes les compétences demandées et qu’elle est dans son rayon, puis renvoie l’adresse exacte. `api.decline_mission` retire la mission de sa liste.

### Côté entreprise

- Aucune carte et aucune position de prestataire.
- `api.qualified_providers_count(entreprise, mission, 10)` donne le compteur « N prestataires qualifiés à moins de 10 km ». Il compte les prestataires actifs, avec toutes les compétences demandées, et qui verront réellement la mission dans leur liste.
- `api.publish_mission(entreprise, mission)` publie un brouillon et renvoie ce compteur.
- `api.mission_applicants(entreprise, mission)` liste ceux qui ont accepté : prénom, compétences, note moyenne, nombre d’avis et distance arrondie au kilomètre.

Une entreprise ne peut interroger que ses propres missions.

## Protection des adresses

- **Point flouté tiré une seule fois.** Chaque mission reçoit un point aléatoire à moins de 1 km de l’adresse, conservé tant que l’adresse ne change pas. S’il était tiré à chaque lecture, quelques lectures suffiraient à retrouver l’adresse par moyenne.
- **Distances calculées depuis le point flouté et arrondies au kilomètre.** En se déplaçant et en relevant des distances exactes, un prestataire pourrait sinon retrouver l’adresse par triangulation.
- **Accès verrouillé dans la base.** Les tables (schéma `core`) ne sont pas lisibles par le rôle applicatif `qdeal_app`. Il ne peut qu’appeler les fonctions du schéma `api`, qui appliquent les règles ci-dessus. Une erreur dans le code de l’application ne peut donc pas exposer une position exacte.

Les tests (`db/tests/localisation_test.sql`) vérifient chacune de ces règles.

## À faire dans l’API (étape suivante)

- Passer aux fonctions l’identifiant du prestataire ou de l’entreprise **connecté**, jamais une valeur envoyée par le navigateur.
- Géocoder l’adresse saisie par l’entreprise avant `api.create_mission`, par exemple avec la Base Adresse Nationale (api-adresse.data.gouv.fr).
- Limiter le nombre d’appels au compteur : une entreprise qui multiplie les brouillons à des endroits différents pourrait sinon estimer où habitent les prestataires.

**Point à trancher :** l’adresse exacte est révélée dès qu’un prestataire accepte, comme demandé. Pour les conciergeries, on peut préférer ne la révéler qu’au prestataire retenu par l’entreprise : il faudrait alors ajouter une étape « choisir un prestataire » côté entreprise, et n’afficher l’adresse qu’après ce choix.

## Fichiers

- `.devcontainer/` : configuration du Codespace (conteneur de travail + PostGIS).
- `sql/01_schema.sql` : tables.
- `sql/02_privacy.sql` : floutage et arrondis.
- `sql/03_api.sql` : fonctions appelées par l’application et droits d’accès.
- `seed.sql` : données de démonstration autour de Strasbourg (personnes et adresses fictives).
- `tests/localisation_test.sql` : tests des règles de confidentialité.

Les mots de passe (`postgres`, `qdeal_app`) ne servent qu’au développement. Le port 5432 du Codespace reste privé par défaut.
