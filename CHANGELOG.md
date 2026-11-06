# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version est décrite en français, puis en anglais.

*Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), following [semantic versioning](https://semver.org/). Each version is described in French, then in English.*

## [1.4.0] — 2026-11-06

### Ajouté
- **Fond de la carte**, comme dans Radial Selector Card : nouvelle option **`card_style`** (« Apparence de la carte » dans l'éditeur) : `standard` (fond et contour du thème, par défaut : rien ne change pour les cartes existantes), `border_only` (contour sans fond), `background_only` (fond sans contour) ou **`transparent`** (ni fond ni contour, le cadran est posé sur le fond du tableau de bord). Couleurs au choix avec `card_background` et `card_border_color` (nuancier ou toute couleur CSS, variables du thème comprises) ; une couleur invalide est ignorée et le thème reprend la main.
- 14 vérifications automatiques de plus (229 au total).

#### English

##### Added
- **Card background**, like in Radial Selector Card: new **`card_style`** option ("Card appearance" in the editor): `standard` (theme background and border, default: existing cards don't change), `border_only` (border, no background), `background_only` (background, no border) or **`transparent`** (no background, no border, the dial sits on the dashboard background). Pick colors with `card_background` and `card_border_color` (color picker or any CSS color, theme variables included); an invalid color is ignored and the theme takes over.
- 14 more automated checks (229 in total).

## [1.3.0] — 2026-11-06

### Ajouté
- **Plannings qui pilotent un appareil** : nouvelle option d'anneau **`target`** (« Piloter » dans l'éditeur) pour un planning. Choisissez un **thermostat** (`climate`), un **volet roulant** (`cover`) ou une **lumière** (`light`, groupes de lumières compris) : chaque plage reçoit alors une **température**, une **position** ou une **luminosité**, réglée au centre avec **− / +** (ou les flèches haut / bas du clavier) quand la plage est choisie. La valeur est écrite le long de la plage et affichée au centre (« → 19:00 21° »). Une nouvelle plage reprend la valeur de sa voisine.
- La valeur est rangée dans les **données de la plage** (`data` : `temperature`, `position` ou `brightness_pct`), que Home Assistant expose en attribut du planning pendant la plage. Les autres données de la plage sont conservées.
- Bornes et pas d'après l'appareil (température mini / maxi et pas du thermostat, 0 – 100 % par 10 pour les volets, 10 – 100 % par 10 pour les lumières), modifiables avec `min`, `max` et `step`.
- **Blueprint** [`day_wheel_schedule.yaml`](blueprints/day_wheel_schedule.yaml) qui applique ces valeurs à l'heure dite, même tableau de bord fermé : température de la plage (thermostat rallumé si besoin), position (ou ouverture / fermeture pour un volet sans position), luminosité ; hors des plages, température ou position « hors plages », extinction, ou rien. Une valeur changée pendant la plage en cours s'applique aussitôt ; tout est rétabli au redémarrage. Testé sur Home Assistant 2026.11 (thermostats, volets, groupe de lumières, redémarrage).
- **Résumé par appui long sur le centre** (option `summary`, activée par défaut, réglable dans l'éditeur) : une fenêtre récapitule la semaine entière de chaque planning (plages, valeurs, durée du jour, total de la semaine, appareil piloté), les heures des repères, la prochaine alarme, les événements du jour, les réglages de la carte, le soleil et les droits de modification. Elle suit le thème Home Assistant (ou le thème clair / sombre choisi), se met à jour en direct et défile s'il y a beaucoup d'informations. Elle est en plein écran sur téléphone et centrée sur tablette et PC ; on la ferme avec la croix en haut à droite, Échap ou un clic à côté. Au clavier : Entrée sur le centre.
- **Automatisation créée par la carte** (une par planning piloté) : dès qu'une première valeur est réglée, la carte installe au besoin le blueprint, crée l'automatisation « Day Wheel · *planning* → *appareil* » et la lance une fois pour appliquer tout de suite la plage en cours. Ajouter, déplacer ou supprimer des plages ne demande rien de plus. Jamais de doublon : une automatisation qui utilise déjà ce planning avec le blueprint est réutilisée. Le résumé et l'éditeur affichent son état (active, désactivée, absente, non chargée) avec les boutons **Créer l'automatisation**, **Ouvrir** et **Piloter …** (mise à jour après un changement d'appareil). Option `create_automation: false` pour ne créer qu'avec le bouton. Réservé aux administrateurs. Testé de bout en bout sur Home Assistant 2026.11.
- 113 vérifications automatiques de plus (215 au total).

#### English

##### Added
- **Schedules that control a device**: new ring option **`target`** ("Control" in the editor) for a schedule. Pick a **thermostat** (`climate`), a **cover** (`cover`) or a **light** (`light`, light groups included): each time range then gets a **temperature**, a **position** or a **brightness**, set in the center with **− / +** (or the up / down arrow keys) when the range is selected. The value is written along the range and shown in the center ("→ 19:00 21°"). A new range takes its neighbour's value.
- The value is stored in the **range's data** (`data`: `temperature`, `position` or `brightness_pct`), which Home Assistant exposes as a schedule attribute during the range. The range's other data is kept.
- Limits and step follow the device (thermostat min / max temperature and step, 0 – 100 % by 10 for covers, 10 – 100 % by 10 for lights), adjustable with `min`, `max` and `step`.
- **Blueprint** [`day_wheel_schedule.yaml`](blueprints/day_wheel_schedule.yaml) that applies these values on time, even with the dashboard closed: the range's temperature (thermostat turned back on if needed), position (or open / close for a cover without position), brightness; outside the ranges, an "outside" temperature or position, turning off, or nothing. A value changed during the current range applies right away; everything is restored on restart. Tested on Home Assistant 2026.11 (thermostats, covers, light group, restart).
- **Summary on a long press of the center** (`summary` option, on by default, available in the editor): a window recaps each schedule's whole week (ranges, values, daily duration, weekly total, controlled device), marker times, the next alarm, today's events, the card settings, the sun and editing rights. It follows the Home Assistant theme (or the chosen light / dark theme), updates live and scrolls when there is a lot to show. It is full screen on phones and centered on tablets and computers; close it with the top-right cross, Escape or a click outside. With a keyboard: Enter on the center.
- **Automation created by the card** (one per controlled schedule): as soon as a first value is set, the card installs the blueprint if needed, creates the "Day Wheel · *schedule* → *device*" automation and runs it once so the current range applies right away. Adding, moving or deleting ranges needs nothing more. No duplicates: an automation already using this schedule with the blueprint is reused. The summary and the editor show its state (active, turned off, missing, not loaded) with **Create the automation**, **Open** and **Control …** (update after changing the device) buttons. Option `create_automation: false` to create it only with the button. Administrators only. Tested end to end on Home Assistant 2026.11.
- 113 more automated checks (215 in total).

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

[1.4.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.4.0
[1.3.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.3.0
[1.2.1]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.2.1
[1.2.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.0.0
