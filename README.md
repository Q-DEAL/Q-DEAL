# Q DEAL — prototype bilingue

Site statique modifiable directement dans ses fichiers HTML, en français et en anglais.

## Pages

- `index.html` — accueil en anglais
- `about-us.html` — présentation en anglais
- `contact.html` — page contact en anglais
- `index-fr.html` — accueil en français
- `about-us-fr.html` — présentation en français
- `contact-fr.html` — page contact en français

## Voir le site en local

Depuis ce dossier, lancez un serveur statique :

```powershell
py -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000/](http://localhost:8000/) pour l’anglais ou [http://localhost:8000/index-fr.html](http://localhost:8000/index-fr.html) pour le français.

## Modifier le site

- Modifiez le texte et les liens dans les six fichiers HTML.
- `styles.css` contient les styles partagés et les règles responsive.
- `main.js` gère le menu mobile et les accordéons du pied de page.
- `assets/images/` contient les images et le favicon Q DEAL.
- Les polices Inter et Manrope sont chargées depuis Google Fonts, donc leur chargement demande une connexion internet.

Le site présente le concept Q DEAL en développement. Les inscriptions, annonces, estimations, messagerie et chatbot sont des fonctionnalités envisagées, pas encore connectées à un service.
