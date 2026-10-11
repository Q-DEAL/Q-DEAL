# Q DEAL — site

Site statique modifiable directement dans ses fichiers HTML.

## Pages

- `index.html` — accueil : nettoyage pour les entreprises, étudiants, pros et agenda intelligent
- `about-us.html` — présentation
- `contact.html` — page contact
- `devenir-prestataire.html` — inscription des prestataires : étudiants maintenant, professionnels bientôt (bouton « Devenir prestataire ») ; le formulaire (`prestataire.js`) couvre identité, services, zone (point + rayon, carte) et disponibilités (semaine type, périodes d’indisponibilité), enregistré dans le navigateur en attendant les comptes
- `demander-un-service.html` — page vide pour la demande d’un service (bouton « Demander un service »)
- `student-portal.html` — espace prestataire, `company-portal.html` — espace entreprise (voir plus bas)
- `prestations.html` — prestations autour d’un lieu (Strasbourg et ses environs) : carte et liste
- `post-task.html` — demande de nettoyage, compteur de prestataires et candidats
- `suivi-administratif.html` — suivi administratif des étudiants prestataires par email (URSSAF, assurance RC Pro), avec le modèle d’email `assets/images/email-suivi-administratif.svg`
- `formations.html`, `faq.html` — sous-pages du menu Prestations
- `estimation.html`, `secteurs.html`, `comment-ca-marche.html`, `fonctionnalites.html` — sous-pages du menu Entreprises (guide vidéo IA, consignes, agenda intelligent, assistant)

`main.js` ajoute sur toutes les pages le chatbot de démonstration en bas à droite : des questions et réponses scénarisées, sans vraie conversation.

Le site est en français uniquement ; les anciennes adresses `*-fr.html` et `missions.html` redirigent vers ces pages.

## Voir le site en local

Depuis ce dossier, lancez un serveur statique :

