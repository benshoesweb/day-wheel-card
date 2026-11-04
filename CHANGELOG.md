# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/).

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

[1.0.0]: https://github.com/benshoesweb/day-wheel-card/releases/tag/v1.0.0
