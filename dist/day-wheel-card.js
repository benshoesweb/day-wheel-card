/*
 * day-wheel-card — roue des 24 heures pour Home Assistant
 * https://github.com/benshoesweb/day-wheel-card
 *
 * Une journée sur un cadran : chaque anneau (layers) montre une entité.
 *   schedule.*        plages horaires du planning (aide « Planning ») — modifiables au doigt :
 *                     glisser une extrémité = changer l'heure, glisser la plage = la déplacer,
 *                     appui long sur un vide = nouvelle plage, toucher une plage = la choisir
 *                     (puis corbeille au centre pour la supprimer)
 *   input_datetime.*  heure (réveil…) — repère à faire glisser
 *   time.*            heure d'un appareil — repère à faire glisser
 *   sensor.*          horodatage (prochaine alarme du téléphone…) — repère en lecture seule
 *   calendar.*        événements du jour — arcs en lecture seule
 * Autour : nuit (coucher → lever du soleil), aiguille de l'heure actuelle, jours de la semaine.
 * Noms des entités comme dans Home Assistant (hass.formatEntityName, sinon friendly_name).
 *
 * Options :
 *   layers            1 à 6 anneaux, de l'extérieur vers l'intérieur : entity, name, color, icon
 *   name              titre de la carte (en-tête standard de Home Assistant, comme les autres cartes)
 *   orientation       midnight_top (minuit en haut, défaut) | noon_top (midi en haut)
 *   snap              pas de réglage en minutes : 5 | 10 | 15 (défaut) | 30 | 60
 *   show_sun          true (défaut) : nuit grisée, lever et coucher du soleil
 *   show_days         true (défaut) : jours de la semaine (plannings et calendriers)
 *   show_legend       true (défaut) : légende des anneaux sous le cadran
 *   haptics           true (défaut) : retour haptique au doigt
 *   knob_theme        metal (défaut) | ha (cadran, anneaux, jour / nuit et centre aux couleurs du thème HA)
 *                     | glass | neumorph | brass | carbon | neon
 *   palette           default (défaut) : palette de la carte | theme : couleurs du thème HA
 *                     (principale, succès, avertissement, info, erreur, accent) pour les anneaux sans couleur
 *   theme             auto (défaut) | light | dark
 */
