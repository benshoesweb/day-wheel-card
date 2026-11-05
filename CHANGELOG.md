# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version est décrite en français, puis en anglais.

*Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), following [semantic versioning](https://semver.org/). Each version is described in French, then in English.*

## [1.2.1] — 2026-11-05

### Modifié
- **Titre de la carte** : le nom de la carte (`name`) utilise maintenant le **titre standard des cartes Home Assistant** (l'en-tête de la carte), au lieu d'un titre propre à la carte. Il a la même taille, les mêmes marges et la même police que les autres cartes du tableau de bord, et suit les variables du thème (`--ha-card-header-font-size`, `--ha-card-header-color`, `--ha-card-header-font-family`). Le titre est plus grand qu'avant : la carte demande une ligne de plus dans la grille.
- 6 vérifications automatiques de plus (102 au total) ; images du README refaites.

#### English

##### Changed
- **Card title**: the card name (`name`) now uses **Home Assistant's standard card title** (the card header) instead of a title of its own. It has the same size, spacing and font as the other cards on the dashboard, and follows the theme variables (`--ha-card-header-font-size`, `--ha-card-header-color`, `--ha-card-header-font-family`). The title is larger than before: the card asks for one more row in the grid.
- 6 more automated checks (102 in total); README images redone.

## [1.2.0] — 2026-11-05

### Modifié
- **Noms des entités comme dans Home Assistant** : sans `name` choisi, un anneau prend le nom que Home Assistant affiche lui-même (`hass.formatEntityName`, fourni par les versions récentes de Home Assistant), au lieu de l'attribut `friendly_name`, dont la suppression est annoncée. Depuis 2026.11, ce nom est souvent celui de l'appareil suivi de celui de l'entité (ex. « Chambre Réveil »), comme dans les cartes de Home Assistant. Pour garder un nom court, choisissez-le dans l'éditeur (champ « Nom ») ou avec `name`. Sur les versions qui ne le fournissent pas, rien ne change (`friendly_name`). Les plannings restent retrouvés par leur identifiant, ou à défaut par leur nom.
- 6 vérifications automatiques de plus (96 au total).

#### English

##### Changed
- **Entity names like Home Assistant's**: without a chosen `name`, a ring uses the name Home Assistant itself displays (`hass.formatEntityName`, provided by recent Home Assistant versions), instead of the `friendly_name` attribute, whose removal has been announced. Since 2026.11, this name is often the device name followed by the entity name (e.g. "Bedroom Alarm"), as in Home Assistant's cards. To keep a short name, set it in the editor ("Name" field) or with `name`. On versions that don't provide it, nothing changes (`friendly_name`). Schedules are still found by their unique ID, or otherwise by their name.
- 6 more automated checks (96 in total).

## [1.1.0] — 2026-11-05

### Ajouté
- **Suivi du thème Home Assistant** : avec le style de centre **`ha`**, tout le cadran prend désormais les couleurs du thème actif, en clair comme en sombre : fond du cadran (couleur secondaire), anneaux vides, graduations, couronne jour / nuit, repères du soleil, centre et aiguille. Un changement de thème s'applique immédiatement.
- Nouvelle option **`palette`** : `default` (palette de la carte) ou **`theme`**, qui donne aux anneaux sans couleur choisie les couleurs du thème (principale, succès, avertissement, info, erreur, accent). Réglable dans l'éditeur ; une couleur choisie pour un anneau reste prioritaire.
- 12 vérifications automatiques de plus (90 au total).

#### English

##### Added
- **Follows the Home Assistant theme**: with the **`ha`** center style, the whole dial now uses the active theme's colors, in light and dark mode: dial face (secondary color), empty rings, ticks, day / night ring, sun markers, center and hand. A theme change applies instantly.
- New **`palette`** option: `default` (card palette) or **`theme`**, which gives rings without a chosen color the theme's colors (primary, success, warning, info, error, accent). Available in the editor; a ring's own color still wins.
- 12 more automated checks (90 in total).

## [1.0.0] — 2026-11-04

Première version publique.

### Ajouté
- Roue des 24 heures : 1 à 6 anneaux (`layers`) — plannings (`schedule`), heures (`input_datetime`, `time`), horodatages (`sensor`), calendriers (`calendar`).
- Modification des plannings sur le cadran : glisser une extrémité, déplacer une plage, appui long pour en créer une, corbeille pour la supprimer ; pas réglable (`snap`), pas de chevauchement, données des plages conservées, réservée aux administrateurs.
- Repères d'heure à faire glisser (`input_datetime.set_datetime`, `time.set_value`).
- Jours de la semaine, couronne jour / nuit (soleil), aiguille de l'heure actuelle, état en cours et à venir au centre, légende.
- Fuseau horaire du serveur Home Assistant, mises à jour en direct (`schedule/subscribe`).
- 7 styles de centre, orientation (`midnight_top` / `noon_top`), retour haptique, thème clair / sombre.
- Éditeur visuel en français et en anglais.
- 78 vérifications automatiques dans Chrome (GitHub Actions).

#### English

First public release.

##### Added
- 24-hour wheel: 1 to 6 rings (`layers`) — schedules (`schedule`), times (`input_datetime`, `time`), timestamps (`sensor`), calendars (`calendar`).
- Edit schedules right on the dial: drag an end, move a time range, long press to create one, trash icon to delete it; adjustable step (`snap`), no overlap, time range data kept, administrators only.
- Draggable time markers (`input_datetime.set_datetime`, `time.set_value`).
- Days of the week, day / night ring (sun), current-time hand, what's on and what's next in the center, legend.
- Home Assistant server time zone, live updates (`schedule/subscribe`).
- 7 center styles, orientation (`midnight_top` / `noon_top`), haptic feedback, light / dark theme.
- Visual editor in French and English.
- 78 automated checks in Chrome (GitHub Actions).

[1.2.1]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.2.1
[1.2.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.0.0
