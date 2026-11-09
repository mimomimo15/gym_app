# Journal de gym

Site statique (GitHub Pages) pour noter ses entraînements : entraînements → exercices → sets (reps, poids), plus une page de stats (progression par exercice, records personnels).

## Comment ça marche

- Aucune donnée dans ce dépôt. Chaque personne garde son journal dans **son propre dépôt privé** GitHub (`<son-compte>/journal-gym`, fichier `entrainements.json`).
- Le site lit et écrit ce fichier avec un jeton « fine-grained » (permission *Contents : Read and write* sur ce seul dépôt), gardé dans le navigateur (`localStorage`, clés `jg_*`).
- Les instructions de connexion sont affichées sur la page d'accueil tant qu'on n'est pas connecté.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Journal : liste, ajout / modification / suppression, « Refaire », export CSV |
| `stats.html` | Stats : tuiles, progression par exercice (Chart.js), records personnels |
| `app.js` | Connexion GitHub, synchronisation (fusion par entraînement), calculs |
| `style.css` | Styles, mode sombre automatique |
| `manifest.webmanifest`, `icon*.png/svg` | Installation comme application |

## Mise en ligne

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
