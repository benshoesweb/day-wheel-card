# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version est décrite en français, puis en anglais.

*Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), following [semantic versioning](https://semver.org/). Each version is described in French, then in English.*

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

[1.0.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.0.0
