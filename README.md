# Day Wheel Card

Roue des 24 heures pour les tableaux de bord Home Assistant : vos plannings, réveils, rendez-vous et calendriers sur un cadran, avec la nuit, le soleil et l'heure actuelle. Les plages des plannings se modifient **directement au doigt** : on glisse une extrémité, on déplace une plage, on en crée une par appui long.

*24-hour wheel card for Home Assistant dashboards — [English below](#english).*

[![Ouvrir dans Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=benshoesweb&repository=day-wheel-card&category=plugin)
[![Validate](https://github.com/benshoesweb/day-wheel-card/actions/workflows/validate.yml/badge.svg)](https://github.com/benshoesweb/day-wheel-card/actions/workflows/validate.yml)
[![Tests](https://github.com/benshoesweb/day-wheel-card/actions/workflows/tests.yml/badge.svg)](https://github.com/benshoesweb/day-wheel-card/actions/workflows/tests.yml)

![Aperçu](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/apercu-sombre.png)

## Fonctionnalités

- **1 à 6 anneaux**, un par entité, de l'extérieur vers l'intérieur :
  - **Planning** (`schedule`, l'aide « Planning » de Home Assistant) : les plages du jour, **modifiables au doigt ou à la souris** ;
  - **Heure** (`input_datetime`, `time`) : un repère (réveil, arrosage…) à faire glisser ;
  - **Horodatage** (`sensor` de type timestamp, ex. prochaine alarme du téléphone) : un repère ;
  - **Calendrier** (`calendar`) : les événements du jour.
- **Chauffage, volets, lumières** : un planning peut piloter un thermostat, un volet roulant ou une lumière (ou un groupe de lumières) ; chaque plage a sa température, sa position ou sa luminosité, réglée au doigt. Le [blueprint fourni](#piloter-le-chauffage-les-volets-et-les-lumières) l'applique à l'heure dite.
- **Jours de la semaine** : consultez et modifiez le planning de n'importe quel jour.
- **Nuit et soleil** : la couronne des heures s'assombrit du coucher au lever du soleil.
- **Aiguille** de l'heure actuelle et, au centre, ce qui est en cours et ce qui arrive (« → 19:00 » = jusqu'à 19:00).
- **Heure du serveur** : le cadran suit le fuseau de Home Assistant, pas celui de la tablette.
- Mises à jour **en direct** : un planning modifié ailleurs se redessine aussitôt.
- **7 styles de centre** (métal, thème Home Assistant, verre, doux, laiton, carbone, néon), midi ou minuit en haut, **retour haptique**, thème clair ou sombre.
- **Suit le thème Home Assistant** : avec le style `ha`, tout le cadran (fond, anneaux vides, graduations, couronne jour / nuit, centre, aiguille) prend les couleurs du thème actif, et `palette: theme` donne aux anneaux les couleurs du thème. Le changement de thème est immédiat.
- **Éditeur visuel complet** en français ou en anglais.

## Modifier un planning

![Édition](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/edition.png)

| Geste | Effet |
|---|---|
| Glisser une extrémité de plage | change l'heure de début ou de fin (pas réglable : 15 min par défaut) |
| Glisser le milieu d'une plage | la déplace sans changer sa durée |
| Appui long sur un vide de l'anneau | nouvelle plage d'une heure |
| Appui sur une plage | la choisit : heures et durée au centre, corbeille pour la supprimer (ou touche Suppr) |
| − / + au centre (plage choisie) | change sa température, sa position ou sa luminosité (planning avec `target`) ; aussi flèches haut / bas |
| Glisser un repère d'heure | change l'heure du `input_datetime` ou du `time` |
| Jours sous le cadran | affichent (et modifient) le planning de ce jour |
| Légende | ouvre la fiche de l'entité |

Les plages ne se chevauchent jamais et s'arrêtent à minuit, comme dans l'éditeur de Home Assistant. Les données personnalisées d'une plage (`data`) sont conservées. La modification est réservée aux **administrateurs** (règle de Home Assistant) ; les autres utilisateurs voient le cadran en lecture seule. Les plannings définis en YAML ne sont pas lisibles par les cartes : créez-les depuis **Paramètres › Appareils et services › Entrées › Planning**.

## Piloter le chauffage, les volets et les lumières

![Températures et positions sur les plages](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/pilotage.png)

Donnez à un anneau de planning un appareil à piloter (**Piloter** dans l'éditeur, `target` en YAML) :

| Appareil | Valeur de chaque plage | Réglage par défaut |
|---|---|---|
| Thermostat (`climate`) | température | pas et limites du thermostat (0,5° en général) |
| Volet roulant (`cover`) | position, de 0 (fermé) à 100 % (ouvert) | par 10 % |
| Lumière (`light`), groupe de lumières compris | luminosité | de 10 à 100 %, par 10 % |

Choisissez une plage : sa valeur s'affiche au centre, entre **−** et **+**. Elle est aussi écrite le long de la plage, et le centre l'indique au repos (« → 19:00 21° »). Une nouvelle plage reprend la valeur de sa voisine. `min`, `max` et `step` changent les limites et le pas.

```yaml
type: custom:day-wheel-card
layers:
  - entity: schedule.chauffage
    target: climate.salon
  - entity: schedule.volets
    target: cover.salon
  - entity: schedule.eclairage
    target: light.salon_groupe
```

La carte ne fonctionne que lorsque le tableau de bord est affiché : pour que les appareils suivent le planning **à toute heure**, importez le blueprint [`day_wheel_schedule.yaml`](blueprints/day_wheel_schedule.yaml) et créez une automatisation par planning :

[![Importer le blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fbenshoesweb%2Fday-wheel-card%2Fblob%2Fmain%2Fblueprints%2Fday_wheel_schedule.yaml)

- **Pendant une plage** : la valeur de la plage est envoyée (thermostat rallumé s'il était éteint ; volet sans réglage de position : ouvert, ou fermé à 0 %). Une plage sans valeur prend la valeur choisie dans le blueprint.
- **Hors des plages** : au choix, température ou position « hors plages » (17° et 0 % par défaut), extinction du thermostat ou des lumières, ou rien.
- Une valeur changée sur la plage en cours s'applique aussitôt ; un réglage fait à la main reste en place jusqu'à la plage suivante. Au redémarrage de Home Assistant, tout est rétabli.
- **Plusieurs lumières ensemble** : créez un groupe de lumières (**Paramètres › Appareils et services › Entrées › Créer une entrée › Groupe › Groupe de lumières**) et choisissez-le comme appareil. Le blueprint accepte aussi plusieurs appareils pour un même planning (par exemple tous les thermostats de l'étage).

La valeur est rangée dans les données de la plage (`temperature`, `position` ou `brightness_pct`) : Home Assistant l'affiche en attribut du planning pendant la plage, et vos propres automatisations peuvent aussi s'en servir. Le blueprint demande Home Assistant 2024.10 ou plus.

## Installation

### Marketplace (recommandé)

La carte fait partie du catalogue officiel de HACS, intégré à Home Assistant depuis la version 2026.11 :

- **Home Assistant 2026.11 et plus** : **Paramètres › Marketplace**, cherchez « Day Wheel Card », puis **Télécharger**.
- **Versions précédentes, avec HACS installé** : **HACS**, cherchez « Day Wheel Card », puis **Télécharger**.

Le bouton **Ouvrir dans Home Assistant** ci-dessus mène directement à la carte. La ressource du tableau de bord est ajoutée automatiquement, et les nouvelles versions sont proposées en mise à jour.

Compatibilité : testée avec Home Assistant 2026.11 (plannings, calendriers, heures, éditeur et blueprint). Le blueprint demande Home Assistant 2024.10 ou plus.

### Manuelle

1. Téléchargez `day-wheel-card.js` depuis la [dernière release](https://github.com/benshoesweb/day-wheel-card/releases/latest).
2. Copiez-le dans `/config/www/`.
3. **Paramètres › Tableaux de bord › ⋮ › Ressources** : ajoutez `/local/day-wheel-card.js` (module JavaScript).

## Configuration

Tout se règle dans l'éditeur visuel. Exemple en YAML :

```yaml
type: custom:day-wheel-card
name: Ma journée
knob_theme: metal
layers:
  - entity: schedule.chauffage
    color: "#ff7043"
  - entity: schedule.volets
    color: "#4fc3f7"
  - entity: input_datetime.reveil
    icon: mdi:alarm
  - entity: calendar.famille
```

| Option | Valeurs | Défaut |
|---|---|---|
| `layers` | 1 à 6 anneaux : `entity`, `name` (sinon le nom affiché par Home Assistant), `color`, `icon` (ou simplement l'entity_id) ; pour un planning : `target` (thermostat, volet ou lumière à piloter), `min`, `max`, `step` ([voir plus haut](#piloter-le-chauffage-les-volets-et-les-lumières)) | — |
| `name` | titre de la carte, avec le titre standard des cartes Home Assistant (il suit le thème : `--ha-card-header-font-size`, `--ha-card-header-color`…) | aucun |
| `orientation` | `midnight_top` (minuit en haut), `noon_top` (midi en haut) | `midnight_top` |
| `snap` | pas de réglage en minutes : `5`, `10`, `15`, `30`, `60` | `15` |
| `show_sun` | couronne jour / nuit, lever et coucher du soleil | `true` |
| `show_days` | jours de la semaine (avec un planning ou un calendrier) | `true` |
| `show_legend` | légende sous le cadran | `true` |
| `haptics` | retour haptique au doigt | `true` |
| `knob_theme` | `metal`, `ha` (tout le cadran aux couleurs du thème), `glass`, `neumorph`, `brass`, `carbon`, `neon` | `metal` |
| `palette` | couleurs des anneaux sans couleur choisie : `default` (palette de la carte) ou `theme` (couleurs du thème : principale, succès, avertissement, info, erreur, accent) | `default` |
| `theme` | `auto`, `light`, `dark` | `auto` |

![Thème clair](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/apercu-clair.png)

### Suivre le thème Home Assistant

Pour que toute la carte change avec ton thème, choisis dans l'éditeur **Style du centre : Thème Home Assistant**, **Couleurs des anneaux : Couleurs du thème HA** et **Thème : Auto** :

```yaml
type: custom:day-wheel-card
knob_theme: ha
palette: theme
layers:
  - schedule.chauffage
  - schedule.volets
  - input_datetime.reveil
```

Exemple avec un thème Nord, en sombre puis en clair (de gauche à droite : métal, `ha`, `ha` + `palette: theme`) :

![Thème sombre](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/theme-sombre.png)
![Thème clair](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/theme-clair.png)

Les couleurs choisies à la main pour un anneau (`color`) restent prioritaires.

### Avec Radial Selector Card

La carte va bien avec [Radial Selector Card](https://github.com/benshoesweb/radial-selector-card) (mêmes styles de bouton) : l'une pour piloter les lumières, l'autre pour les horaires.

## English

A 24-hour wheel for Home Assistant dashboards: your schedules, alarms, appointments and calendars on one dial, with night, sun and the current time. **Schedule time ranges are edited right on the dial**: drag an end, drag a whole range, long-press an empty spot to add one, tap a range then the trash icon to delete it. The card and its visual editor follow Home Assistant's language (English or French).

- **1 to 6 rings** (`layers`): `schedule` (editable time ranges), `input_datetime` / `time` (draggable time marker), timestamp `sensor` (marker), `calendar` (today's events).
- **Heating, covers, lights**: give a schedule ring a device to control (`target`, "Control" in the editor): a thermostat (`climate`), a cover or a light (light groups included). Each time range then has a temperature, a position or a brightness, set with **− / +** in the center (limits and step from the device, or `min`, `max`, `step`), written along the range. The value is stored in the range's data (`temperature`, `position`, `brightness_pct`). Since the card only runs while the dashboard is shown, the [`day_wheel_schedule.yaml`](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fbenshoesweb%2Fday-wheel-card%2Fblob%2Fmain%2Fblueprints%2Fday_wheel_schedule.yaml) blueprint applies the values on time: the range's value during a range, an "outside" temperature / position, turning off, or nothing outside the ranges; restored on restart. Group several lights with a light group helper.
- **Days of the week** to view and edit any day, **night shading** from sunset to sunrise, a **current-time hand**, and what's on / next in the center.
- Uses the **Home Assistant server time zone**, live updates, 7 center styles, `noon_top` orientation, adjustable `snap` (minutes), haptics, light / dark.
- **Follows the Home Assistant theme**: with `knob_theme: ha`, the whole dial (face, empty rings, ticks, day / night ring, center, hand) uses the active theme's colors, and `palette: theme` gives the rings the theme's colors (primary, success, warning, info, error, accent). Theme changes apply instantly; a ring's own `color` still wins.
- Editing schedules requires an **administrator** (Home Assistant rule); YAML-defined schedules can't be read by cards, create them under **Settings › Devices & services › Helpers › Schedule**.

**Install**: the card is in the official HACS catalog, built into Home Assistant since 2026.11 — **Settings › Marketplace**, search for "Day Wheel Card" (on older versions: **HACS**). The **Open in Home Assistant** button above leads straight to it. Then add the card from the dashboard editor; the options table above lists the YAML keys. Tested with Home Assistant 2026.11; the blueprint needs 2024.10 or later.

## Développement

```bash
npm ci
npx playwright install chromium
npm test          # 144 vérifications dans Chrome : affichage, glisser, créer, supprimer, valeurs, droits, éditeur…
```

Les tests tournent aussi sur GitHub à chaque modification (workflow **Tests**). Historique : [CHANGELOG.md](CHANGELOG.md).

## Publier une nouvelle version

1. Modifiez `dist/day-wheel-card.js` et notez le changement dans [CHANGELOG.md](CHANGELOG.md), en français et en anglais, sous « Non publié ».
2. Passez la section « Non publié » au numéro de version (et `package.json`), puis fusionnez dans `main`.
3. **Ensuite seulement**, créez la release GitHub `vX.Y.Z` sur `main` (ou `./scripts/release.sh vX.Y.Z`) : le tag contient alors le bon CHANGELOG.

Le workflow **Release** joint le fichier de la carte à la release ; la Marketplace la propose ensuite en mise à jour. La carte est déjà dans le catalogue officiel de HACS : il n'y a plus de demande à faire.