```powershell
py -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000/](http://localhost:8000/).

## Modifier le site

- Modifiez le texte et les liens dans les fichiers HTML.
- `styles.css` contient les styles partagés et les règles responsive.
- `main.js` gère le menu mobile, les menus déroulants, la recherche de l’en-tête, les accordéons du pied de page et le formulaire de contact.
- Après une modification d’un fichier CSS ou JS, lancez `py scripts/version-assets.py` : il met à jour le `?v=` qui suit leur nom dans toutes les pages. GitHub Pages les met en cache 10 minutes, et une page à jour avec une ancienne feuille de style s’affiche cassée.
- `assets/images/` contient le logo (`qdeal-logo.svg`), le favicon et les images.
- Les polices Inter et Manrope sont chargées depuis Google Fonts, donc leur chargement demande une connexion internet.

## Espace prestataire

Les pages `student-*.html` forment l’espace du prestataire, étudiant (novice) ou artisan. Leurs noms de fichiers gardent le préfixe `student-` pour ne pas casser les liens existants. On y accède par le lien « Espace prestataire » du menu « Prestations ».

- `student-portal.html` : tableau de bord, qui commence par les **missions recommandées**. Chaque mission affiche l’entreprise (note et missions réalisées), la localisation floutée, 2 ou 3 mots-clés, une **Estimation IA** (toujours une fourchette indicative, jamais un prix ferme) et les boutons « Contacter l’entreprise » et « Proposer un prix ».
- `student-tasks.html`, `student-task.html`, `student-applications.html`, `student-schedule.html` : recherche, détail, candidatures, planning.
- `student-messages.html` : conversations avec les entreprises.
- `student-admin.html` : **suivi administratif**. Il affiche le CA par trimestre (missions Q DEAL et CA déclaré hors Q DEAL), la prochaine échéance, une check-list (à faire / fait) pour chaque démarche (déclaration et paiement URSSAF, CFE, déclaration de revenus) avec un court texte explicatif, et des rappels dans les notifications à J-30, J-15, J-7 et J-1. `student-documents.html` en est le second onglet : les pièces du dossier.
- `student-profile.html`, `student-notifications.html`.

## Espace entreprise

Les pages `company-*.html` forment l’espace du syndic ou de l’entreprise. On y accède par le lien « Espace entreprise » du menu « Entreprises ».

- `company-portal.html` : **profils recommandés**, classés à 50 % sur le score interne, 30 % sur la proximité du site et 20 % sur l’expérience dans le secteur de l’entreprise. Chaque carte affiche le nom (prénom + initiale), la note en étoiles et le nombre de notations, les secteurs les plus pratiqués, le résumé des compétences, la zone et le badge « Prêt à se déplacer » / « Ne se déplace pas », un bouton ♥ (favori) et « Échanger » (conversation, puis proposition de mission ponctuelle ou récurrente avec titulaire).
- `company-favorites.html` : prestataires likés.
- `company-messages.html` : conversations.

## Comment les portails sont construits

Tout est rendu en JavaScript, sans serveur :

| Fichier | Rôle |
| --- | --- |
| `ui.js` | Composants partagés : étoiles, chips, dialogue, fil de conversation, messagerie, graphique en barres, coque des portails (barre du haut, menu, tiroir mobile) |
| `market.js` | Règles de la place de marché : score interne, recommandations des deux côtés, estimation de prix, favoris, conversations, CA réalisé |
| `admin-rules.js` | Référentiel administratif (taux, plafonds, échéances, sources, date de relevé), trimestres, check-lists, régime de cotisations |
| `portal.js` / `company.js` | Les pages de chaque espace |
| `assets/demo/marketplace.js` | Données fictives écrites à la main : profils, historiques, entreprises, détails des missions, conversations de départ |

`assets/demo/prestations.js` reste l’instantané produit par la base. `marketplace.js` le complète, avec les mêmes identifiants, pour ce que la base ne contient pas encore. Ses blocs ont la forme des futures réponses de l’API.

C’est une démonstration sans compte. Le prestataire ou l’entreprise se choisit dans le menu de session (en haut à droite). Ce qu’on y fait est enregistré dans le navigateur : `qdeal.portal.v1` (espace prestataire), `qdeal.company.v1` (espace entreprise) et `qdeal.market.v1` (favoris et conversations, partagés par les deux espaces : un message envoyé côté entreprise arrive côté prestataire dans le même navigateur). « Réinitialiser cet espace » efface tout.

Règles respectées :

- **Le score n’est jamais affiché** et **ne tient pas compte des refus**. Aucun événement n’existe pour un refus ou une absence de réponse, et aucun ratio n’a les refus au dénominateur. Le score récompense les missions honorées, la ponctualité, les notes et la régularité. Seul un no-show (mission acceptée puis non honorée) le fait baisser.
- **Tout prix calculé est une estimation**, affichée « Estimation IA » sous forme de fourchette. Le prix se fixe en échangeant (« Proposer un prix »). `estimatePrice()` (dans `market.js`) remplace pour l’instant le modèle : seul son contenu changera.
- **Pas de faux prestataires en service.** Les profils de la démo sont fictifs et la page le dit. En production, le fil ne montre que des prestataires inscrits (voir db/README.md, « Côté entreprise »).
- **Précompte des cotisations (1er janvier 2027).** `QDA.regimeOn()` dit qui paie les cotisations sur le CA Q DEAL d’un trimestre, et `QDA.declaration()` sépare ce qui est prélevé par Q DEAL de ce qui reste à déclarer. Pour brancher le prélèvement : remplir `withheld` à partir des paiements, puis passer `RULES.withholding.enabled` à `true`.
- **Les valeurs du référentiel administratif sont à vérifier** avant la production (`RULES.checkedOn`, `RULES.sources`). Elles changent par décret.

## Localisation (PostGIS)

La base de données de la fonctionnalité de localisation et son environnement Codespaces sont décrits dans [db/README.md](db/README.md).

La barre de recherche de l’en-tête ouvre le choix du service (catégorie « Ménage », quatre familles, vingt-quatre services) et du lieu, puis mène à `prestations.html?service=…&lieu=…`. « Demander un service » mène à `post-task.html`. Ces pages (`localisation.js`) fonctionnent sans serveur, donc sur GitHub Pages : leurs données (`assets/demo/prestations.js` et `assets/demo/catalog.js`) sont produites par les vraies fonctions de la base, sur des données fictives. Le catalogue des services est défini dans `db/migrations/20261010180000_cleaning_services.sql`. Après un changement dans `db/`, régénérez-les avec `bash db/scripts/export-demo.sh` (dans le Codespace), puis lancez `py scripts/version-assets.py`. La carte utilise Leaflet 1.9.4, copié dans `assets/vendor/`, et les fonds de carte OpenStreetMap (connexion internet nécessaire).

## Formulaire de contact

Le formulaire de `contact.html` et `contact-fr.html` ouvre la messagerie du visiteur avec le message pré-rempli. L’adresse de réception est dans l’attribut `action="mailto:…"` du formulaire : remplacez le placeholder `contact@example.com` dans les deux pages.

Les boutons du site peuvent présélectionner le profil avec `?type=worker`, `?type=business` ou `?type=partner` (par exemple `contact.html?type=business#contact-form`).

Les inscriptions, annonces, estimations, messagerie et chatbot ne sont pas encore connectés à un service.
