# Q DEAL — prototype bilingue

Site statique modifiable directement dans ses fichiers HTML, en français et en anglais.

## Pages

- `index.html` — accueil en anglais
- `about-us.html` — présentation en anglais
- `contact.html` — page contact en anglais
- `index-fr.html` — accueil en français
- `about-us-fr.html` — présentation en français
- `contact-fr.html` — page contact en français
- `missions.html` / `missions-fr.html` — missions autour d’un lieu : carte et liste (anglais / français)
- `post-task.html` / `post-task-fr.html` — publication d’une mission, compteur de prestataires et candidats (anglais / français)

## Voir le site en local

Depuis ce dossier, lancez un serveur statique :

```powershell
py -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000/](http://localhost:8000/) pour l’anglais ou [http://localhost:8000/index-fr.html](http://localhost:8000/index-fr.html) pour le français.

## Modifier le site

- Modifiez le texte et les liens dans les fichiers HTML.
- `styles.css` contient les styles partagés et les règles responsive.
- `main.js` gère le menu mobile, les menus déroulants, la recherche de l’en-tête, les accordéons du pied de page et le formulaire de contact.
- Après une modification d’un fichier CSS ou JS, lancez `py scripts/version-assets.py` : il met à jour le `?v=` qui suit leur nom dans toutes les pages. GitHub Pages les met en cache 10 minutes, et une page à jour avec une ancienne feuille de style s’affiche cassée.
- `assets/images/` contient le logo (`qdeal-logo.svg`), le favicon et les images.
- Les polices Inter et Manrope sont chargées depuis Google Fonts, donc leur chargement demande une connexion internet.

## Localisation (PostGIS)

La base de données de la fonctionnalité de localisation et son environnement Codespaces sont décrits dans [db/README.md](db/README.md).

La recherche de l’en-tête est une recherche de missions : une ville, un quartier ou un code postal mène à `missions-fr.html`, un autre mot cherche dans les missions ; elle propose aussi les pages du site. « Demander un service » mène à `post-task-fr.html`. Ces pages (`localisation.js`) fonctionnent sans serveur, donc sur GitHub Pages : leurs données (`assets/demo/missions.js` et `assets/demo/places.js`) sont produites par les vraies fonctions de la base, sur des données fictives signalées comme telles. Après un changement dans `db/`, régénérez-les avec `bash db/scripts/export-demo.sh` (dans le Codespace), puis lancez `py scripts/version-assets.py`. La carte utilise Leaflet 1.9.4, copié dans `assets/vendor/`, et les fonds de carte OpenStreetMap (connexion internet nécessaire).

## Formulaire de contact

Le formulaire de `contact.html` et `contact-fr.html` ouvre la messagerie du visiteur avec le message pré-rempli. L’adresse de réception est dans l’attribut `action="mailto:…"` du formulaire : remplacez le placeholder `contact@example.com` dans les deux pages.

Les boutons du site peuvent présélectionner le profil avec `?type=worker`, `?type=business` ou `?type=partner` (par exemple `contact-fr.html?type=business#contact-form`).

Les inscriptions, annonces, estimations, messagerie et chatbot ne sont pas encore connectés à un service.
