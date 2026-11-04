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
- **Jours de la semaine** : consultez et modifiez le planning de n'importe quel jour.
- **Nuit et soleil** : la couronne des heures s'assombrit du coucher au lever du soleil.
- **Aiguille** de l'heure actuelle et, au centre, ce qui est en cours et ce qui arrive (« → 19:00 » = jusqu'à 19:00).
- **Heure du serveur** : le cadran suit le fuseau de Home Assistant, pas celui de la tablette.
- Mises à jour **en direct** : un planning modifié ailleurs se redessine aussitôt.
- **7 styles de centre** (métal, thème Home Assistant, verre, doux, laiton, carbone, néon), midi ou minuit en haut, **retour haptique**, thème clair ou sombre.
- **Éditeur visuel complet** en français ou en anglais.

## Modifier un planning

![Édition](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/edition.png)

| Geste | Effet |
|---|---|
| Glisser une extrémité de plage | change l'heure de début ou de fin (pas réglable : 15 min par défaut) |
| Glisser le milieu d'une plage | la déplace sans changer sa durée |
| Appui long sur un vide de l'anneau | nouvelle plage d'une heure |
| Appui sur une plage | la choisit : heures et durée au centre, corbeille pour la supprimer (ou touche Suppr) |
| Glisser un repère d'heure | change l'heure du `input_datetime` ou du `time` |
| Jours sous le cadran | affichent (et modifient) le planning de ce jour |
| Légende | ouvre la fiche de l'entité |

Les plages ne se chevauchent jamais et s'arrêtent à minuit, comme dans l'éditeur de Home Assistant. Les données personnalisées d'une plage (`data`) sont conservées. La modification est réservée aux **administrateurs** (règle de Home Assistant) ; les autres utilisateurs voient le cadran en lecture seule. Les plannings définis en YAML ne sont pas lisibles par les cartes : créez-les depuis **Paramètres › Appareils et services › Entrées › Planning**.

## Installation

### Marketplace (Home Assistant 2026.10 et plus) ou HACS

Cliquez sur le bouton **Ouvrir dans Home Assistant** ci-dessus, ou ajoutez ce dépôt comme dépôt personnalisé, catégorie **Dashboard** :
`https://github.com/benshoesweb/day-wheel-card`

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
| `layers` | 1 à 6 anneaux : `entity`, `name`, `color`, `icon` (ou simplement l'entity_id) | — |
| `name` | titre de la carte | aucun |
| `orientation` | `midnight_top` (minuit en haut), `noon_top` (midi en haut) | `midnight_top` |
| `snap` | pas de réglage en minutes : `5`, `10`, `15`, `30`, `60` | `15` |
| `show_sun` | couronne jour / nuit, lever et coucher du soleil | `true` |
| `show_days` | jours de la semaine (avec un planning ou un calendrier) | `true` |
| `show_legend` | légende sous le cadran | `true` |
| `haptics` | retour haptique au doigt | `true` |
| `knob_theme` | `metal`, `ha`, `glass`, `neumorph`, `brass`, `carbon`, `neon` | `metal` |
| `theme` | `auto`, `light`, `dark` | `auto` |

![Thème clair](https://raw.githubusercontent.com/benshoesweb/day-wheel-card/main/images/apercu-clair.png)

### Avec Radial Selector Card

La carte va bien avec [Radial Selector Card](https://github.com/benshoesweb/radial-selector-card) (mêmes styles de bouton) : l'une pour piloter les lumières, l'autre pour les horaires.

## English

A 24-hour wheel for Home Assistant dashboards: your schedules, alarms, appointments and calendars on one dial, with night, sun and the current time. **Schedule time ranges are edited right on the dial**: drag an end, drag a whole range, long-press an empty spot to add one, tap a range then the trash icon to delete it. The card and its visual editor follow Home Assistant's language (English or French).

- **1 to 6 rings** (`layers`): `schedule` (editable time ranges), `input_datetime` / `time` (draggable time marker), timestamp `sensor` (marker), `calendar` (today's events).
- **Days of the week** to view and edit any day, **night shading** from sunset to sunrise, a **current-time hand**, and what's on / next in the center.
- Uses the **Home Assistant server time zone**, live updates, 7 center styles, `noon_top` orientation, adjustable `snap` (minutes), haptics, light / dark.
- Editing schedules requires an **administrator** (Home Assistant rule); YAML-defined schedules can't be read by cards, create them under **Settings › Devices & services › Helpers › Schedule**.

Install it from the Marketplace / HACS with the **Open in Home Assistant** button above, then add the card from the dashboard editor. The options table above lists the YAML keys.

## Développement

```bash
npm ci
npx playwright install chromium
npm test          # 78 vérifications dans Chrome : affichage, glisser, créer, supprimer, droits, éditeur…
```

Les tests tournent aussi sur GitHub à chaque modification (workflow **Tests**). Historique : [CHANGELOG.md](CHANGELOG.md).

## Publier une nouvelle version

Modifiez `dist/day-wheel-card.js`, puis créez une release GitHub (ou `./scripts/release.sh v1.1.0`). Le workflow **Release** y ajoute le fichier de la carte ; la Marketplace la propose ensuite en mise à jour. Pour entrer dans le catalogue par défaut de HACS : `./scripts/submit-to-hacs-default.sh`.