(() => {
  const TAG = 'day-wheel-card';
  const EDITOR_TAG = 'day-wheel-card-editor';
  // Remplacé par le numéro de version (tag GitHub) lors de la publication d'une release
  const VERSION = '__VERSION__';
  console.info(`%c DAY-WHEEL-CARD %c ${VERSION} `,
    'color:#fff;background:#d08770;font-weight:700;border-radius:3px 0 0 3px',
    'color:#d08770;background:#eceff4;border-radius:0 3px 3px 0');

  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const WD_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const SKINS = ['metal', 'ha', 'glass', 'neumorph', 'brass', 'carbon', 'neon'];
  const SNAPS = [5, 10, 15, 30, 60];
  const KINDS = { schedule: 'schedule', input_datetime: 'marker', time: 'marker', sensor: 'marker', calendar: 'calendar' };
  const PALETTE = ['#ff8a65', '#4fc3f7', '#aed581', '#ffd54f', '#ba68c8', '#4db6ac'];
  // palette: theme — couleurs du thème Home Assistant (accent en dernier : il vaut souvent la couleur principale)
  const THEME_PALETTE = ['primary-color', 'success-color', 'warning-color', 'info-color', 'error-color', 'accent-color']
    .map((v, i) => `var(--${v}, ${PALETTE[i]})`);
  const LONG_PRESS_MS = 550;
  const DAY = 1440;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const r2 = (v) => Math.round(v * 100) / 100;
  // Nom d'une entité tel que Home Assistant l'affiche dans ses propres cartes : hass.formatEntityName
  // (versions récentes ; depuis 2026.11, souvent le nom de l'appareil puis celui de l'entité),
  // l'attribut friendly_name étant appelé à disparaître. Versions précédentes ou erreur : friendly_name.
  const haEntityName = (hass, entityId) => {
    const st = hass && hass.states && entityId ? hass.states[entityId] : null;
    if (!st) return '';
    if (typeof hass.formatEntityName === 'function') {
      try {
        const n = hass.formatEntityName(st);
        if (n != null && String(n).trim()) return String(n).trim();
      } catch (e) { /* ancienne interface : nom de secours */ }
    }
    return (st.attributes && st.attributes.friendly_name) || '';
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const cssColor = (v) => String(v ?? '').replace(/[;"'<>{}]/g, '').trim();
  // « HH:MM:SS » -> minutes (24:00:00 -> 1440)
  const toMin = (s) => {
    const p = String(s ?? '').split(':').map(Number);
    if (!Number.isFinite(p[0])) return null;
    return clamp((p[0] || 0) * 60 + (p[1] || 0) + (p[2] || 0) / 60, 0, DAY);
  };
  const toHMS = (m) => (m >= DAY ? '24:00:00' : `${pad(m / 60)}:${pad(m % 60)}:00`);
  const hhmm = (m) => (m >= DAY ? '24:00' : `${pad(m / 60)}:${pad(m % 60)}`);
  const dur = (m, L) => {
    const h = Math.floor(m / 60);
    const mn = Math.round(m % 60);
    if (!h) return `${mn} min`;
    return mn ? `${h} h ${pad(mn)}` : (L === 'fr' ? `${h} h` : `${h} h`);
  };

  // ---------- Traductions ----------
  const I18N = {
    fr: {
      title: 'Ma journée', today: 'Aujourd\'hui', tomorrow: 'Demain',
      days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
      days_short: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
      until: 'jusqu\'à {t}', at: 'à {t}', from_to: '{a} – {b}', nothing: 'Rien de prévu',
      sunrise: 'Lever', sunset: 'Coucher', delete: 'Supprimer la plage', close: 'Fermer',
      read_only: 'Lecture seule', admin_only: 'Modification réservée aux administrateurs',
      not_found: 'Planning introuvable (plannings YAML non pris en charge)',
      hint_edit: 'Glissez les extrémités, ou la plage entière',
      hint_new: 'Appui long sur un vide : nouvelle plage',
      saving: 'Enregistrement…', error: 'Échec de l\'enregistrement',
      err_layers: 'day-wheel-card : « layers » doit contenir entre 1 et 6 entités.',
      unsupported: 'Type d\'entité non pris en charge',
      card_desc: 'Roue des 24 heures : plannings modifiables au doigt, heures, calendriers, soleil.',
      // Éditeur
      sec_general: 'Paramètres généraux', name: 'Titre', theme: 'Thème', theme_auto: 'Auto (thème HA)', theme_dark: 'Sombre', theme_light: 'Clair',
      knob_theme: 'Style du centre', skin_metal: 'Métal brossé (défaut)', skin_ha: 'Thème Home Assistant', skin_glass: 'Verre dépoli',
      skin_neumorph: 'Doux (relief mat)', skin_brass: 'Laiton vintage', skin_carbon: 'Carbone', skin_neon: 'Néon',
      orientation: 'Orientation', o_midnight_top: 'Minuit en haut (défaut)', o_noon_top: 'Midi en haut',
      palette: 'Couleurs des anneaux sans couleur choisie', pal_default: 'Palette de la carte (défaut)', pal_theme: 'Couleurs du thème HA', theme_ha: 'Thème HA',
      snap: 'Pas de réglage', min: 'min',
      show_sun: 'Nuit grisée, lever et coucher du soleil', show_days: 'Jours de la semaine', show_legend: 'Légende sous le cadran',
      haptics: 'Retour haptique (vibration) sur écran tactile',
      sec_layers: 'Anneaux ({n}/6), de l\'extérieur vers l\'intérieur', add: '+ Ajouter', layer: 'Anneau', entity: 'Entité',
      layer_name: 'Nom', color: 'Couleur', icon: 'Icône', up: 'Monter', down: 'Descendre', remove: 'Supprimer',
      layers_hint: 'Planning (schedule) : plages modifiables au doigt. input_datetime / time : heure à faire glisser. Capteur horodatage : repère. Calendrier : événements du jour.',
    },
    en: {
      title: 'My day', today: 'Today', tomorrow: 'Tomorrow',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      days_short: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      until: 'until {t}', at: 'at {t}', from_to: '{a} – {b}', nothing: 'Nothing planned',
      sunrise: 'Sunrise', sunset: 'Sunset', delete: 'Delete time range', close: 'Close',
      read_only: 'Read only', admin_only: 'Only administrators can edit',
      not_found: 'Schedule not found (YAML schedules are not supported)',
      hint_edit: 'Drag the ends, or the whole range',
      hint_new: 'Long press an empty spot: new range',
      saving: 'Saving…', error: 'Could not save',
      err_layers: 'day-wheel-card: "layers" must contain 1 to 6 entities.',
      unsupported: 'Unsupported entity type',
      card_desc: '24-hour wheel: schedules you edit with a finger, times, calendars, sun.',
      sec_general: 'General', name: 'Title', theme: 'Theme', theme_auto: 'Auto (HA theme)', theme_dark: 'Dark', theme_light: 'Light',
      knob_theme: 'Center style', skin_metal: 'Brushed metal (default)', skin_ha: 'Home Assistant theme', skin_glass: 'Frosted glass',
      skin_neumorph: 'Soft (matte relief)', skin_brass: 'Vintage brass', skin_carbon: 'Carbon', skin_neon: 'Neon',
      orientation: 'Orientation', o_midnight_top: 'Midnight at the top (default)', o_noon_top: 'Noon at the top',
      palette: 'Colors of rings without a chosen color', pal_default: 'Card palette (default)', pal_theme: 'Home Assistant theme colors', theme_ha: 'HA theme',
      snap: 'Adjust step', min: 'min',
      show_sun: 'Shaded night, sunrise and sunset', show_days: 'Days of the week', show_legend: 'Legend below the dial',
      haptics: 'Haptic feedback (vibration) on touch screens',
      sec_layers: 'Rings ({n}/6), from outside to inside', add: '+ Add', layer: 'Ring', entity: 'Entity',
      layer_name: 'Name', color: 'Color', icon: 'Icon', up: 'Move up', down: 'Move down', remove: 'Remove',
      layers_hint: 'Schedule: time ranges you edit with a finger. input_datetime / time: a time you drag. Timestamp sensor: marker. Calendar: today\'s events.',
    },
  };
  const langOf = (hass) => {
    const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || navigator.language || 'en').toLowerCase();
    return l.startsWith('fr') ? 'fr' : 'en';
  };
  const tr = (L, key, vars) => {
    let s = (I18N[L] && I18N[L][key]) ?? I18N.en[key] ?? key;
    if (vars && typeof s === 'string') Object.entries(vars).forEach(([k, v]) => { s = s.split(`{${k}}`).join(v); });
    return s;
  };

  const normalizeLayer = (l) => {
    if (!l) return null;
    if (typeof l === 'string') return { entity: l };
    if (typeof l === 'object' && l.entity) return { ...l };
    return null;
  };
  const kindOf = (entity) => KINDS[String(entity || '').split('.')[0]] || 'unsupported';

  const STYLES = `
    :host { display: block; }
    ha-card { overflow: hidden; }
    ha-icon { display: inline-flex; }
    .wrap {
      --dwc-text: var(--primary-text-color, #1c1f26);
      --dwc-muted: var(--secondary-text-color, #6b7280);
      --dwc-face: hsl(220 14% 95%);
      --dwc-face-edge: hsl(220 10% 86%);
      --dwc-track: hsl(220 12% 88%);
      --dwc-tick: hsl(220 8% 55%);
      --dwc-dayband: hsl(42 90% 60% / 0.16);
      --dwc-nightband: hsl(230 35% 35% / 0.22);
      --dwc-sun: #f6a623;
      --dwc-hand: #e5484d;
      --dwc-c1: hsl(220 10% 98%);
      --dwc-c2: hsl(220 8% 84%);
      --dwc-c-edge: hsl(220 6% 70%);
      --dwc-c-text: #1c1f26;
      --dwc-c-shadow: 0 1px 2px rgb(0 0 0 / .18), 0 6px 18px -4px rgb(0 0 0 / .28), inset 0 1px 0 rgb(255 255 255 / .9);
      padding: 12px 12px 14px;
      color: var(--dwc-text);
      container-type: inline-size;
    }
    .wrap.dark {
      --dwc-face: hsl(220 12% 13%);
      --dwc-face-edge: hsl(220 10% 20%);
      --dwc-track: hsl(220 10% 21%);
      --dwc-tick: hsl(220 8% 58%);
      --dwc-dayband: hsl(42 80% 60% / 0.10);
      --dwc-nightband: hsl(230 45% 3% / 0.6);
      --dwc-c1: hsl(220 8% 34%);
      --dwc-c2: hsl(220 8% 16%);
      --dwc-c-edge: hsl(220 8% 9%);
      --dwc-c-text: #f2f3f5;
      --dwc-c-shadow: 0 1px 2px rgb(0 0 0 / .5), 0 8px 22px -4px rgb(0 0 0 / .7), inset 0 1px 0 rgb(255 255 255 / .14);
    }
    /* Thème Home Assistant : cadran, anneaux vides, graduations, couronne jour / nuit et centre
       reprennent les couleurs du thème actif (en clair comme en sombre) */
    .wrap.skin-ha {
      --dwc-face: var(--secondary-background-color, var(--card-background-color, #f5f5f5));
      --dwc-face-edge: var(--divider-color, rgb(0 0 0 / .12));
      --dwc-track: color-mix(in srgb, var(--primary-text-color, #212121) 11%, var(--secondary-background-color, var(--card-background-color, #f5f5f5)));
      --dwc-tick: var(--secondary-text-color, #727272);
      --dwc-dayband: color-mix(in srgb, var(--warning-color, #ffa600) 13%, transparent);
      --dwc-nightband: color-mix(in srgb, var(--primary-text-color, #212121) 15%, transparent);
      --dwc-sun: var(--warning-color, #ffa600);
    }
    .wrap.dark.skin-ha { --dwc-nightband: color-mix(in srgb, var(--primary-background-color, #111) 70%, #000); }
    .wrap.skin-ha { --dwc-c1: var(--card-background-color, #fff); --dwc-c2: var(--card-background-color, #fff); --dwc-c-edge: var(--primary-color, #03a9f4); --dwc-c-text: var(--primary-text-color); --dwc-c-shadow: 0 2px 8px rgb(0 0 0 / .18); --dwc-hand: var(--primary-color, #03a9f4); }
    .wrap.skin-glass { --dwc-c1: rgb(255 255 255 / .55); --dwc-c2: rgb(255 255 255 / .18); --dwc-c-edge: rgb(255 255 255 / .6); --dwc-c-shadow: 0 8px 24px -6px rgb(0 0 0 / .35), inset 0 1px 1px rgb(255 255 255 / .7); }
    .wrap.dark.skin-glass { --dwc-c1: rgb(255 255 255 / .16); --dwc-c2: rgb(255 255 255 / .04); --dwc-c-edge: rgb(255 255 255 / .22); }
    .wrap.skin-neumorph { --dwc-c1: var(--dwc-face); --dwc-c2: var(--dwc-face); --dwc-c-edge: transparent; --dwc-c-shadow: 8px 8px 18px rgb(0 0 0 / .16), -8px -8px 18px rgb(255 255 255 / .85); }
    .wrap.dark.skin-neumorph { --dwc-c-shadow: 8px 8px 18px rgb(0 0 0 / .55), -6px -6px 16px rgb(255 255 255 / .05); }
    .wrap.skin-brass { --dwc-c1: #f3d27a; --dwc-c2: #a8761f; --dwc-c-edge: #6e4a0e; --dwc-c-text: #2b1a02; --dwc-hand: #8c2f1b; --dwc-face: hsl(40 35% 92%); --dwc-track: hsl(40 25% 84%); }
    .wrap.dark.skin-brass { --dwc-face: hsl(35 20% 12%); --dwc-track: hsl(35 18% 20%); --dwc-hand: #f0b44c; }
    .wrap.skin-carbon { --dwc-c1: #3a3d42; --dwc-c2: #121315; --dwc-c-edge: #000; --dwc-c-text: #f2f3f5; --dwc-hand: #ff3b30; }
    .wrap.skin-neon { --dwc-c1: #10131c; --dwc-c2: #05060a; --dwc-c-edge: #22e6ff; --dwc-c-text: #b8f7ff; --dwc-hand: #ff2bd6;
      --dwc-c-shadow: 0 0 12px rgb(34 230 255 / .55), inset 0 0 14px rgb(34 230 255 / .25); }
    .wrap.night-dim { filter: brightness(.9); }

    .dial { position: relative; width: 100%; max-width: 420px; margin: 0 auto; aspect-ratio: 1 / 1; touch-action: none; user-select: none; -webkit-user-select: none; }
    .dial > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .dial > svg:focus { outline: none; }
    .dial > svg:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 4px; border-radius: 50%; }
    .dial > svg text { font-family: inherit; }
    .face { fill: var(--dwc-face); stroke: var(--dwc-face-edge); stroke-width: 1; }
    .dayband { fill: none; stroke: var(--dwc-dayband); }
    .nightband { fill: none; stroke: var(--dwc-nightband); }
    .tick { stroke: var(--dwc-tick); stroke-width: 1; opacity: .55; }
    .tick.major { stroke-width: 2; opacity: .9; }
    .hour { fill: var(--dwc-muted); font-size: 13px; text-anchor: middle; dominant-baseline: central; }
    .hour.major { fill: var(--dwc-text); font-weight: 600; }
    .sunmark { fill: var(--dwc-sun); }
    .track { fill: none; stroke: var(--dwc-track); }
    .arc { fill: none; stroke-linecap: round; cursor: pointer; transition: opacity .2s; }
    .arc.ro { cursor: default; }
    .arc.cal { stroke-linecap: butt; opacity: .85; }
    .arc.sel { filter: drop-shadow(0 0 4px var(--dwc-glow, #fff)); }
    .arc.now-on { filter: drop-shadow(0 0 3px var(--dwc-glow, #fff)); }
    .handle { fill: #fff; stroke: var(--dwc-hc, #333); stroke-width: 3; cursor: grab; }
    .marker { cursor: grab; }
    .marker.ro { cursor: default; }
    .marker circle.m-dot { stroke: var(--dwc-face); stroke-width: 3; }
    .hand { stroke: var(--dwc-hand); stroke-width: 2.5; stroke-linecap: round; }
    .hand-dot { fill: var(--dwc-hand); }
    .label-ring { fill: #1c1f26; font-size: 10px; font-weight: 600; letter-spacing: .02em; text-anchor: middle; dominant-baseline: central; pointer-events: none; }

    .center {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: var(--dwc-cw, 40%); aspect-ratio: 1 / 1; border-radius: 50%;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
      background: radial-gradient(circle at 35% 28%, var(--dwc-c1), var(--dwc-c2) 78%);
      box-shadow: var(--dwc-c-shadow); border: 1px solid var(--dwc-c-edge); color: var(--dwc-c-text);
      padding: 6%; box-sizing: border-box; overflow: hidden;
    }
    .wrap.skin-metal .center { background:
      radial-gradient(circle at 35% 28%, rgb(255 255 255 / .55), transparent 55%),
      repeating-conic-gradient(from 0deg, rgb(255 255 255 / .06) 0deg 2deg, rgb(0 0 0 / .05) 2deg 4deg),
      radial-gradient(circle at 50% 40%, var(--dwc-c1), var(--dwc-c2) 80%); }
    .wrap.dark.skin-metal .center { background:
      radial-gradient(circle at 35% 28%, rgb(255 255 255 / .12), transparent 55%),
      repeating-conic-gradient(from 0deg, rgb(255 255 255 / .03) 0deg 2deg, rgb(0 0 0 / .08) 2deg 4deg),
      radial-gradient(circle at 50% 40%, var(--dwc-c1), var(--dwc-c2) 80%); }
    .wrap.skin-carbon .center { background:
      repeating-linear-gradient(45deg, rgb(255 255 255 / .05) 0 3px, transparent 3px 6px),
      repeating-linear-gradient(-45deg, rgb(0 0 0 / .25) 0 3px, transparent 3px 6px),
      radial-gradient(circle at 50% 35%, var(--dwc-c1), var(--dwc-c2)); }
    .wrap.skin-glass .center { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
    .c-big { font-size: clamp(18px, 9cqw, 34px); font-weight: 600; line-height: 1.05; font-variant-numeric: tabular-nums; }
    .c-day { font-size: clamp(10px, 3.2cqw, 13px); opacity: .75; margin-top: 2px; text-transform: capitalize; }
    .c-lines { margin-top: 6px; font-size: clamp(10px, 3.1cqw, 13px); line-height: 1.3; display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .c-line { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
    .c-line ha-icon { --mdc-icon-size: 1.15em; flex: none; }
    .c-line b { font-weight: 600; font-variant-numeric: tabular-nums; }
    .c-line.on ha-icon { filter: drop-shadow(0 0 3px currentColor); }
    .c-hint { font-size: clamp(9px, 2.6cqw, 11px); opacity: .7; margin-top: 4px; line-height: 1.25; }
    .c-btns { display: flex; gap: 8px; margin-top: 6px; }
    .c-btn { all: unset; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
      background: rgb(127 127 127 / .18); color: inherit; }
    .c-btn:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); }
    .c-btn.danger { background: rgb(229 72 77 / .2); color: #e5484d; }
    .c-btn ha-icon { --mdc-icon-size: 18px; }
    .c-err { color: #e5484d; }

    .days { display: flex; justify-content: center; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .day { all: unset; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; position: relative;
      font-size: 13px; font-weight: 500; color: var(--dwc-text); background: var(--dwc-track); }
    .day.sel { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
    .day.today::after { content: ''; position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
    .day:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }

    .legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-top: 10px; font-size: 12px; color: var(--dwc-muted); }
    .lg { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
    .lg.on { color: var(--dwc-text); font-weight: 500; }
    .lg ha-icon { --mdc-icon-size: 17px; }
    .lg.on ha-icon { filter: drop-shadow(0 0 3px currentColor); }
    .lg:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 4px; }
    @media (prefers-reduced-motion: reduce) { .arc { transition: none; } }
  `;

  // Angle (degrés, 0 = droite, sens horaire) d'une minute de la journée
  const angleOf = (m, rot) => (m / DAY) * 360 - 90 + rot;
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [r2(200 + Math.cos(a) * r), r2(200 + Math.sin(a) * r)];
  };
  // Arc (trait) au rayon r entre deux minutes
  const arcPath = (r, m0, m1, rot) => {
    const span = clamp(m1 - m0, 0, DAY);
    if (span <= 0) return '';
    if (span >= DAY - 0.01) {
      const [x0, y0] = pt(r, angleOf(m0, rot));
      const [x1, y1] = pt(r, angleOf(m0 + DAY / 2, rot));
      return `M${x0} ${y0}A${r} ${r} 0 1 1 ${x1} ${y1}A${r} ${r} 0 1 1 ${x0} ${y0}`;
    }
    const [x0, y0] = pt(r, angleOf(m0, rot));
    const [x1, y1] = pt(r, angleOf(m0 + span, rot));
    return `M${x0} ${y0}A${r} ${r} 0 ${span > DAY / 2 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const VIBRATE = { light: 8, medium: 15, heavy: 25, selection: 5, success: [10, 40, 10] };

  class DayWheelCard extends HTMLElement {
    constructor() {
      super();
      this._items = new Map();     // plannings (id -> élément du stockage HA)
      this._ids = {};              // entity_id -> id du planning
      this._cal = {};              // entity_id -> { key, events: [{s, e, title}] }
      this._day = null;            // jour affiché (0 = lundi), null = aujourd'hui
      this._sel = null;            // plage choisie { li, i }
      this._drag = null;
      this._status = null;         // { text, error } au centre
      this._lastFinger = 0;
      this._uid = Math.random().toString(36).slice(2, 8);
    }

    _t(key, vars) { return tr(langOf(this._hass), key, vars); }

    static async getConfigElement() {
      if (!customElements.get('ha-entity-picker') || !customElements.get('ha-icon-picker')) {
        try {
          const helpers = await window.loadCardHelpers?.();
          if (helpers) {
            const c = await helpers.createCardElement({ type: 'entities', entities: [] });
            if (c?.constructor?.getConfigElement) await c.constructor.getConfigElement();
          }
        } catch (e) { /* ignore */ }
      }
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass) {
      const ids = hass && hass.states ? Object.keys(hass.states) : [];
      const pick = (d, n) => ids.filter((e) => e.startsWith(`${d}.`)).slice(0, n);
      const layers = [...pick('schedule', 2), ...pick('input_datetime', 1), ...pick('calendar', 1)].map((entity) => ({ entity }));
      return { layers: layers.length ? layers : [{ entity: 'schedule.chauffage' }, { entity: 'input_datetime.reveil' }] };
    }

    setConfig(config) {
      if (!config) throw new Error(tr('en', 'err_layers'));
      const layers = [].concat(config.layers || config.entities || []).map(normalizeLayer).filter(Boolean);
      if (layers.length < 1 || layers.length > 6) throw new Error(this._t('err_layers'));
      let key = null;
      try { key = JSON.stringify(config); } catch (e) { key = null; }
      if (key && key === this._cfgKey && this._root) return;
      this._cfgKey = key;
      this._config = { ...config, layers };
      this._sel = null;
      this._drag = null;
      this._ids = {};
      this._cal = {};
      this._build();
      if (this._hass) this.hass = this._hass;
    }

    // Le titre (en-tête standard de ha-card) prend une ligne de plus dans la grille
    getCardSize() { return 7 + (this._config && this._config.name ? 1 : 0); }
    getGridOptions() { return { columns: 6, rows: 7 + (this._config && this._config.name ? 1 : 0), min_columns: 4, min_rows: 5 }; }

    connectedCallback() {
      clearInterval(this._tick);
      this._tick = setInterval(() => this._render(), 30000);
      if (this._hass) this._connect();
    }

    disconnectedCallback() {
      clearInterval(this._tick);
      this._tick = null;
      this._disconnect();
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._root) return;
      if (first || !this._subscribed) this._connect();
      this._ensureCalendars();
      this._render();
    }

    // ---------- Données ----------
    _layers() { return this._config.layers; }
    _hasKind(kind) { return this._layers().some((l) => kindOf(l.entity) === kind); }

    _connect() {
      if (!this._hass || !this.isConnected) return;
      if (this._hasKind('schedule') && !this._subscribed) {
        this._subscribed = true;
        const conn = this._hass.connection;
        const onChanges = (changes) => {
          [].concat(changes || []).forEach((c) => {
            if (!c) return;
            // Home Assistant envoie { change_type, schedule_id, item }
            const id = c.schedule_id ?? c.item_id ?? (c.item && c.item.id);
            if (c.change_type === 'removed') this._items.delete(id);
            else if (c.item) this._items.set(id, c.item);
          });
          if (!this._drag && !this._saving) this._render();
        };
        if (conn && typeof conn.subscribeMessage === 'function') {
          Promise.resolve(conn.subscribeMessage(onChanges, { type: 'schedule/subscribe' }))
            .then((unsub) => { if (this._subscribed) this._unsub = unsub; else if (typeof unsub === 'function') unsub(); })
            .catch(() => this._list());
        } else this._list();
        this._resolveIds();
      }
      this._ensureCalendars();
    }

    _disconnect() {
      this._subscribed = false;
      if (typeof this._unsub === 'function') { try { this._unsub(); } catch (e) { /* ignore */ } }
      this._unsub = null;
    }

    async _list() {
      try {
        const list = await this._hass.callWS({ type: 'schedule/list' });
        this._items = new Map([].concat(list || []).map((it) => [it.id, it]));
        this._render();
      } catch (e) { /* planning indisponible */ }
    }

    // entity_id -> id du planning (identifiant unique de l'entité)
    _resolveIds() {
      this._layers().forEach((l) => {
        if (kindOf(l.entity) !== 'schedule' || this._ids[l.entity] !== undefined) return;
        this._ids[l.entity] = null;
        Promise.resolve(this._hass.callWS({ type: 'config/entity_registry/get', entity_id: l.entity }))
          .then((r) => { if (r && r.unique_id) { this._ids[l.entity] = r.unique_id; this._render(); } })
          .catch(() => { /* non enregistrée : recherche par nom */ });
      });
    }

    _item(entity) {
      const id = this._ids[entity];
      if (id && this._items.has(id)) return this._items.get(id);
      // Repli (identifiant unique pas encore lu) : par identifiant, puis par nom du planning
      const st = this._hass && this._hass.states[entity];
      const names = [st && st.attributes && st.attributes.friendly_name, haEntityName(this._hass, entity)].filter(Boolean);
      const slug = entity.split('.')[1];
      for (const it of this._items.values()) {
        if (it.id === slug || names.includes(it.name)) return it;
      }
      return null;
    }

    _canEdit() { return !!(this._hass && this._hass.user && this._hass.user.is_admin); }

    // ---------- Heure du serveur Home Assistant ----------
    _tz() { return (this._hass && this._hass.config && this._hass.config.time_zone) || undefined; }

    _parts(date = new Date()) {
      let f;
      try {
        f = new Intl.DateTimeFormat('en-US', {
          timeZone: this._tz(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
        });
      } catch (e) {
        f = new Intl.DateTimeFormat('en-US', { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
      }
      const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
      const h = Number(p.hour) % 24;
      return { min: h * 60 + Number(p.minute) + Number(p.second) / 60, day: WD_EN.indexOf(p.weekday), ymd: `${p.year}-${p.month}-${p.day}` };
    }

    _now() { return this._parts(window.__dwcNow ? new Date(window.__dwcNow) : new Date()); }

    _shown() {
      const now = this._now();
      const day = this._day == null ? now.day : this._day;
      const offset = (day - now.day + 7) % 7;
      const [y, m, d] = now.ymd.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + offset));
      const ymd = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
      return { day, offset, ymd, today: offset === 0, now };
    }

    // Date / heure ISO -> { ymd, min } dans le fuseau du serveur
    _local(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return this._parts(d);
    }

    // ---------- Calendriers ----------
    _ensureCalendars() {
      if (!this._hass || !this._hasKind('calendar')) return;
      const { ymd } = this._shown();
      const stamp = Math.floor(Date.now() / 600000);    // relecture toutes les 10 minutes
      this._layers().forEach((l) => {
        if (kindOf(l.entity) !== 'calendar') return;
        const key = `${ymd}|${stamp}`;
        const cur = this._cal[l.entity];
        if (cur && (cur.key === key || cur.loading === key)) return;
        this._cal[l.entity] = { ...(cur || { events: [] }), loading: key };
        const start = encodeURIComponent(`${ymd}T00:00:00`);
        const end = encodeURIComponent(`${ymd}T23:59:59`);
        Promise.resolve(this._hass.callApi('GET', `calendars/${l.entity}?start=${start}&end=${end}`))
          .then((list) => {
            const events = [];
            [].concat(list || []).forEach((ev) => {
              const s = ev.start && (ev.start.dateTime || (typeof ev.start === 'string' ? ev.start : null));
              const e = ev.end && (ev.end.dateTime || (typeof ev.end === 'string' ? ev.end : null));
              if (!s || !e || !String(s).includes('T')) return;   // journée entière : ignorée
              const a = this._local(s);
              const b = this._local(e);
              if (!a || !b) return;
              const m0 = a.ymd < ymd ? 0 : (a.ymd > ymd ? null : a.min);
              const m1 = b.ymd > ymd ? DAY : (b.ymd < ymd ? null : b.min);
              if (m0 == null || m1 == null || m1 <= m0) return;
              events.push({ s: m0, e: m1, title: ev.summary || '' });
            });
            this._cal[l.entity] = { key, events };
            this._render();
          })
          .catch(() => { this._cal[l.entity] = { key, events: [] }; });
      });
    }

    // ---------- Contenu de chaque anneau pour le jour affiché ----------
    _blocks(layer, shown) {
      const kind = kindOf(layer.entity);
      if (kind === 'schedule') {
        const it = this._item(layer.entity);
        if (!it) return null;
        return [].concat(it[DAY_KEYS[shown.day]] || []).map((b) => ({ s: toMin(b.from), e: toMin(b.to), data: b.data }))
          .filter((b) => b.s != null && b.e != null && b.e > b.s)
          .sort((a, b) => a.s - b.s);
      }
      if (kind === 'calendar') {
        const c = this._cal[layer.entity];
        return c ? c.events : [];
      }
      return null;
    }

    _markerTime(layer, shown) {
      const st = this._hass && this._hass.states[layer.entity];
      if (!st || ['unknown', 'unavailable', ''].includes(st.state)) return null;
      const domain = layer.entity.split('.')[0];
      const a = st.attributes || {};
      if (domain === 'time' || (domain === 'input_datetime' && a.has_time && !a.has_date)) {
        const m = toMin(st.state);
        return m == null ? null : { m, editable: true };
      }
      if (domain === 'input_datetime' && a.has_time && a.has_date) {
        const [d, t] = String(st.state).split(' ');
        return d === shown.ymd ? { m: toMin(t), editable: true } : null;
      }
      if (domain === 'input_datetime' || domain === 'sensor') {
        const l = this._local(st.state);
        return l && l.ymd === shown.ymd ? { m: l.min, editable: false } : null;
      }
      return null;
    }

    _color(layer, i) {
      const pal = this._config.palette === 'theme' ? THEME_PALETTE : PALETTE;
      return cssColor(layer.color) || pal[i % pal.length];
    }

    _name(layer) {
      if (layer.name) return layer.name;
      return haEntityName(this._hass, layer.entity) || layer.entity;
    }

    _icon(layer) {
      if (layer.icon) return layer.icon;
      const st = this._hass && this._hass.states[layer.entity];
      if (st && st.attributes && st.attributes.icon) return st.attributes.icon;
      return { schedule: 'mdi:calendar-clock', calendar: 'mdi:calendar', marker: 'mdi:alarm' }[kindOf(layer.entity)] || 'mdi:help-circle-outline';
    }

    // Géométrie des anneaux (viewBox 400 × 400)
    _geom() {
      const n = this._layers().length;
      const outer = 168;
      const w = n <= 2 ? 22 : (n <= 4 ? 17 : 12);
      const gap = n <= 2 ? 7 : (n <= 4 ? 5 : 4);
      const rings = this._layers().map((_, i) => {
        const r1 = outer - i * (w + gap);
        return { r: r1 - w / 2, r0: r1 - w, r1, w };
      });
      const inner = rings[rings.length - 1].r0;
      return { rings, inner, cw: clamp(((inner - 10) * 2) / 400, 0.3, 0.62), compact: inner < 75 };
    }

    _rot() { return this._config.orientation === 'noon_top' ? 180 : 0; }
    _snap() { const s = Number(this._config.snap); return SNAPS.includes(s) ? s : 15; }
    _skin() { return SKINS.includes(this._config.knob_theme) ? this._config.knob_theme : 'metal'; }

    // ---------- Construction ----------
    _build() {
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const c = this._config;
      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <ha-card${c.name ? ` header="${esc(c.name)}"` : ''}>
          <div class="wrap skin-${this._skin()}">
            <div class="dial">
              <svg viewBox="0 0 400 400" role="img" aria-label="" tabindex="0">
                <g class="g-face"></g><g class="g-rings"></g><g class="g-top"></g>
              </svg>
              <div class="center" aria-live="polite"></div>
            </div>
            <div class="days" role="tablist"></div>
            <div class="legend"></div>
          </div>
        </ha-card>`;
      const root = this.shadowRoot;
      this._root = root;
      this._wrap = root.querySelector('.wrap');
      this._svg = root.querySelector('svg');
      this._gFace = root.querySelector('.g-face');
      this._gRings = root.querySelector('.g-rings');
      this._gTop = root.querySelector('.g-top');
      this._center = root.querySelector('.center');
      this._days = root.querySelector('.days');
      this._legend = root.querySelector('.legend');

      const svg = this._svg;
      svg.addEventListener('pointerdown', (e) => this._down(e));
      svg.addEventListener('pointermove', (e) => this._move(e));
      svg.addEventListener('pointerup', (e) => this._up(e));
      svg.addEventListener('pointercancel', () => this._cancel());
      svg.addEventListener('contextmenu', (e) => e.preventDefault());
      this._center.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.getAttribute('data-act');
        if (act === 'delete') this._deleteSel();
        if (act === 'close') { this._sel = null; this._render(); }
      });
      this._days.addEventListener('click', (e) => {
        const b = e.target.closest('[data-day]');
        if (!b) return;
        const d = Number(b.getAttribute('data-day'));
        this._day = d === this._now().day ? null : d;
        this._sel = null;
        this._haptic('selection');
        this._ensureCalendars();
        this._render();
      });
      this._legend.addEventListener('click', (e) => {
        const b = e.target.closest('[data-entity]');
        if (!b) return;
        this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: b.getAttribute('data-entity') } }));
      });
      this.shadowRoot.addEventListener('keydown', (e) => {
        if (!this._sel) return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this._deleteSel(); }
        if (e.key === 'Escape') { this._sel = null; this._render(); }
      });
      // Nouveaux éléments : les caches de rendu ne valent plus
      this._centerHtml = null;
      this._daysHtml = null;
      this._legendHtml = null;
      this._render();
    }

    // ---------- Rendu ----------
    _render() {
      if (!this._root || !this._hass) return;
      const c = this._config;
      const L = langOf(this._hass);
      const dark = c.theme === 'dark' || (c.theme !== 'light' && this._hass.themes && this._hass.themes.darkMode);
      this._wrap.classList.toggle('dark', !!dark);
      const shown = this._shown();
      const rot = this._rot();
      const g = this._geom();
      this._wrap.style.setProperty('--dwc-cw', `${r2(g.cw * 100)}%`);

      // Cadran : fond, nuit, graduations, heures
      const outerFace = 196;
      let face = `<circle class="face" cx="200" cy="200" r="${outerFace}"></circle>`;
      const sun = c.show_sun !== false ? this._sun(shown) : null;
      if (sun) {
        // Couronne des heures : jour clair, nuit foncée (coucher -> lever)
        const rb = (g.rings[0].r1 + outerFace) / 2 + 1;
        const wb = outerFace - g.rings[0].r1 - 4;
        face += `<path class="dayband" d="${arcPath(rb, sun.rise, sun.set > sun.rise ? sun.set : sun.set + DAY, rot)}" stroke-width="${r2(wb)}"></path>`;
        face += `<path class="nightband" d="${arcPath(rb, sun.set, sun.rise > sun.set ? sun.rise : sun.rise + DAY, rot)}" stroke-width="${r2(wb)}"></path>`;
      }
      for (let h = 0; h < 24; h += 1) {
        const a = angleOf(h * 60, rot);
        const major = h % 3 === 0;
        const [x0, y0] = pt(major ? 171 : 173, a);
        const [x1, y1] = pt(178, a);
        face += `<line class="tick${major ? ' major' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"></line>`;
        if (major) {
          const [tx, ty] = pt(188, a);
          face += `<text class="hour${h % 6 === 0 ? ' major' : ''}" x="${tx}" y="${ty}">${h}</text>`;
        }
      }
      if (sun) {
        [sun.rise, sun.set].forEach((m) => {
          const [x, y] = pt(175, angleOf(m, rot));
          face += `<circle class="sunmark" cx="${x}" cy="${y}" r="3.5"><title>${esc(hhmm(m))}</title></circle>`;
        });
      }

      // Anneaux
      let rings = '';
      let top = '';
      const editable = this._canEdit();
      this._layers().forEach((layer, li) => {
        const R = g.rings[li];
        const col = this._color(layer, li);
        const kind = kindOf(layer.entity);
        rings += `<circle class="track" cx="200" cy="200" r="${R.r}" stroke-width="${R.w}"></circle>`;
        if (kind === 'schedule' || kind === 'calendar') {
          const blocks = this._drag && this._drag.li === li ? this._drag.blocks : this._blocks(layer, shown);
          (blocks || []).forEach((b, i) => {
            const sel = this._sel && this._sel.li === li && this._sel.i === i;
            const live = shown.today && shown.now.min >= b.s && shown.now.min < b.e;
            const cls = ['arc', kind === 'calendar' ? 'cal ro' : '', kind === 'schedule' && !editable ? 'ro' : '', sel ? 'sel' : '', live ? 'now-on' : ''].filter(Boolean).join(' ');
            // Trait arrondi : on retire le débord des bouts (w/2) pour que l'arc couvre exactement la plage
            const inset = kind === 'calendar' ? 0 : ((R.w / 2) / (2 * Math.PI * R.r)) * DAY;
            const m0 = b.s + Math.min(inset, (b.e - b.s) / 2 - 0.01);
            const m1 = b.e - Math.min(inset, (b.e - b.s) / 2 - 0.01);
            const title = kind === 'calendar' ? `${b.title} · ` : '';
            rings += `<path class="${cls}" data-li="${li}" data-i="${i}" d="${arcPath(R.r, m0, Math.max(m1, m0 + 0.01), rot)}" stroke-width="${R.w}" style="stroke:${col};--dwc-glow:${col}"><title>${esc(title + hhmm(b.s))} – ${esc(hhmm(b.e))}</title></path>`;
            if (sel && kind === 'schedule' && editable) {
              [b.s, b.e].forEach((m, k) => {
                const [x, y] = pt(R.r, angleOf(m, rot));
                top += `<circle class="handle" data-li="${li}" data-i="${i}" data-h="${k ? 'end' : 'start'}" cx="${x}" cy="${y}" r="${r2(R.w / 2 - 1)}" style="--dwc-hc:${col}"></circle>`;
              });
            }
          });
        } else if (kind === 'marker') {
          const mk = this._drag && this._drag.li === li ? { m: this._drag.m, editable: true } : this._markerTime(layer, shown);
          if (mk) {
            const [x, y] = pt(R.r, angleOf(mk.m, rot));
            const ro = !mk.editable || !this._canSet(layer.entity);
            const rd = R.w / 2 + 3;
            const label = hhmm(mk.m).replace(/^0/, '');
            const fs = r2(Math.min(10, (rd * 2 - 3) / (label.length * 0.58)));
            top += `<g class="marker${ro ? ' ro' : ''}${this._drag && this._drag.li === li ? ' dragging' : ''}" data-li="${li}">
              <circle class="m-dot" cx="${x}" cy="${y}" r="${r2(rd)}" style="fill:${col}"></circle>
              ${fs >= 7 ? `<text class="label-ring" x="${x}" y="${y}" style="font-size:${fs}px">${esc(label)}</text>` : ''}
              <title>${esc(this._name(layer))} · ${esc(hhmm(mk.m))}</title></g>`;
          }
        }
      });

      // Aiguille de l'heure actuelle (jour affiché = aujourd'hui)
      if (shown.today) {
        const a = angleOf(shown.now.min, rot);
        const [x0, y0] = pt(g.inner - 6, a);
        const [x1, y1] = pt(g.rings[0].r1 + 6, a);
        const [dx, dy] = pt(g.rings[0].r1 + 6, a);
        top = `<line class="hand" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"></line><circle class="hand-dot" cx="${dx}" cy="${dy}" r="4"></circle>${top}`;
      }

      this._gFace.innerHTML = face;
      this._gRings.innerHTML = rings;
      this._gTop.innerHTML = top;
      this._svg.setAttribute('aria-label', this._summary(shown));

      this._renderCenter(shown, L);
      this._renderDays(shown, L);
      this._renderLegend(shown);
    }

    _sun(shown) {
      const s = this._hass.states['sun.sun'];
      if (!s || !s.attributes) return null;
      const rise = this._local(s.attributes.next_rising);
      const set = this._local(s.attributes.next_setting);
      if (!rise || !set) return null;
      return { rise: rise.min, set: set.min, shown };
    }

    _canSet(entity) {
      const d = entity.split('.')[0];
      return d === 'time' || d === 'input_datetime';
    }

    _summary(shown) {
      const L = langOf(this._hass);
      const day = shown.today ? tr(L, 'today') : tr(L, 'days')[shown.day];
      return `${day} : ${this._lines(shown).map((l) => l.text).join(' ; ') || tr(L, 'nothing')}`;
    }

    // Lignes du centre : état de chaque anneau (en cours jusqu'à…, prochain à…)
    _lines(shown) {
      const L = langOf(this._hass);
      const out = [];
      this._layers().forEach((layer, li) => {
        const kind = kindOf(layer.entity);
        const name = this._name(layer);
        const col = this._color(layer, li);
        if (kind === 'schedule' || kind === 'calendar') {
          const blocks = this._blocks(layer, shown) || [];
          const t = shown.today ? shown.now.min : -1;
          const cur = blocks.find((b) => t >= b.s && t < b.e);
          const next = blocks.find((b) => b.s > t);
          if (cur) out.push({ col, name, icon: this._icon(layer), time: `→ ${hhmm(cur.e)}`, text: `${name} · ${tr(L, 'until', { t: hhmm(cur.e) })}`, on: true });
          else if (next) out.push({ col, name, icon: this._icon(layer), time: hhmm(next.s), text: `${name} · ${tr(L, 'at', { t: hhmm(next.s) })}` });
        } else if (kind === 'marker') {
          const mk = this._markerTime(layer, shown);
          if (mk && (!shown.today || mk.m >= shown.now.min)) out.push({ col, name, icon: this._icon(layer), time: hhmm(mk.m), text: `${name} · ${hhmm(mk.m)}` });
        }
      });
      return out;
    }

    _renderCenter(shown, L) {
      const d = this._drag;
      let html;
      if (d && d.started) {
        const layer = this._layers()[d.li];
        if (d.blocks) {
          const b = d.blocks[d.i];
          html = `<div class="c-day">${esc(this._name(layer))}</div><div class="c-big">${esc(hhmm(b.s))}<br>${esc(hhmm(b.e))}</div><div class="c-hint">${esc(dur(b.e - b.s, L))}</div>`;
        } else {
          html = `<div class="c-day">${esc(this._name(layer))}</div><div class="c-big">${esc(hhmm(d.m))}</div>`;
        }
      } else if (this._sel) {
        const layer = this._layers()[this._sel.li];
        const blocks = this._blocks(layer, shown) || [];
        const b = blocks[this._sel.i];
        if (!b) { this._sel = null; this._renderCenter(shown, L); return; }
        const isSched = kindOf(layer.entity) === 'schedule';
        const can = isSched && this._canEdit();
        const title = kindOf(layer.entity) === 'calendar' ? (b.title || this._name(layer)) : this._name(layer);
        html = `<div class="c-day">${esc(title)}</div>
          <div class="c-big" style="font-size:clamp(13px,5.4cqw,22px);white-space:nowrap">${esc(hhmm(b.s))} – ${esc(hhmm(b.e))}</div>
          <div class="c-hint">${esc(dur(b.e - b.s, L))}${isSched ? ` · ${esc(can ? tr(L, 'hint_edit') : tr(L, 'admin_only'))}` : ''}</div>
          <div class="c-btns">
            ${can ? `<button class="c-btn danger" data-act="delete" title="${esc(tr(L, 'delete'))}" aria-label="${esc(tr(L, 'delete'))}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>` : ''}
            <button class="c-btn" data-act="close" title="${esc(tr(L, 'close'))}" aria-label="${esc(tr(L, 'close'))}"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>`;
      } else {
        const big = shown.today ? hhmm(shown.now.min) : tr(L, 'days')[shown.day];
        const sub = shown.today ? tr(L, 'today') : (shown.offset === 1 ? tr(L, 'tomorrow') : '');
        const compact = this._geom().compact;
        const lines = this._lines(shown).slice(0, compact ? 0 : 3);
        html = `<div class="c-big">${esc(big)}</div>
          ${sub ? `<div class="c-day">${esc(sub)}</div>` : ''}
          ${compact ? '' : `<div class="c-lines">${lines.length ? lines.map((l) => `<div class="c-line${l.on ? ' on' : ''}" title="${esc(l.text)}"><ha-icon icon="${esc(l.icon)}" style="color:${l.col}"></ha-icon><b>${esc(l.time)}</b></div>`).join('') : `<div class="c-line">${esc(tr(L, 'nothing'))}</div>`}</div>`}`;
      }
      if (this._status) html += `<div class="c-hint${this._status.error ? ' c-err' : ''}">${esc(this._status.text)}</div>`;
      if (this._centerHtml !== html) { this._centerHtml = html; this._center.innerHTML = html; }
    }

    _renderDays(shown, L) {
      const show = this._config.show_days !== false && (this._hasKind('schedule') || this._hasKind('calendar'));
      this._days.style.display = show ? '' : 'none';
      if (!show) return;
      const names = tr(L, 'days');
      const short = tr(L, 'days_short');
      const html = short.map((s, d) => `<button class="day${d === shown.day ? ' sel' : ''}${d === shown.now.day ? ' today' : ''}" role="tab" aria-selected="${d === shown.day}" data-day="${d}" title="${esc(names[d])}" aria-label="${esc(names[d])}">${esc(s)}</button>`).join('');
      if (this._daysHtml !== html) { this._daysHtml = html; this._days.innerHTML = html; }
    }

    _renderLegend(shown) {
      const show = this._config.show_legend !== false;
      this._legend.style.display = show ? '' : 'none';
      if (!show) return;
      const html = this._layers().map((layer, li) => {
        const st = this._hass.states[layer.entity];
        const on = st && st.state === 'on';
        const ok = kindOf(layer.entity) !== 'unsupported';
        return `<button class="lg${on ? ' on' : ''}" data-entity="${esc(layer.entity)}" title="${esc(ok ? layer.entity : this._t('unsupported'))}"><ha-icon icon="${esc(this._icon(layer))}" style="color:${this._color(layer, li)}"></ha-icon>${esc(this._name(layer))}</button>`;
      }).join('');
      if (this._legendHtml !== html) { this._legendHtml = html; this._legend.innerHTML = html; }
      void shown;
    }

    // ---------- Pointeur ----------
    _polar(e) {
      const r = this._svg.getBoundingClientRect();
      const k = 400 / r.width;
      const x = (e.clientX - r.left) * k - 200;
      const y = (e.clientY - r.top) * k - 200;
      const deg = (Math.atan2(y, x) * 180) / Math.PI;
      let m = (((deg + 90 - this._rot()) % 360) + 360) % 360;
      m = (m / 360) * DAY;
      return { r: Math.hypot(x, y), m, scale: k };
    }

    _ringAt(r) {
      const g = this._geom();
      return g.rings.findIndex((R) => r >= R.r0 - 5 && r <= R.r1 + 5);
    }

    _down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch') this._lastFinger = Date.now();
      try { this._svg.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      const p = this._polar(e);
      const li = this._ringAt(p.r);
      this._cancel();
      if (li < 0) {
        if (this._sel) { this._sel = null; this._render(); }
        return;
      }
      const layer = this._layers()[li];
      const kind = kindOf(layer.entity);
      const shown = this._shown();
      const base = { id: e.pointerId, li, x: e.clientX, y: e.clientY, m0: p.m, last: p.m, acc: 0, started: false };

      if (kind === 'marker') {
        const mk = this._markerTime(layer, shown);
        if (!mk || !mk.editable || !this._canSet(layer.entity)) return;
        const R = this._geom().rings[li];
        const tol = ((R.w / 2 + 10) / (2 * Math.PI * R.r)) * DAY;
        if (Math.abs(((p.m - mk.m + DAY * 1.5) % DAY) - DAY / 2) > tol) return;
        this._drag = { ...base, type: 'marker', start: mk.m, m: mk.m };
        this._capture(e);
        return;
      }
      if (kind === 'calendar') {
        const blocks = this._blocks(layer, shown) || [];
        const i = blocks.findIndex((b) => p.m >= b.s && p.m < b.e);
        this._pending = { ...base, type: 'tap', i };
        return;
      }
      if (kind !== 'schedule') return;

      const blocks = this._blocks(layer, shown);
      if (!blocks) { this._flash(this._t('not_found'), true); return; }
      const R = this._geom().rings[li];
      const tol = ((R.w / 2 + 6) / (2 * Math.PI * R.r)) * DAY;
      const near = (a, b) => Math.abs(((a - b + DAY * 1.5) % DAY) - DAY / 2) <= tol;
      const editable = this._canEdit();
      // Extrémité d'une plage : réglage immédiat
      if (editable) {
        for (let i = 0; i < blocks.length; i += 1) {
          const b = blocks[i];
          const edge = near(p.m, b.e) ? 'end' : (near(p.m, b.s) ? 'start' : null);
          if (edge && (b.e - b.s > tol * 2 || (this._sel && this._sel.li === li && this._sel.i === i))) {
            this._drag = { ...base, type: edge, i, blocks: blocks.map((x) => ({ ...x })), orig: { ...b } };
            this._capture(e);
            return;
          }
        }
      }
      const i = blocks.findIndex((b) => p.m >= b.s && p.m < b.e);
      if (i >= 0) {
        this._pending = { ...base, type: editable ? 'move' : 'tap', i, blocks: blocks.map((x) => ({ ...x })), orig: { ...blocks[i] } };
        this._capture(e);
        return;
      }
      // Vide : appui long = nouvelle plage
      this._pending = { ...base, type: 'empty' };
      if (editable) {
        this._lpTimer = setTimeout(() => { this._lpTimer = null; this._create(li, p.m); }, LONG_PRESS_MS);
      }
    }

    _capture(e) {
      try { this._svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    _move(e) {
      if (e.pointerType === 'touch') this._lastFinger = Date.now();
      const pd = this._pending;
      if (pd && e.pointerId === pd.id) {
        if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 6) {
          clearTimeout(this._lpTimer);
          this._lpTimer = null;
          if (pd.type === 'move') { this._drag = pd; this._pending = null; } else { this._pending = null; return; }
        } else return;
      }
      const d = this._drag;
      if (!d || e.pointerId !== d.id) return;
      e.preventDefault();
      const p = this._polar(e);
      let delta = p.m - d.last;
      if (delta > DAY / 2) delta -= DAY;
      if (delta < -DAY / 2) delta += DAY;
      d.last = p.m;
      d.acc += delta;
      d.started = true;
      const snap = this._snap();
      const sn = (v) => Math.round(v / snap) * snap;
      if (d.type === 'marker') {
        const m = ((sn(d.start + d.acc) % DAY) + DAY) % DAY;
        if (m !== d.m) { d.m = m; this._haptic('selection'); }
      } else {
        const bl = d.blocks;
        const o = d.orig;
        const prevEnd = d.i > 0 ? bl[d.i - 1].e : 0;
        const nextStart = d.i < bl.length - 1 ? bl[d.i + 1].s : DAY;
        const b = bl[d.i];
        const before = `${b.s}-${b.e}`;
        if (d.type === 'start') b.s = clamp(sn(o.s + d.acc), prevEnd, b.e - snap);
        else if (d.type === 'end') b.e = clamp(sn(o.e + d.acc), b.s + snap, nextStart);
        else {
          const len = o.e - o.s;
          b.s = clamp(sn(o.s + d.acc), prevEnd, nextStart - len);
          b.e = b.s + len;
        }
        if (`${b.s}-${b.e}` !== before) this._haptic('selection');
        this._sel = { li: d.li, i: d.i };
      }
      this._render();
    }

    _up(e) {
      clearTimeout(this._lpTimer);
      this._lpTimer = null;
      const pd = this._pending;
      if (pd && e.pointerId === pd.id) {
        this._pending = null;
        if (pd.type === 'empty') { if (this._sel) { this._sel = null; this._render(); } return; }
        if (pd.i >= 0) {
          const same = this._sel && this._sel.li === pd.li && this._sel.i === pd.i;
          this._sel = same ? null : { li: pd.li, i: pd.i };
          this._haptic('light');
          this._render();
        }
        return;
      }
      const d = this._drag;
      if (!d || e.pointerId !== d.id) return;
      this._drag = null;
      if (!d.started) {
        // Appui sans glisser sur une extrémité : choisir la plage
        if (d.blocks) {
          const same = this._sel && this._sel.li === d.li && this._sel.i === d.i;
          this._sel = same ? null : { li: d.li, i: d.i };
          this._haptic('light');
        }
        this._render();
        return;
      }
      this._lastDrag = Date.now();
      if (d.type === 'marker') this._setMarker(d.li, d.m);
      else this._save(d.li, d.blocks);
      this._render();
    }

    _cancel() {
      clearTimeout(this._lpTimer);
      this._lpTimer = null;
      this._pending = null;
      if (this._drag) { this._drag = null; this._render(); }
    }

    // ---------- Modifications ----------
    _create(li, m) {
      const p = this._pending;
      this._pending = null;
      const layer = this._layers()[li];
      const blocks = this._blocks(layer, this._shown());
      if (!blocks) return;
      const snap = this._snap();
      const len = Math.max(60, snap);
      let s = Math.round((m - len / 2) / snap) * snap;
      const prev = [...blocks].reverse().find((b) => b.e <= m);
      const next = blocks.find((b) => b.s >= m);
      const lo = prev ? prev.e : 0;
      const hi = next ? next.s : DAY;
      if (hi - lo < snap) return;
      s = clamp(s, lo, Math.max(lo, hi - len));
      const e = Math.min(hi, s + len);
      const nb = [...blocks.map((b) => ({ ...b })), { s, e }].sort((a, b) => a.s - b.s);
      this._sel = { li, i: nb.findIndex((b) => b.s === s) };
      this._haptic('medium');
      this._save(li, nb);
      void p;
    }

    _deleteSel() {
      const sel = this._sel;
      if (!sel || !this._canEdit()) return;
      const layer = this._layers()[sel.li];
      if (kindOf(layer.entity) !== 'schedule') return;
      const blocks = this._blocks(layer, this._shown()) || [];
      if (!blocks[sel.i]) return;
      this._sel = null;
      this._haptic('heavy');
      this._save(sel.li, blocks.filter((_, k) => k !== sel.i));
    }

    async _save(li, blocks) {
      const layer = this._layers()[li];
      const it = this._item(layer.entity);
      if (!it || !this._canEdit()) return;
      const dayKey = DAY_KEYS[this._shown().day];
      const ser = (b) => ({ from: toHMS(b.s), to: toHMS(b.e), ...(b.data && typeof b.data === 'object' ? { data: b.data } : {}) });
      const msg = { type: 'schedule/update', schedule_id: it.id, name: it.name };
      if (it.icon) msg.icon = it.icon;
      DAY_KEYS.forEach((k) => {
        msg[k] = k === dayKey ? blocks.map(ser) : [].concat(it[k] || []).map((b) => ({ from: b.from, to: b.to, ...(b.data ? { data: b.data } : {}) }));
      });
      // Affichage immédiat, rétabli si Home Assistant refuse
      const before = it;
      const after = { ...it, [dayKey]: blocks.map(ser) };
      this._items.set(it.id, after);
      this._saving = true;
      this._status = { text: this._t('saving') };
      this._render();
      try {
        const res = await this._hass.callWS(msg);
        if (res && res.id) this._items.set(res.id, res);
        this._status = null;
      } catch (err) {
        this._items.set(before.id, before);
        this._status = { text: `${this._t('error')}${err && err.message ? ` : ${err.message}` : ''}`, error: true };
        clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => { this._status = null; this._render(); }, 4000);
      }
      this._saving = false;
      this._render();
    }

    _setMarker(li, m) {
      const layer = this._layers()[li];
      const domain = layer.entity.split('.')[0];
      const st = this._hass.states[layer.entity];
      const a = (st && st.attributes) || {};
      const time = toHMS(m % DAY);
      this._haptic('medium');
      if (domain === 'time') this._hass.callService('time', 'set_value', { entity_id: layer.entity, time });
      else if (domain === 'input_datetime') {
        const data = a.has_date ? { datetime: `${this._shown().ymd} ${time}` } : { time };
        this._hass.callService('input_datetime', 'set_datetime', { entity_id: layer.entity, ...data });
      }
    }

    _flash(text, error) {
      this._status = { text, error };
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => { this._status = null; this._render(); }, 3500);
      this._render();
    }

    // ---------- Retour haptique (appli HA mobile, sinon vibreur du navigateur) ----------
    _haptic(type) {
      if (this._config.haptics === false) return;
      if (Date.now() - this._lastFinger > 2000) return;
      if (this._hass && this._hass.vibrate === false) return;
      try { window.dispatchEvent(new CustomEvent('haptic', { detail: type })); } catch (e) { /* ignore */ }
      const inApp = !!(window.externalApp || (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.externalBus));
      if (!inApp && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(VIBRATE[type] || 8); } catch (e) { /* ignore */ }
      }
    }
  }

  /* ============================================================================
   * ÉDITEUR VISUEL
   * ========================================================================== */
  const EDITOR_STYLES = `
    :host { display: block; }
    .section { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    .section-title { font-weight: 600; margin-bottom: 10px; color: var(--primary-text-color); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 520px) { .grid-2 { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 12px; color: var(--secondary-text-color); }
    input[type="text"], select { font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff); color: var(--primary-text-color); }
    .switches { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .switch-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--primary-text-color); }
    .layer { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 10px; padding: 10px; margin-top: 8px; }
    .layer-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: var(--primary-text-color); font-weight: 500; }
    .layer-head span { flex: 1; }
    .layer-head i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .mini { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 6px; color: var(--primary-text-color); background: var(--secondary-background-color, #eee); font-size: 13px; }
    .mini[disabled] { opacity: .35; cursor: default; }
    .add { all: unset; cursor: pointer; margin-top: 10px; padding: 6px 12px; border-radius: 8px; background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); font-size: 14px; }
    .add[disabled] { opacity: .4; cursor: default; }
    .color-row { display: flex; gap: 6px; align-items: center; }
    .color-row input[type="color"] { width: 36px; height: 34px; padding: 0; border: none; background: none; }
    .color-row input[type="text"] { flex: 1; min-width: 0; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin-top: 8px; line-height: 1.4; }
  `;
  const DEFAULT_TRUE = ['show_sun', 'show_days', 'show_legend', 'haptics'];
  const SELECT_DEFAULTS = { theme: 'auto', knob_theme: 'metal', orientation: 'midnight_top', snap: '15', palette: 'default' };
  const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const toHex = (v) => {
    const s = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return (`#${s.slice(1).split('').map((ch) => ch + ch).join('')}`).toLowerCase();
    return null;
  };

  class DayWheelCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = null;
      this._hass = null;
    }

    _t(key, vars) { return tr(langOf(this._hass), key, vars); }

    setConfig(config) {
      const cfg = JSON.parse(JSON.stringify(config || {}));
      if (!cfg.layers && cfg.entities) cfg.layers = cfg.entities;
      delete cfg.entities;
      cfg.layers = [].concat(cfg.layers || []).map(normalizeLayer).filter(Boolean);
      this._config = cfg;
      const sig = this._signature();
      if (sig !== this._sig || !this.shadowRoot.querySelector('.ed')) this._render();
      else this._syncValues();
    }

    set hass(hass) {
      const relang = !this._hass || langOf(hass) !== langOf(this._hass);
      this._hass = hass;
      if (!this._config) return;
      if (relang || !this.shadowRoot.querySelector('.ed')) { this._render(); return; }
      this.shadowRoot.querySelectorAll('ha-entity-picker, ha-icon-picker').forEach((el) => { el.hass = hass; });
    }

    _signature() { return JSON.stringify([langOf(this._hass), this._config.layers.length, this._config.palette === 'theme']); }

    // Couleur d'un anneau sans couleur choisie (palette de la carte ou du thème)
    _defaultColor(i) {
      const pal = this._config.palette === 'theme' ? THEME_PALETTE : PALETTE;
      return pal[i % pal.length];
    }

    _emit() {
      const { type, ...rest } = this._config;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: type || `custom:${TAG}`, ...rest } }, bubbles: true, composed: true }));
    }

    _set(key, v) {
      if (v === undefined || v === '') delete this._config[key];
      else this._config[key] = v;
      this._emit();
    }

    _setLayer(i, patch) {
      const layers = this._config.layers.map((l) => ({ ...l }));
      Object.entries(patch).forEach(([k, v]) => { if (v === undefined || v === '') delete layers[i][k]; else layers[i][k] = v; });
      this._config.layers = layers;
      this._emit();
      const head = this.shadowRoot.querySelector(`[data-layer="${i}"] .layer-head i`);
      if (head) head.style.background = cssColor(layers[i].color) || this._defaultColor(i);
    }

    _render() {
      const c = this._config;
      const t = (k, v) => this._t(k, v);
      this._sig = this._signature();
      const sw = (key, label) => `<label class="switch-label"><input type="checkbox" data-field="${key}" ${c[key] !== false ? 'checked' : ''}> ${esc(label)}</label>`;
      const layers = c.layers.map((l, i) => `
        <div class="layer" data-layer="${i}">
          <div class="layer-head"><i style="background:${cssColor(l.color) || this._defaultColor(i)}"></i><span>${esc(t('layer'))} ${i + 1}</span>
            <button class="mini" data-move="-1" ${i === 0 ? 'disabled' : ''} title="${esc(t('up'))}">▲</button>
            <button class="mini" data-move="1" ${i === c.layers.length - 1 ? 'disabled' : ''} title="${esc(t('down'))}">▼</button>
            <button class="mini" data-del ${c.layers.length <= 1 ? 'disabled' : ''} title="${esc(t('remove'))}">✕</button>
          </div>
          <div class="grid-2">
            <div class="field"><ha-entity-picker data-lkey="entity" allow-custom-entity></ha-entity-picker></div>
            <div class="field"><label>${esc(t('layer_name'))}</label><input type="text" data-lfield="name" value="${esc(l.name || '')}"></div>
            <div class="field"><label>${esc(t('color'))}</label><div class="color-row">
              <input type="color" data-swatch value="${esc(toHex(l.color) || PALETTE[i % PALETTE.length])}">
              <input type="text" data-lfield="color" value="${esc(l.color || '')}" placeholder="${esc(c.palette === 'theme' ? t('theme_ha') : PALETTE[i % PALETTE.length])}"></div></div>
            <div class="field"><ha-icon-picker data-lkey="icon"></ha-icon-picker></div>
          </div>
        </div>`).join('');
      this.shadowRoot.innerHTML = `
        <style>${EDITOR_STYLES}</style>
        <div class="ed">
          <div class="section">
            <div class="section-title">${esc(t('sec_general'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('name'))}</label><input type="text" data-field="name" value="${esc(c.name || '')}" placeholder="${esc(t('title'))}"></div>
              <div class="field"><label>${esc(t('theme'))}</label><select data-field="theme">${opts([['auto', t('theme_auto')], ['dark', t('theme_dark')], ['light', t('theme_light')]], c.theme || 'auto')}</select></div>
              <div class="field"><label>${esc(t('knob_theme'))}</label><select data-field="knob_theme">${opts(SKINS.map((k) => [k, t(`skin_${k}`)]), SKINS.includes(c.knob_theme) ? c.knob_theme : 'metal')}</select></div>
              <div class="field"><label>${esc(t('orientation'))}</label><select data-field="orientation">${opts([['midnight_top', t('o_midnight_top')], ['noon_top', t('o_noon_top')]], c.orientation === 'noon_top' ? 'noon_top' : 'midnight_top')}</select></div>
              <div class="field"><label>${esc(t('palette'))}</label><select data-field="palette">${opts([['default', t('pal_default')], ['theme', t('pal_theme')]], c.palette === 'theme' ? 'theme' : 'default')}</select></div>
              <div class="field"><label>${esc(t('snap'))}</label><select data-field="snap">${opts(SNAPS.map((s) => [String(s), `${s} ${t('min')}`]), SNAPS.includes(Number(c.snap)) ? String(c.snap) : '15')}</select></div>
            </div>
            <div class="switches">${sw('show_sun', t('show_sun'))}${sw('show_days', t('show_days'))}${sw('show_legend', t('show_legend'))}${sw('haptics', t('haptics'))}</div>
          </div>
          <div class="section">
            <div class="section-title">${esc(t('sec_layers', { n: c.layers.length }))}</div>
            ${layers}
            <button class="add" data-add ${c.layers.length >= 6 ? 'disabled' : ''}>${esc(t('add'))}</button>
            <div class="hint">${esc(t('layers_hint'))}</div>
          </div>
        </div>`;
      this._bind();
      this._syncValues();
    }

    _bind() {
      const root = this.shadowRoot;
      root.querySelectorAll('[data-field]').forEach((el) => {
        const key = el.getAttribute('data-field');
        if (el.type === 'checkbox') {
          el.addEventListener('change', () => this._set(key, el.checked ? undefined : false));
        } else if (el.tagName === 'SELECT') {
          el.addEventListener('change', () => {
            const v = el.value;
            if (v === SELECT_DEFAULTS[key]) this._set(key, undefined);
            else this._set(key, key === 'snap' ? Number(v) : v);
          });
        } else {
          let timer = null;
          const commit = () => { clearTimeout(timer); timer = null; this._set(key, el.value || undefined); };
          el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 250); });
          el.addEventListener('change', commit);
        }
      });
      root.querySelectorAll('[data-layer]').forEach((box) => {
        const i = Number(box.getAttribute('data-layer'));
        box.querySelectorAll('[data-lkey]').forEach((p) => {
          const key = p.getAttribute('data-lkey');
          p.hass = this._hass;
          if (key === 'entity') {
            p.label = this._t('entity');
            p.includeDomains = ['schedule', 'input_datetime', 'time', 'sensor', 'calendar'];
          } else p.label = this._t('icon');
          p.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            const v = ev.detail.value || undefined;
            if ((this._config.layers[i] || {})[key] === v) return;
            if (key === 'entity' && !v) return;
            this._setLayer(i, { [key]: v });
          });
        });
        box.querySelectorAll('[data-lfield]').forEach((inp) => {
          const key = inp.getAttribute('data-lfield');
          let timer = null;
          const commit = () => {
            clearTimeout(timer); timer = null;
            const v = inp.value.trim() || undefined;
            if ((this._config.layers[i] || {})[key] === v) return;
            this._setLayer(i, { [key]: v });
            const swc = box.querySelector('[data-swatch]');
            if (key === 'color' && swc && toHex(v)) swc.value = toHex(v);
          };
          inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 250); });
          inp.addEventListener('change', commit);
        });
        const swatch = box.querySelector('[data-swatch]');
        swatch.addEventListener('change', () => {
          box.querySelector('[data-lfield="color"]').value = swatch.value;
          this._setLayer(i, { color: swatch.value });
        });
        box.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
          const to = i + Number(b.getAttribute('data-move'));
          const arr = [...this._config.layers];
          if (to < 0 || to >= arr.length) return;
          [arr[i], arr[to]] = [arr[to], arr[i]];
          this._config.layers = arr;
          this._emit();
          this._render();
        }));
        box.querySelector('[data-del]').addEventListener('click', () => {
          if (this._config.layers.length <= 1) return;
          this._config.layers = this._config.layers.filter((_, k) => k !== i);
          this._emit();
          this._render();
        });
      });
      root.querySelector('[data-add]').addEventListener('click', () => {
        if (this._config.layers.length >= 6) return;
        const used = new Set(this._config.layers.map((l) => l.entity));
        const ids = this._hass ? Object.keys(this._hass.states) : [];
        const guess = ids.find((e) => /^(schedule|input_datetime|calendar)\./.test(e) && !used.has(e)) || 'schedule.nouveau';
        this._config.layers = [...this._config.layers, { entity: guess }];
        this._emit();
        this._render();
      });
    }

    _syncValues() {
      const root = this.shadowRoot;
      const focused = root.activeElement;
      const c = this._config;
      root.querySelectorAll('[data-field]').forEach((el) => {
        if (el === focused) return;
        const key = el.getAttribute('data-field');
        if (el.type === 'checkbox') el.checked = c[key] !== false;
        else if (el.tagName === 'SELECT') {
          const v = String(c[key] ?? SELECT_DEFAULTS[key]);
          if ([...el.options].some((o) => o.value === v)) el.value = v;
        } else if (el.value !== (c[key] || '')) el.value = c[key] || '';
      });
      root.querySelectorAll('[data-layer]').forEach((box) => {
        const l = c.layers[Number(box.getAttribute('data-layer'))] || {};
        box.querySelectorAll('[data-lkey]').forEach((p) => {
          const v = l[p.getAttribute('data-lkey')] || '';
          if (p.value !== v) p.value = v;
        });
        box.querySelectorAll('[data-lfield]').forEach((inp) => {
          if (inp === focused) return;
          const v = l[inp.getAttribute('data-lfield')] || '';
          if (inp.value !== v) inp.value = v;
        });
      });
    }
  }

  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, DayWheelCardEditor);
  if (!customElements.get(TAG)) customElements.define(TAG, DayWheelCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: 'Day Wheel Card',
    preview: true,
    description: tr(langOf(document.querySelector('home-assistant')?.hass), 'card_desc'),
    documentationURL: 'https://github.com/benshoesweb/day-wheel-card',
  });
})();
