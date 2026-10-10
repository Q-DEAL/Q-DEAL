# Q DEAL — site

Site statique modifiable directement dans ses fichiers HTML.

## Pages

- `index.html` — accueil
- `about-us.html` — présentation
- `contact.html` — page contact
- `devenir-prestataire.html` — page vide pour l’inscription des prestataires (bouton « Devenir prestataire »)
- `demander-un-service.html` — page vide pour la demande d’un service (bouton « Demander un service »)
- `student-portal.html` — espace étudiant (voir plus bas)
- `prestations.html` — prestations autour d’un lieu (Strasbourg et ses environs) : carte et liste
- `post-task.html` — publication d’une mission, compteur de prestataires et candidats

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

## Espace étudiant

Les pages `student-*.html` forment l’espace du prestataire : tableau de bord (`student-portal.html`), recherche de prestations (`student-tasks.html`) et détail (`student-task.html`), candidatures, planning, suivi administratif, profil et notifications. On y accède par le lien « Espace étudiant » du menu « Prestations ». Tout est rendu par `portal.js`, à partir du même instantané que `prestations.html` (`assets/demo/prestations.js`).

C’est une démonstration sans compte ni serveur : l’étudiant est choisi dans le menu de session (en haut à droite), et ses candidatures, son profil et son dossier sont enregistrés dans le navigateur (clé `localStorage` `qdeal.portal.v1`, effaçable par « Réinitialiser cet espace »). Les règles de la base sont rejouées : compétences requises (QD003), rayon de déplacement (QD004), prestations d’exemple non acceptables, adresse exacte révélée après candidature. Les documents administratifs ne sont jamais envoyés : seul le nom du fichier choisi est noté.

## Localisation (PostGIS)

La base de données de la fonctionnalité de localisation et son environnement Codespaces sont décrits dans [db/README.md](db/README.md).

La barre de recherche de l’en-tête ouvre le choix du service (catégorie « Ménage », quatre familles, vingt-quatre services) et du lieu, puis mène à `prestations.html?service=…&lieu=…`. « Demander un service » mène à `post-task.html`. Ces pages (`localisation.js`) fonctionnent sans serveur, donc sur GitHub Pages : leurs données (`assets/demo/prestations.js` et `assets/demo/catalog.js`) sont produites par les vraies fonctions de la base, sur des données fictives. Le catalogue des services est défini dans `db/migrations/20261010180000_cleaning_services.sql`. Après un changement dans `db/`, régénérez-les avec `bash db/scripts/export-demo.sh` (dans le Codespace), puis lancez `py scripts/version-assets.py`. La carte utilise Leaflet 1.9.4, copié dans `assets/vendor/`, et les fonds de carte OpenStreetMap (connexion internet nécessaire).

## Formulaire de contact

Le formulaire de `contact.html` et `contact-fr.html` ouvre la messagerie du visiteur avec le message pré-rempli. L’adresse de réception est dans l’attribut `action="mailto:…"` du formulaire : remplacez le placeholder `contact@example.com` dans les deux pages.

Les boutons du site peuvent présélectionner le profil avec `?type=worker`, `?type=business` ou `?type=partner` (par exemple `contact.html?type=business#contact-form`).

Les inscriptions, annonces, estimations, messagerie et chatbot ne sont pas encore connectés à un service.
