# Journal de gym – contexte pour Claude Code

Site statique (GitHub Pages) où chaque personne note ses entraînements : entraînements → séances → exercices → sets (reps, poids), plus une page de stats. Installable comme application (PWA).

- **En ligne** : https://mimomimo15.github.io/gym_app/ (Pages : branche `main`, racine)
- **Utilisateur** : Justin (compte GitHub `mimomimo15`), francophone, pas développeur. Lui répondre en français, en langage simple. Il utilise surtout l'app sur **iPhone** (installée sur l'écran d'accueil) et envoie des captures d'écran quand quelque chose cloche.
- Tout le texte de l'interface, les commentaires et les messages de commit sont en français.

## Règles du projet

- **Aucun build, aucune dépendance** : HTML, CSS et JavaScript simples. Seule bibliothèque externe : Chart.js 4.4.1 via cdnjs (page Stats).
- **Aucune donnée personnelle dans ce dépôt** (il est public). Ne jamais y écrire de jeton ni de fichier d'entraînements.
- Pousser sur `main` met le site en ligne en une ou deux minutes. Pousser avec :
  `git fetch origin main && git rebase FETCH_HEAD && git push origin main`
- **À chaque changement d'un fichier du site, incrémenter `CACHE` dans `sw.js`** (`jg-v9` → `jg-v10`…), pour purger l'ancien cache des appareils.
- Échapper tout texte saisi par l'utilisateur avec `JG.esc` avant de l'insérer dans du HTML.
- Pas de `alert` / `confirm` : les confirmations sont dans la page (ex. suppression en deux clics).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Journal : connexion, liste regroupée, éditeur de séance, onglet Compte (unité, export CSV, déconnexion), bouton d'installation |
| `stats.html` | Stats : tuiles, progression par exercice (graphique + séances), records personnels |
| `app.js` | Objet global `JG` : connexion GitHub, synchronisation, données, calculs, icônes, état de synchro |
| `moves.js` | Objet global `JGMoves` : animations « comment faire » (bonhomme SVG) des exercices courants, reconnus d'après le nom. Bouton ▶ dans l'éditeur |
| `style.css` | Styles. Thème clair/sombre automatique, accent bleu, règles téléphone sous `@media (max-width: 640px)` |
| `sw.js` | Service worker (hors ligne, installation) |
| `manifest.webmanifest`, `icon*` | Métadonnées et icônes de l'application |

## Où vivent les données

Chaque personne a **son propre dépôt privé** `<son-compte>/journal-gym`, fichier `entrainements.json`. Le site le lit et l'écrit par l'API GitHub Contents avec un jeton « fine-grained » (Contents : Read and write sur ce seul dépôt).

- Connexion (`JG.connect`) : `GET /user` donne le compte, puis dépôt `<login>/journal-gym` par défaut (un autre nom peut être saisi).
- Le jeton et un cache des données restent dans `localStorage`, clés `jg_token`, `jg_repo`, `jg_login`, `jg_cache`, `jg_dirty`. Attention : `mimomimo15.github.io` héberge aussi le site de surf (même origine) ; garder le préfixe `jg_`.
- Personne ne voit les données des autres. Pour un ami sans compte GitHub, Justin peut créer un dépôt privé dans son compte et un jeton limité à ce dépôt.

### Format

```json
{ "version": 1, "unit": "lb", "unitAt": 0,
  "workouts": [
    { "id": "…", "date": "2026-11-09", "name": "Push", "note": "",
      "createdAt": 0, "updatedAt": 0,
      "exercises": [
        { "type": "warmup", "name": "Rameur", "detail": "5 min", "sets": [] },
        { "name": "Développé couché", "sets": [ { "reps": 8, "weight": 135 } ] },
        { "type": "stretch", "name": "Épaules", "detail": "2 × 30 s", "sets": [] }
      ] }
  ] }
```

- Un élément de `workouts` est **une séance**. Les séances de même nom (comparaison sans majuscules, `JG.key`) sont affichées dans une seule carte « entraînement » ; « Nouvelle séance » recopie la dernière à la date du jour.
- `type` absent ou `"ex"` = exercice avec sets. `"warmup"` et `"stretch"` = nom + `detail` en texte libre, sans sets, **exclus des stats**.
- `unit` (`lb` ou `kg`) n'est qu'une étiquette : aucune conversion.
- Suppression = pierre tombale `{ "id", "deleted": true, "updatedAt" }`, pour qu'elle se propage aux autres appareils.

### Synchronisation (`JG.sync`)

À chaque enregistrement : relire le fichier distant, fusionner par `id` (le `updatedAt` le plus récent gagne), `PUT` avec le `sha`, nouvel essai sur 409/422. Hors ligne, les changements restent dans le cache local (`jg_dirty`) et partent au retour du réseau ou à la réouverture.

## Stats

- 1RM estimé : formule d'Epley, `poids × (1 + reps ÷ 30)` (1 rep = le poids), meilleur set de la séance.
- `JG.history()` : par exercice, la liste des séances (poids max, reps max, 1RM estimé, volume). `JG.records()` : les records par exercice.
- Exercice sans poids (ex. tractions) : le graphique montre les reps max.

## Interface

- Ordinateur : onglets en haut. Téléphone : barre d'onglets fixe en bas (Journal, Stats, Compte), masquée pendant l'édition d'une séance, où Enregistrer / Annuler restent collés en bas. L'onglet Compte de `stats.html` renvoie vers `index.html#compte`.
- Sur téléphone, les tableaux de stats (`table.rt`) deviennent des fiches empilées grâce aux attributs `data-label`.
- Icônes : `<i data-icon="plus"></i>` dans le HTML, remplacé par `JG.hydrateIcons()` ; `JG.icon(nom)` dans le JavaScript.
- État de synchro : `JG.paintStatus()` remplit `#who`, `#sync` et `#notice`.
- iOS : le champ date déborde sans les règles `input[type="date"]` de `style.css` ; garder `min-width: 0` sur les enfants de grilles et de lignes flex. Garder les champs à 16 px minimum, sinon Safari zoome.

## Service worker

Fichiers du site : réseau d'abord, cache en secours. Chart.js (CDN) : cache d'abord. Les appels à `api.github.com` ne passent jamais par le cache.

## Vérifier un changement

Il n'y a pas de tests dans le dépôt. Pendant le développement, deux vérifications ont servi et valent la peine d'être refaites après un changement important :

1. Servir le dossier (`python3 -m http.server`) et ouvrir le site dans un navigateur à largeur de téléphone (375 px), clair et sombre. Pour voir des données sans jeton : mettre `jg_token`, `jg_repo`, `jg_login` et un `jg_cache` d'exemple dans `localStorage` (la synchro échouera, l'affichage fonctionne).
2. Vérifier qu'aucun élément ne dépasse la largeur de l'écran à 320, 375 et 430 px, dans le journal, l'éditeur et les stats.

**Jamais vérifié sur un vrai Safari d'iPhone depuis l'environnement de développement** : pour tout ce qui touche à la mise en page mobile, dire à Justin que c'est à confirmer sur son téléphone.

## Idées non faites

Groupes musculaires, volume par semaine, import CSV, modèles d'entraînement, minuteur de repos, champs précis (minutes / secondes) pour les échauffements et étirements.
