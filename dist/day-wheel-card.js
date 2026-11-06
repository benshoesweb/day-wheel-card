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
 *                     Avec « target » (thermostat, volet, lumière), chaque plage porte aussi une valeur
 *                     (température, position, luminosité) réglée au centre avec − / +, rangée dans les
 *                     données de la plage (data) et appliquée par le blueprint day_wheel_schedule.yaml
 *   calendar.*        événements du jour — arcs en lecture seule
 * Autour : nuit (coucher → lever du soleil), aiguille de l'heure actuelle, jours de la semaine.
 * Noms des entités comme dans Home Assistant (hass.formatEntityName, sinon friendly_name).
 *
 * Options :
 *   layers            1 à 6 anneaux, de l'extérieur vers l'intérieur : entity, name, color, icon,
 *                     target (planning : climate.* / cover.* / light.* à piloter), min, max, step
 *   name              titre de la carte (en-tête standard de Home Assistant, comme les autres cartes)
 *   orientation       midnight_top (minuit en haut, défaut) | noon_top (midi en haut)
 *   snap              pas de réglage en minutes : 5 | 10 | 15 (défaut) | 30 | 60
 *   show_sun          true (défaut) : nuit grisée, lever et coucher du soleil
 *   show_days         true (défaut) : jours de la semaine (plannings et calendriers)
 *   show_legend       true (défaut) : légende des anneaux sous le cadran
 *   haptics           true (défaut) : retour haptique au doigt
 *   create_automation true (défaut) : un planning avec « target » reçoit automatiquement son automatisation
 *                     (blueprint day_wheel_schedule.yaml, installé par la carte) dès qu'on y règle une valeur ;
 *                     false : seulement avec le bouton « Créer l'automatisation » (éditeur, résumé)
 *   summary           true (défaut) : appui long sur le centre = résumé (semaine des plannings, valeurs,
 *                     heures, événements, réglages) dans une fenêtre aux couleurs du thème
 *   knob_theme        metal (défaut) | ha (cadran, anneaux, jour / nuit et centre aux couleurs du thème HA)
 *                     | glass | neumorph | brass | carbon | neon
 *   palette           default (défaut) : palette de la carte | theme : couleurs du thème HA
 *                     (principale, succès, avertissement, info, erreur, accent) pour les anneaux sans couleur
 *   theme             auto (défaut) | light | dark
 * Apparence de la carte (comme Radial Selector Card) :
 *   card_style        standard (défaut : fond + contour du thème) | border_only (contour sans fond)
 *                     | background_only (fond sans contour) | transparent (ni fond ni contour)
 *   card_background   couleur de fond (standard / background_only)
 *   card_border_color couleur du contour (standard / border_only)
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
  const CARD_STYLES_LIST = ['standard', 'border_only', 'background_only', 'transparent'];
  const KINDS = { schedule: 'schedule', input_datetime: 'marker', time: 'marker', sensor: 'marker', calendar: 'calendar' };
  const PALETTE = ['#ff8a65', '#4fc3f7', '#aed581', '#ffd54f', '#ba68c8', '#4db6ac'];
  // palette: theme — couleurs du thème Home Assistant (accent en dernier : il vaut souvent la couleur principale)
  const THEME_PALETTE = ['primary-color', 'success-color', 'warning-color', 'info-color', 'error-color', 'accent-color']
    .map((v, i) => `var(--${v}, ${PALETTE[i]})`);
  // Valeur de chaque plage d'un planning qui pilote un appareil (« target ») : rangée dans les données
  // de la plage (data), sous le nom du champ du service Home Assistant correspondant.
  // Home Assistant l'expose en attribut du planning pendant la plage ; le blueprint l'applique.
  const TARGETS = {
    climate: { key: 'temperature', unit: '°C', min: 7, max: 35, step: 0.5, def: 20, icon: 'mdi:thermostat' },
    cover: { key: 'position', unit: '%', min: 0, max: 100, step: 10, def: 100, icon: 'mdi:window-shutter' },
    light: { key: 'brightness_pct', unit: '%', min: 10, max: 100, step: 10, def: 100, icon: 'mdi:lightbulb-group' },
  };
  // Une automatisation par planning piloté : créée par la carte avec le blueprint fourni
  const BP_PATH = 'benshoesweb/day_wheel_schedule.yaml';
  const BP_URL = 'https://github.com/benshoesweb/day-wheel-card/blob/main/blueprints/day_wheel_schedule.yaml';
  const autoId = (schedule) => `day_wheel_${String(schedule).split('.')[1] || 'planning'}`;
  const isNotFound = (e) => !!e && (e.status_code === 404 || e.status === 404 || /not found|introuvable/i.test(String(e.error || e.message || (e.body && e.body.message) || '')));
  const usesBlueprint = (cfg) => !!(cfg && cfg.use_blueprint && /day_wheel_schedule\.yaml$/.test(String(cfg.use_blueprint.path || '')));
  const autoTargets = (cfg) => [].concat((cfg && cfg.use_blueprint && cfg.use_blueprint.input && cfg.use_blueprint.input.targets) || []);
  const autoEntity = (hass, id) => Object.keys((hass && hass.states) || {}).find((e) => e.startsWith('automation.') && hass.states[e].attributes && hass.states[e].attributes.id === id) || null;
  // Automatisation qui applique ce planning : la nôtre (identifiant fixe), sinon une automatisation
  // créée à la main avec le blueprint et qui utilise ce planning
  const findAutomation = async (hass, schedule) => {
    const id = autoId(schedule);
    try {
      const config = await hass.callApi('GET', `config/automation/config/${id}`);
      if (config) return { id, config, own: true };
    } catch (e) { if (!isNotFound(e)) throw e; }
    let rel = null;
    try { rel = await hass.callWS({ type: 'search/related', item_type: 'entity', item_id: schedule }); } catch (e) { rel = null; }
    for (const eid of [].concat((rel && rel.automation) || [])) {
      const st = hass.states[eid];
      const aid = st && st.attributes && st.attributes.id;
      if (!aid) continue;
      try {
        const config = await hass.callApi('GET', `config/automation/config/${aid}`);
        if (usesBlueprint(config)) return { id: aid, config, own: aid === id };
      } catch (e) { /* automatisation YAML : ignorée */ }
    }
    return null;
  };
  // Le blueprint est installé s'il manque (sans écraser celui déjà importé)
  const ensureBlueprint = async (hass) => {
    const list = (await hass.callWS({ type: 'blueprint/list', domain: 'automation' })) || {};
    const found = Object.entries(list).find(([p, v]) => p === BP_PATH || (v && v.metadata && v.metadata.source_url === BP_URL));
    if (found && found[1] && found[1].metadata && !found[1].error) return found[0];
    await hass.callWS({ type: 'blueprint/save', domain: 'automation', path: BP_PATH, yaml: BLUEPRINT_YAML, source_url: BP_URL, allow_override: !!found });
    return BP_PATH;
  };
  const saveAutomation = async (hass, { schedule, target, alias, description, base }) => {
    const id = base ? base.id : autoId(schedule);
    const path = base ? base.config.use_blueprint.path : await ensureBlueprint(hass);
    const config = base
      ? { ...base.config, use_blueprint: { ...base.config.use_blueprint, input: { ...base.config.use_blueprint.input, targets: [target] } } }
      : { alias, description, use_blueprint: { path, input: { schedule_entity: schedule, targets: [target] } } };
    delete config.id;
    await hass.callApi('POST', `config/automation/config/${id}`, config);
    return id;
  };
  // État de l'automatisation d'un anneau (planning + appareil piloté), pour la carte et l'éditeur
  const checkAuto = async (getHass, layer) => {
    const hass = getHass();
    const id = autoId(layer.entity);
    if (!(hass.user && hass.user.is_admin)) {
      // Sans droits d'administration : seulement ce que montrent les états
      const entity = autoEntity(hass, id);
      return entity ? { status: 'ok', id, own: true, entity } : { status: 'unknown' };
    }
    const f = await findAutomation(hass, layer.entity);
    if (!f) return { status: 'missing' };
    const entity = autoEntity(getHass(), f.id);
    // Enregistrée mais sans entité : Home Assistant ne la charge pas (automations.yaml non inclus)
    return { status: entity ? 'ok' : 'notloaded', id: f.id, own: f.own, base: f, targets: autoTargets(f.config), alias: f.config.alias || '', entity };
  };
  const createAuto = async (getHass, layer, L, base) => {
    const hass = getHass();
    const n = { s: layer.name || haEntityName(hass, layer.entity) || layer.entity, t: haEntityName(hass, layer.target) || layer.target };
    const alias = tr(L, 'a_name', n);
    const id = await saveAutomation(hass, { schedule: layer.entity, target: layer.target, alias, description: tr(L, 'a_desc', { s: n.s }), base });
    // Home Assistant recharge les automatisations : on attend l'entité (sinon automations.yaml n'est pas inclus)
    for (let k = 0; k < 30; k += 1) {
      const entity = autoEntity(getHass(), id);
      if (entity) {
        // Lancée une fois tout de suite : la valeur de la plage en cours est appliquée sans attendre le changement suivant
        try { await getHass().callService('automation', 'trigger', { entity_id: entity, skip_condition: true }); } catch (e) { /* elle s'appliquera au prochain changement */ }
        return { status: 'ok', id, own: true, entity, alias: base ? base.config.alias : alias, targets: [layer.target], created: !base };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { status: 'notloaded', id, alias };
  };
  // Ligne d'état affichée dans le résumé et l'éditeur
  const autoHtml = (hass, layer, info, L, canEdit) => {
    if (!info || info.status === 'unknown') return '';
    const btn = (act, label, li) => `<button class="a-btn" data-act="${act}" data-li="${li}">${esc(label)}</button>`;
    const li = info.li;
    let txt = '';
    let btns = '';
    if (info.status === 'checking') txt = tr(L, 'a_checking');
    else if (info.status === 'creating') txt = tr(L, 'a_creating');
    else if (info.status === 'missing') { txt = tr(L, 'a_missing'); if (canEdit) btns = btn('auto-create', tr(L, 'a_create'), li); }
    else if (info.status === 'error') { txt = `${tr(L, 'a_error')}${info.msg ? ` : ${info.msg}` : ''}`; if (canEdit) btns = btn('auto-create', tr(L, 'a_create'), li); }
    else if (info.status === 'notloaded') txt = tr(L, 'a_not_loaded');
    else {
      const st = info.entity && hass.states[info.entity];
      const alias = info.alias || (st && st.attributes && st.attributes.friendly_name) || info.id;
      txt = `${alias} · ${tr(L, st && st.state === 'off' ? 'a_off' : 'a_ok')}`;
      const tname = haEntityName(hass, layer.target) || layer.target;
      if (info.targets && !info.targets.includes(layer.target)) {
        txt += ` · ${tr(L, 'a_other', { n: info.targets.map((x) => haEntityName(hass, x) || x).join(', ') || '—', t: tname })}`;
        if (canEdit) btns += btn('auto-update', tr(L, 'a_update', { t: tname }), li);
      }
      if (canEdit) btns += btn('auto-open', tr(L, 'a_open'), li);
    }
    return `<div class="a-line${info.status === 'ok' ? ' ok' : ''}${['missing', 'error', 'notloaded'].includes(info.status) ? ' warn' : ''}"><ha-icon icon="mdi:robot-outline"></ha-icon><span><b>${esc(tr(L, 'automation'))}</b> : ${esc(txt)}</span>${btns ? `<span class="a-btns">${btns}</span>` : ''}</div>`;
  };
  const AUTO_STYLES = `
    .a-line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; font-size: 13px; margin-top: 8px; padding: 6px 8px; border-radius: 8px;
      background: color-mix(in srgb, currentColor 6%, transparent); }
    .a-line ha-icon { --mdc-icon-size: 18px; flex: none; opacity: .8; }
    .a-line > span:first-of-type { flex: 1 1 12em; min-width: 0; }
    .a-line.ok ha-icon { color: var(--success-color, #43a047); opacity: 1; }
    .a-line.warn ha-icon { color: var(--warning-color, #ffa600); opacity: 1; }
    .a-btns { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .a-btn { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 500;
      background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
    .a-btn:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  `;
  const LONG_PRESS_MS = 550;
  const VALUE_SAVE_MS = 600;
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
  // Couleur valide pour le navigateur (variables CSS comprises), sinon rien : le thème reprend la main
  const validColor = (v) => {
    const c = cssColor(v);
    if (!c) return '';
    try { return window.CSS && typeof CSS.supports === 'function' && !CSS.supports('color', c) ? '' : c; } catch (e) { return c; }
  };
  // « HH:MM:SS » -> minutes (24:00:00 -> 1440)
  const toMin = (s) => {
    const p = String(s ?? '').split(':').map(Number);
    if (!Number.isFinite(p[0])) return null;
    return clamp((p[0] || 0) * 60 + (p[1] || 0) + (p[2] || 0) / 60, 0, DAY);
  };
  const toHMS = (m) => (m >= DAY ? '24:00:00' : `${pad(m / 60)}:${pad(m % 60)}:00`);
  // Plage -> format de Home Assistant (données personnalisées conservées)
  const serBlock = (b) => ({ from: toHMS(b.s), to: toHMS(b.e), ...(b.data && typeof b.data === 'object' ? { data: b.data } : {}) });
  const num = (v, d) => { const n = Number(v); return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : d; };
  // Valeur affichée : « 21,5° » (court, sur l'anneau) ou « 21,5 °C », « 60 % »
  const fmtVal = (L, v, spec, short) => {
    const n = new Intl.NumberFormat(L === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(v);
    if (spec.key === 'temperature') return short ? `${n}°` : `${n} ${spec.unit}`;
    return short || L !== 'fr' ? `${n}%` : `${n}\u00a0%`;
  };
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
      target: 'Piloter (thermostat, volet ou lumière)',
      target_hint: 'Planning + « Piloter » : chaque plage reçoit une température, une position de volet ou une luminosité, réglée au centre avec − / +. Le blueprint Day Wheel l\'applique à l\'heure dite, même tableau de bord fermé. Pour plusieurs lumières, créez un groupe de lumières (Entrées › Groupe).',
      inc: 'Augmenter', dec: 'Diminuer', value: 'Valeur',
      sec_card: 'Apparence de la carte', card_style: 'Fond et contour',
      cs_standard: 'Fond + contour (thème HA, défaut)', cs_border_only: 'Contour sans fond', cs_background_only: 'Fond sans contour', cs_transparent: 'Transparente (ni fond ni contour)',
      card_background: 'Couleur du fond', card_border_color: 'Couleur du contour', clear: 'Effacer (couleur du thème)',
      summary: 'Résumé', summary_open: 'Résumé (appui long)', show_summary: 'Résumé par appui long sur le centre',
      k_schedule: 'Planning', k_marker: 'Heure', k_sensor: 'Horodatage', k_calendar: 'Calendrier',
      controls: 'pilote {n}', no_range: 'Aucune plage', no_event: 'Aucun événement', no_time: 'Pas d\'heure ce jour-là',
      events_of: 'Événements · {d}', settings: 'Réglages de la carte', s_snap: 'Pas de réglage', s_orientation: 'Orientation',
      s_style: 'Style du centre', s_palette: 'Couleurs des anneaux', s_theme: 'Thème', s_sun: 'Soleil', s_rights: 'Modification',
      r_admin: 'autorisée (administrateur)', r_read: 'lecture seule (réservée aux administrateurs)',
      sun_line: 'lever {a} · coucher {b}', week_total: '{t} sur la semaine',
      automation: 'Automatisation', a_name: 'Day Wheel · {s} → {t}', a_desc: 'Créée par Day Wheel Card : applique aux appareils les valeurs des plages du planning {s}. Modifiable ici (valeurs hors plages, appareils…).',
      a_ok: 'active', a_off: 'désactivée', a_missing: 'aucune : les valeurs ne s\'appliquent pas toutes seules', a_checking: 'vérification…',
      a_create: 'Créer l\'automatisation', a_creating: 'Création…', a_open: 'Ouvrir', a_update: 'Piloter {t}',
      a_other: 'pilote {n}, pas {t}', a_created: 'Automatisation créée : {n}', a_error: 'Automatisation non créée',
      a_not_loaded: 'Automatisation enregistrée mais pas chargée : ajoutez « automation: !include automations.yaml » à configuration.yaml',
      create_automation: 'Créer l\'automatisation du planning dès qu\'une valeur est réglée',
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
      target: 'Control (thermostat, cover or light)',
      target_hint: 'Schedule + "Control": each time range gets a temperature, a cover position or a brightness, set in the center with − / +. The Day Wheel blueprint applies it on time, even with the dashboard closed. For several lights, create a light group (Helpers › Group).',
      inc: 'Increase', dec: 'Decrease', value: 'Value',
      sec_card: 'Card appearance', card_style: 'Background and border',
      cs_standard: 'Background + border (HA theme, default)', cs_border_only: 'Border, no background', cs_background_only: 'Background, no border', cs_transparent: 'Transparent (no background, no border)',
      card_background: 'Background color', card_border_color: 'Border color', clear: 'Clear (theme color)',
      summary: 'Summary', summary_open: 'Summary (long press)', show_summary: 'Summary on long press of the center',
      k_schedule: 'Schedule', k_marker: 'Time', k_sensor: 'Timestamp', k_calendar: 'Calendar',
      controls: 'controls {n}', no_range: 'No time range', no_event: 'No event', no_time: 'No time that day',
      events_of: 'Events · {d}', settings: 'Card settings', s_snap: 'Adjust step', s_orientation: 'Orientation',
      s_style: 'Center style', s_palette: 'Ring colors', s_theme: 'Theme', s_sun: 'Sun', s_rights: 'Editing',
      r_admin: 'allowed (administrator)', r_read: 'read only (administrators only)',
      sun_line: 'sunrise {a} · sunset {b}', week_total: '{t} over the week',
      automation: 'Automation', a_name: 'Day Wheel · {s} → {t}', a_desc: 'Created by Day Wheel Card: applies the values of the {s} schedule\'s time ranges to the devices. Editable here (outside values, devices…).',
      a_ok: 'active', a_off: 'turned off', a_missing: 'none: values are not applied on their own', a_checking: 'checking…',
      a_create: 'Create the automation', a_creating: 'Creating…', a_open: 'Open', a_update: 'Control {t}',
      a_other: 'controls {n}, not {t}', a_created: 'Automation created: {n}', a_error: 'Automation not created',
      a_not_loaded: 'Automation saved but not loaded: add "automation: !include automations.yaml" to configuration.yaml',
      create_automation: 'Create the schedule\'s automation as soon as a value is set',
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
    .c-val { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .c-val b { font-size: clamp(14px, 5.2cqw, 22px); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 2.4em; }
    .c-val .c-btn { width: 28px; height: 28px; }
    .c-line .c-v { opacity: .8; font-variant-numeric: tabular-nums; }
    .arc-val { font-variant-numeric: tabular-nums; }

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
    .center.can-sum { cursor: pointer; -webkit-touch-callout: none; }
    .center:focus { outline: none; }
    .center:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 3px; }

    /* Résumé : fenêtre au premier plan (dialog), couleurs du thème HA ou du thème choisi */
    .dlg {
      --dlg-bg: var(--ha-dialog-surface-background, var(--card-background-color, #fff));
      --dlg-fg: var(--primary-text-color, #1c1f26);
      --dlg-muted: var(--secondary-text-color, #6b7280);
      --dlg-line: var(--divider-color, rgb(0 0 0 / .12));
      --dlg-soft: var(--secondary-background-color, rgb(127 127 127 / .1));
      --dlg-accent: var(--primary-color, #03a9f4);
      box-sizing: border-box; padding: 0; border: none; color: var(--dlg-fg); background: var(--dlg-bg);
      width: min(640px, calc(100vw - 32px)); max-width: none; max-height: min(86vh, 860px); max-height: min(86dvh, 860px);
      border-radius: var(--ha-dialog-border-radius, 24px); box-shadow: 0 12px 40px rgb(0 0 0 / .35);
      font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, inherit));
      overflow: hidden; flex-direction: column;
    }
    .dlg[open] { display: flex; }
    .dlg:focus { outline: none; }
    .dlg::backdrop { background: var(--dialog-backdrop-color, rgb(0 0 0 / .45)); }
    .wrap.forced-dark .dlg { --dlg-bg: #1c1f26; --dlg-fg: #eceff4; --dlg-muted: #a3a9b5; --dlg-line: rgb(255 255 255 / .12); --dlg-soft: rgb(255 255 255 / .06); }
    .wrap.forced-light .dlg { --dlg-bg: #fff; --dlg-fg: #1c1f26; --dlg-muted: #6b7280; --dlg-line: rgb(0 0 0 / .12); --dlg-soft: rgb(0 0 0 / .04); }
    .dlg-head { display: flex; align-items: center; gap: 12px; padding: 16px 12px 12px 22px; border-bottom: 1px solid var(--dlg-line); flex: none; }
    .dlg-head h2 { margin: 0; flex: 1; min-width: 0; font-size: 20px; font-weight: 500; line-height: 1.25; }
    .dlg-head h2 small { display: block; font-size: 13px; font-weight: 400; color: var(--dlg-muted); margin-top: 2px; }
    .dlg-x { all: unset; cursor: pointer; flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--dlg-fg); align-self: flex-start; }
    .dlg-x:hover { background: var(--dlg-soft); }
    .dlg-x:focus-visible { outline: 2px solid var(--dlg-accent); }
    .dlg-x ha-icon { --mdc-icon-size: 24px; }
    .dlg-body { overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 6px 22px 22px; flex: 1 1 auto; min-height: 0; }
    .sm-sec { padding: 14px 0; border-bottom: 1px solid var(--dlg-line); }
    .sm-sec:last-child { border-bottom: none; }
    .sm-h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .sm-h ha-icon { --mdc-icon-size: 20px; }
    .sm-h b { font-size: 15px; font-weight: 600; }
    .sm-kind { font-size: 12px; color: var(--dlg-muted); }
    .sm-day { display: grid; grid-template-columns: 6.2em 1fr auto; gap: 4px 10px; align-items: start; padding: 5px 8px; border-radius: 8px; font-size: 13px; }
    .sm-day.today { background: var(--dlg-soft); }
    .sm-day.today .sm-dn { color: var(--dlg-accent); font-weight: 600; }
    .sm-dn { padding-top: 2px; }
    .sm-chips { display: flex; flex-wrap: wrap; gap: 4px 6px; min-width: 0; }
    .sm-chip { display: inline-flex; gap: 6px; align-items: baseline; padding: 2px 8px; border-radius: 6px; white-space: nowrap; font-variant-numeric: tabular-nums;
      background: color-mix(in srgb, var(--c) 18%, transparent); border-left: 3px solid var(--c); }
    .sm-chip em { font-style: normal; font-weight: 600; }
    .sm-none { color: var(--dlg-muted); padding-top: 2px; }
    .sm-tot { color: var(--dlg-muted); font-variant-numeric: tabular-nums; padding-top: 2px; white-space: nowrap; }
    .sm-foot { font-size: 12px; color: var(--dlg-muted); margin-top: 6px; padding: 0 8px; }
    .sm-row { font-size: 14px; padding: 2px 8px; }
    .sm-row b { font-variant-numeric: tabular-nums; }
    .sm-set { display: grid; grid-template-columns: minmax(8em, auto) 1fr; gap: 6px 14px; margin: 0; font-size: 13px; padding: 0 8px; }
    .sm-set dt { color: var(--dlg-muted); }
    .sm-set dd { margin: 0; }
    /* Téléphone (ou écran bas) : plein écran, comme les fenêtres de Home Assistant */
    @media (max-width: 450px), (max-height: 500px) {
      .dlg { width: 100vw; height: 100vh; height: 100dvh; max-height: none; border-radius: 0; margin: 0; inset: 0;
        padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
      .dlg-head { padding-left: 16px; }
      .dlg-body { padding: 4px 16px 20px; }
      .sm-day { grid-template-columns: 4.6em 1fr auto; padding: 5px 4px; }
    }
    @media (prefers-reduced-motion: no-preference) {
      .dlg[open] { animation: dwc-pop .16s ease-out; }
      @keyframes dwc-pop { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }
    }
    @media (prefers-reduced-motion: reduce) { .arc { transition: none; } }
  ` + AUTO_STYLES;

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
      if (this._config) this._flushValue();
      this._cfgKey = key;
      this._config = { ...config, layers };
      this._sel = null;
      this._drag = null;
      this._ids = {};
      this._cal = {};
      this._autos = {};
      this._autoTried = {};
      this._autoProm = {};
      this._autoLock = {};
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
      this._flushValue();
      this._closeSummary();
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

    // Valeur pilotée par un planning (« target ») : nom, unité, bornes et pas, d'après l'appareil
    _spec(layer) {
      if (!layer || kindOf(layer.entity) !== 'schedule') return null;
      const target = typeof layer.target === 'string' ? layer.target.trim() : '';
      const domain = target.split('.')[0];
      const base = TARGETS[domain];
      if (!base || !target.split('.')[1]) return null;
      const st = this._hass && this._hass.states[target];
      const a = (st && st.attributes) || {};
      const spec = { ...base, target, domain };
      if (domain === 'climate') {
        const us = this._hass && this._hass.config && this._hass.config.unit_system;
        spec.unit = (us && us.temperature) || '°C';
        const f = /F/.test(spec.unit);
        spec.min = num(a.min_temp, f ? 45 : 7);
        spec.max = num(a.max_temp, f ? 95 : 35);
        spec.step = num(a.target_temp_step, f ? 1 : 0.5);
        spec.def = f ? 68 : 20;
      }
      ['min', 'max', 'step'].forEach((k) => { spec[k] = num(layer[k], spec[k]); });
      if (!(spec.step > 0)) spec.step = base.step;
      if (spec.max < spec.min) spec.max = spec.min;
      spec.def = clamp(spec.def, spec.min, spec.max);
      return spec;
    }

    _val(b, spec) {
      if (!b || !spec || !b.data || typeof b.data !== 'object') return null;
      return num(b.data[spec.key], null);
    }

    _stepVal(v, spec) { return clamp(r2(spec.min + Math.round((v - spec.min) / spec.step) * spec.step), spec.min, spec.max); }

    _icon(layer) {
      if (layer.icon) return layer.icon;
      const st = this._hass && this._hass.states[layer.entity];
      if (st && st.attributes && st.attributes.icon) return st.attributes.icon;
      const spec = this._spec(layer);
      if (spec) return spec.icon;
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

    // Apparence de la carte : réglée via les variables de ha-card (le thème HA reste la valeur par défaut)
    _cardStyle() {
      const c = this._config;
      const mode = CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'standard';
      const hasBg = mode === 'standard' || mode === 'background_only';
      const hasBorder = mode === 'standard' || mode === 'border_only';
      const v = [];
      if (!hasBg) v.push('--ha-card-background:transparent');
      else if (validColor(c.card_background)) v.push(`--ha-card-background:${validColor(c.card_background)}`);
      if (!hasBorder) v.push('--ha-card-border-width:0px');
      else if (validColor(c.card_border_color)) v.push(`--ha-card-border-color:${validColor(c.card_border_color)}`);
      if (mode !== 'standard') v.push('--ha-card-box-shadow:none');
      return v.join(';');
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
        <ha-card style="${esc(this._cardStyle())}"${c.name ? ` header="${esc(c.name)}"` : ''}>
          <div class="wrap skin-${this._skin()}">
            <div class="dial">
              <svg viewBox="0 0 400 400" role="img" aria-label="" tabindex="0">
                <g class="g-face"></g><g class="g-rings"></g><g class="g-top"></g>
              </svg>
              <div class="center" aria-live="polite"></div>
            </div>
            <div class="days" role="tablist"></div>
            <div class="legend"></div>
            <dialog class="dlg" tabindex="-1" aria-labelledby="dwc-sum-${this._uid}">
              <div class="dlg-head"><h2 id="dwc-sum-${this._uid}"></h2>
                <button class="dlg-x" data-act="close-summary"><ha-icon icon="mdi:close"></ha-icon></button></div>
              <div class="dlg-body"></div>
            </dialog>
          </div>
        </ha-card>`;
      const root = this.shadowRoot;
      this._root = root;
      this._summaryOpenState = false;
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
      // Résumé : appui long sur le centre (ou Entrée quand le centre a le focus)
      this._dlg = root.querySelector('.dlg');
      this._dlgTitle = root.querySelector('.dlg-head h2');
      this._dlgBody = root.querySelector('.dlg-body');
      const stopHold = () => { clearTimeout(this._holdTimer); this._holdTimer = null; };
      this._center.addEventListener('pointerdown', (e) => {
        if (!this._summaryOn() || e.target.closest('[data-act]') || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (e.pointerType === 'touch') this._lastFinger = Date.now();
        stopHold();
        this._holdAt = { x: e.clientX, y: e.clientY };
        this._holdTimer = setTimeout(() => { this._holdTimer = null; this._haptic('medium'); this._openSummary(); }, LONG_PRESS_MS);
      });
      this._center.addEventListener('pointermove', (e) => {
        if (this._holdTimer && Math.hypot(e.clientX - this._holdAt.x, e.clientY - this._holdAt.y) > 8) stopHold();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => this._center.addEventListener(ev, stopHold));
      this._center.addEventListener('contextmenu', (e) => { if (this._summaryOn()) e.preventDefault(); });
      this._center.addEventListener('keydown', (e) => {
        if (e.target !== this._center || !this._summaryOn() || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        this._openSummary(true);
      });
      this._dlg.addEventListener('click', (e) => {
        // Croix, ou clic sur le fond (hors de la fenêtre)
        if (e.target.closest('[data-act="close-summary"]')) { this._closeSummary(); return; }
        const ab = e.target.closest('[data-act^="auto-"]');
        if (ab) { this._autoAction(ab.getAttribute('data-act'), Number(ab.getAttribute('data-li'))); return; }
        if (e.target === this._dlg && Date.now() - this._dlgOpenedAt > 400) {
          const r = this._dlg.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this._closeSummary();
        }
      });
      this._dlg.addEventListener('close', () => {
        this._summaryOpenState = false;
        try { this._svg.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      });
      // Les gestes dans la fenêtre ne concernent pas le cadran
      ['keydown', 'pointerdown'].forEach((ev) => this._dlg.addEventListener(ev, (e) => e.stopPropagation()));
      this._center.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.getAttribute('data-act');
        if (act === 'delete') this._deleteSel();
        if (act === 'inc' || act === 'dec') this._adjust(act === 'inc' ? 1 : -1);
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
        if (['ArrowUp', 'ArrowDown', '+', '-'].includes(e.key) && this._spec(this._layers()[this._sel.li])) {
          e.preventDefault();
          this._adjust(e.key === 'ArrowUp' || e.key === '+' ? 1 : -1);
        }
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
        const spec = this._spec(layer);
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
            const v = this._val(b, spec);
            const vt = v == null ? '' : ` · ${fmtVal(L, v, spec)}`;
            rings += `<path class="${cls}" data-li="${li}" data-i="${i}" d="${arcPath(R.r, m0, Math.max(m1, m0 + 0.01), rot)}" stroke-width="${R.w}" style="stroke:${col};--dwc-glow:${col}"><title>${esc(title + hhmm(b.s))} – ${esc(hhmm(b.e))}${esc(vt)}</title></path>`;
            if (v != null) {
              // Valeur écrite sur la plage, si elle y tient
              const label = fmtVal(L, v, spec, true);
              const fs = r2(Math.min(10, R.w * 0.5));
              const room = (2 * Math.PI * R.r * (b.e - b.s)) / DAY - R.w * 0.6;
              if (fs >= 6.5 && room >= label.length * fs * 0.62 + 2) {
                // Écrite le long de l'anneau, jamais à l'envers
                const am = angleOf((b.s + b.e) / 2, rot);
                const [tx, ty] = pt(R.r, am);
                let ta = (((am + 90) % 360) + 360) % 360;
                if (ta > 90 && ta < 270) ta -= 180;
                rings += `<text class="label-ring arc-val" data-li="${li}" data-i="${i}" x="${tx}" y="${ty}" transform="rotate(${r2(ta)} ${tx} ${ty})" style="font-size:${fs}px">${esc(label)}</text>`;
              }
            }
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
      this._wrap.classList.toggle('forced-dark', c.theme === 'dark');
      this._wrap.classList.toggle('forced-light', c.theme === 'light');
      const sum = this._summaryOn();
      this._center.classList.toggle('can-sum', sum);
      if (sum) {
        this._center.setAttribute('tabindex', '0');
        this._center.setAttribute('role', 'button');
        this._center.setAttribute('aria-label', tr(L, 'summary_open'));
      } else ['tabindex', 'role', 'aria-label'].forEach((a) => this._center.removeAttribute(a));
      if (this._summaryOpenState) this._renderSummary(shown, L);
    }

    // ---------- Résumé (appui long sur le centre) ----------
    _summaryOn() { return !!this._config && this._config.summary !== false; }

    // Ouvert au clavier : focus sur la croix ; au doigt / à la souris : sur la fenêtre (pas d'anneau de focus)
    _openSummary(keyboard) {
      if (!this._dlg || !this._summaryOn()) return;
      this._summaryOpenState = true;
      this._sumHtml = null;
      this._layers().forEach((l, li) => { if (this._spec(l)) this._checkAuto(li, true); });
      this._renderSummary(this._shown(), langOf(this._hass));
      this._dlgOpenedAt = Date.now();
      try { if (!this._dlg.open) this._dlg.showModal(); } catch (e) { this._dlg.setAttribute('open', ''); }
      this._dlgBody.scrollTop = 0;
      try { (keyboard ? this._dlg.querySelector('.dlg-x') : this._dlg).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    _closeSummary() {
      this._summaryOpenState = false;
      if (this._dlg && this._dlg.open) { try { this._dlg.close(); } catch (e) { this._dlg.removeAttribute('open'); } }
    }

    // ---------- Automatisation du planning (une par planning piloté) ----------
    _autoKey(layer) { return `${layer.entity}|${layer.target}`; }

    _autoInfo(li) {
      const layer = this._layers()[li];
      const info = this._autos && this._autos[this._autoKey(layer)];
      return info ? { ...info, li } : null;
    }

    _setAuto(layer, info) {
      this._autos = this._autos || {};
      this._autos[this._autoKey(layer)] = info;
      if (this._summaryOpenState) this._render();
    }

    async _checkAuto(li, force) {
      const layer = this._layers()[li];
      if (!this._spec(layer) || !this._hass) return null;
      const key = this._autoKey(layer);
      this._autoProm = this._autoProm || {};
      if (this._autoProm[key]) return this._autoProm[key];   // vérification déjà en cours
      const cur = this._autos && this._autos[key];
      if (cur && !force && cur.status !== 'error') return cur;
      this._setAuto(layer, { status: 'checking' });
      const run = (async () => {
        let info;
        try { info = await checkAuto(() => this._hass, layer); } catch (e) { info = { status: 'error', msg: (e && (e.message || e.error)) || '' }; }
        delete this._autoProm[key];
        this._setAuto(layer, info);
        return info;
      })();
      this._autoProm[key] = run;
      return run;
    }

    // Après une valeur enregistrée : automatisation créée si elle manque (une fois)
    async _autoEnsure(li) {
      if (!this._canEdit()) return;
      const layer = this._layers()[li];
      const key = this._autoKey(layer);
      this._autoTried = this._autoTried || {};
      if (this._autoTried[key]) return;
      this._autoTried[key] = true;
      const info = await this._checkAuto(li, false);
      if (info && info.status === 'missing') await this._autoAction('auto-create', li);
    }

    // Une action à la fois par planning : deux demandes simultanées ne créent jamais deux automatisations
    _autoAction(act, li) {
      const layer = this._layers()[li];
      if (!layer || !this._spec(layer)) return Promise.resolve();
      if (act === 'auto-open') return this._autoDo(act, li);   // navigation immédiate
      const key = this._autoKey(layer);
      this._autoLock = this._autoLock || {};
      const run = (this._autoLock[key] || Promise.resolve()).then(() => this._autoDo(act, li));
      this._autoLock[key] = run.catch(() => {});
      return run;
    }

    async _autoDo(act, li) {
      const layer = this._layers()[li];
      if (!layer || !this._spec(layer)) return;
      const L = langOf(this._hass);
      const info = this._autoInfo(li) || {};
      if (act === 'auto-open') {
        if (!info.id) return;
        this._closeSummary();
        history.pushState(null, '', `/config/automation/edit/${encodeURIComponent(info.id)}`);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
        return;
      }
      if (!this._canEdit()) return;
      if (act === 'auto-update' && !(info.base && info.own)) return;
      this._setAuto(layer, { status: 'creating' });
      try {
        // Jamais de doublon : on revérifie juste avant d'écrire
        const again = act === 'auto-create' ? await findAutomation(this._hass, layer.entity) : null;
        const res = again ? { ...(await checkAuto(() => this._hass, layer)), created: false }
          : await createAuto(() => this._hass, layer, L, act === 'auto-update' ? info.base : null);
        this._setAuto(layer, res.status === 'ok' && act === 'auto-update' ? await checkAuto(() => this._hass, layer) : res);
        if (res.created) this._flash(tr(L, 'a_created', { n: res.alias }));
        else if (res.status === 'notloaded') this._flash(tr(L, 'a_not_loaded'), true);
      } catch (e) {
        this._setAuto(layer, { status: 'error', msg: (e && (e.message || e.error)) || '' });
        this._flash(tr(L, 'a_error'), true);
      }
    }

    _renderSummary(shown, L) {
      const c = this._config;
      const names = tr(L, 'days');
      const loc = L === 'fr' ? 'fr-FR' : 'en-US';
      const dayLabel = (d) => names[d];
      let longDate = '';
      try {
        const [y, m, d] = shown.ymd.split('-').map(Number);
        longDate = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
      } catch (e) { longDate = dayLabel(shown.day); }
      const secs = this._layers().map((layer, li) => {
        const kind = kindOf(layer.entity);
        const col = this._color(layer, li);
        const domain = layer.entity.split('.')[0];
        const kindName = kind === 'schedule' ? tr(L, 'k_schedule') : kind === 'calendar' ? tr(L, 'k_calendar')
          : (domain === 'sensor' ? tr(L, 'k_sensor') : tr(L, 'k_marker'));
        const spec = this._spec(layer);
        const sub = spec ? `${kindName} · ${tr(L, 'controls', { n: haEntityName(this._hass, spec.target) || spec.target })}` : kindName;
        let body = '';
        if (kind === 'schedule') {
          const it = this._item(layer.entity);
          if (!it) body = `<div class="sm-row sm-none">${esc(tr(L, 'not_found'))}</div>`;
          else {
            let week = 0;
            body = DAY_KEYS.map((k, d) => {
              const blocks = [].concat(it[k] || []).map((b) => ({ s: toMin(b.from), e: toMin(b.to), data: b.data }))
                .filter((b) => b.s != null && b.e != null && b.e > b.s).sort((a, b) => a.s - b.s);
              const tot = blocks.reduce((n, b) => n + b.e - b.s, 0);
              week += tot;
              const chips = blocks.map((b) => {
                const v = this._val(b, spec);
                return `<span class="sm-chip">${esc(hhmm(b.s))}–${esc(hhmm(b.e))}${v == null ? '' : `<em>${esc(fmtVal(L, v, spec))}</em>`}</span>`;
              }).join('');
              return `<div class="sm-day${d === shown.now.day ? ' today' : ''}" data-day="${d}"><span class="sm-dn">${esc(dayLabel(d))}</span>
                <div class="sm-chips">${chips || `<span class="sm-none">${esc(tr(L, 'no_range'))}</span>`}</div><span class="sm-tot">${tot ? esc(dur(tot, L)) : ''}</span></div>`;
            }).join('') + (week ? `<div class="sm-foot">${esc(tr(L, 'week_total', { t: dur(week, L) }))}</div>` : '');
          }
          if (spec) body += autoHtml(this._hass, layer, this._autoInfo(li), L, this._canEdit());
        } else if (kind === 'calendar') {
          const ev = (this._cal[layer.entity] && this._cal[layer.entity].events) || [];
          body = `<div class="sm-foot" style="margin:0 0 4px">${esc(tr(L, 'events_of', { d: longDate }))}</div>`
            + (ev.length ? `<div class="sm-chips" style="padding:0 8px">${ev.map((x) => `<span class="sm-chip">${esc(hhmm(x.s))}–${esc(hhmm(x.e))}<em>${esc(x.title)}</em></span>`).join('')}</div>`
              : `<div class="sm-row sm-none">${esc(tr(L, 'no_event'))}</div>`);
        } else if (kind === 'marker') {
          const st = this._hass.states[layer.entity];
          const mk = this._markerTime(layer, shown);
          let txt = '';
          if (domain === 'sensor' || (domain === 'input_datetime' && st && st.attributes && st.attributes.has_date)) {
            const d = st && new Date(String(st.state).replace(' ', 'T'));
            if (d && !Number.isNaN(d.getTime())) {
              try {
                txt = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: domain === 'sensor' ? this._tz() : 'UTC' })
                  .format(domain === 'sensor' ? d : new Date(`${String(st.state).replace(' ', 'T')}Z`));
              } catch (e) { txt = st.state; }
            }
          } else if (mk) txt = hhmm(mk.m);
          body = txt ? `<div class="sm-row"><b>${esc(txt)}</b></div>` : `<div class="sm-row sm-none">${esc(tr(L, 'no_time'))}</div>`;
        } else body = `<div class="sm-row sm-none">${esc(tr(L, 'unsupported'))}</div>`;
        return `<section class="sm-sec" style="--c:${col}"><div class="sm-h"><ha-icon icon="${esc(this._icon(layer))}" style="color:${col}"></ha-icon><b>${esc(this._name(layer))}</b><span class="sm-kind">${esc(sub)}</span></div>${body}</section>`;
      }).join('');
      // Réglages de la carte
      const sun = c.show_sun !== false ? this._sun(shown) : null;
      const set = [
        [tr(L, 's_snap'), `${this._snap()} ${tr(L, 'min')}`],
        [tr(L, 's_orientation'), tr(L, this._rot() ? 'o_noon_top' : 'o_midnight_top')],
        [tr(L, 's_style'), tr(L, `skin_${this._skin()}`)],
        [tr(L, 's_palette'), tr(L, c.palette === 'theme' ? 'pal_theme' : 'pal_default')],
        [tr(L, 's_theme'), tr(L, c.theme === 'dark' ? 'theme_dark' : c.theme === 'light' ? 'theme_light' : 'theme_auto')],
        ...(sun ? [[tr(L, 's_sun'), tr(L, 'sun_line', { a: hhmm(sun.rise), b: hhmm(sun.set) })]] : []),
        ...(this._hasKind('schedule') ? [[tr(L, 's_rights'), tr(L, this._canEdit() ? 'r_admin' : 'r_read')]] : []),
      ];
      const html = `${secs}<section class="sm-sec"><div class="sm-h"><ha-icon icon="mdi:cog-outline"></ha-icon><b>${esc(tr(L, 'settings'))}</b></div>
        <dl class="sm-set">${set.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`;
      const title = `${esc(tr(L, 'summary'))}<small>${esc(c.name ? `${c.name} · ${longDate}` : longDate)}</small>`;
      if (this._dlgTitle.innerHTML !== title) this._dlgTitle.innerHTML = title;
      const x = this._dlg.querySelector('.dlg-x');
      x.setAttribute('aria-label', tr(L, 'close'));
      x.setAttribute('title', tr(L, 'close'));
      if (this._sumHtml !== html) { this._sumHtml = html; this._dlgBody.innerHTML = html; }
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
          const spec = this._spec(layer);
          const vOf = (b) => { const v = this._val(b, spec); return v == null ? '' : fmtVal(L, v, spec, true); };
          if (cur) { const val = vOf(cur); out.push({ col, name, icon: this._icon(layer), time: `→ ${hhmm(cur.e)}`, val, text: `${name} · ${val ? `${val} · ` : ''}${tr(L, 'until', { t: hhmm(cur.e) })}`, on: true }); }
          else if (next) { const val = vOf(next); out.push({ col, name, icon: this._icon(layer), time: hhmm(next.s), val, text: `${name} · ${tr(L, 'at', { t: hhmm(next.s) })}${val ? ` · ${val}` : ''}` }); }
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
          const spec = this._spec(layer);
          const v = this._val(b, spec);
          html = `<div class="c-day">${esc(this._name(layer))}</div><div class="c-big">${esc(hhmm(b.s))}<br>${esc(hhmm(b.e))}</div><div class="c-hint">${esc(dur(b.e - b.s, L))}${v == null ? '' : ` · ${esc(fmtVal(L, v, spec))}`}</div>`;
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
        const spec = isSched ? this._spec(layer) : null;
        let val = '';
        let hint = `${dur(b.e - b.s, L)}${isSched ? ` · ${can ? tr(L, 'hint_edit') : tr(L, 'admin_only')}` : ''}`;
        if (spec) {
          // Valeur de la plage (température, position, luminosité), réglée avec − / +
          const v = this._val(b, spec);
          const shownVal = v == null ? '—' : fmtVal(L, v, spec);
          const btn = (act, icon, label, off) => `<button class="c-btn" data-act="${act}" title="${esc(label)}" aria-label="${esc(label)}"${off ? ' disabled' : ''}><ha-icon icon="${icon}"></ha-icon></button>`;
          val = `<div class="c-val">${can ? btn('dec', 'mdi:minus', tr(L, 'dec'), v != null && v <= spec.min) : ''}<b aria-label="${esc(tr(L, 'value'))}">${esc(shownVal)}</b>${can ? btn('inc', 'mdi:plus', tr(L, 'inc'), v != null && v >= spec.max) : ''}</div>`;
          hint = can || this._geom().compact ? dur(b.e - b.s, L) : `${dur(b.e - b.s, L)} · ${tr(L, 'admin_only')}`;
        }
        html = `<div class="c-day">${esc(title)}</div>
          <div class="c-big" style="font-size:clamp(13px,5.4cqw,22px);white-space:nowrap">${esc(hhmm(b.s))} – ${esc(hhmm(b.e))}</div>
          ${val}
          <div class="c-hint">${esc(hint)}</div>
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
          ${compact ? '' : `<div class="c-lines">${lines.length ? lines.map((l) => `<div class="c-line${l.on ? ' on' : ''}" title="${esc(l.text)}"><ha-icon icon="${esc(l.icon)}" style="color:${l.col}"></ha-icon><b>${esc(l.time)}</b>${l.val ? `<span class="c-v">${esc(l.val)}</span>` : ''}</div>`).join('') : `<div class="c-line">${esc(tr(L, 'nothing'))}</div>`}</div>`}`;
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
      const created = { s, e };
      const spec = this._spec(layer);
      if (spec) {
        // Valeur de départ : celle de la plage voisine, sinon la valeur par défaut
        const near = [prev, next].map((b) => this._val(b, spec)).find((v) => v != null);
        created.data = { [spec.key]: near ?? spec.def };
      }
      const nb = [...blocks.map((b) => ({ ...b })), created].sort((a, b) => a.s - b.s);
      this._sel = { li, i: nb.findIndex((b) => b.s === s) };
      this._haptic('medium');
      this._save(li, nb);
      void p;
    }

    // − / + : valeur de la plage choisie, affichée aussitôt et enregistrée après une courte pause
    _adjust(dir) {
      const sel = this._sel;
      if (!sel || !this._canEdit()) return;
      const layer = this._layers()[sel.li];
      const spec = this._spec(layer);
      const it = spec && this._item(layer.entity);
      if (!it) return;
      const blocks = (this._blocks(layer, this._shown()) || []).map((b) => ({ ...b }));
      const b = blocks[sel.i];
      if (!b) return;
      const cur = this._val(b, spec);
      const v = cur == null ? spec.def : this._stepVal(cur + dir * spec.step, spec);
      if (v === cur) return;
      b.data = { ...(b.data && typeof b.data === 'object' ? b.data : {}), [spec.key]: v };
      this._haptic('selection');
      const day = this._shown().day;
      // Une valeur encore en attente sur ce planning est remplacée (le nouvel envoi la contient) ;
      // sur un autre planning, elle part tout de suite
      const same = this._valPending && this._valPending.li === sel.li;
      const before = same ? this._valPending.before : it;
      if (same) { clearTimeout(this._valPending.timer); this._valPending = null; } else this._flushValue();
      this._items.set(it.id, { ...it, [DAY_KEYS[day]]: blocks.map(serBlock) });
      const pending = { li: sel.li, before, run: () => this._save(sel.li, blocks, before, day) };
      pending.timer = setTimeout(() => { if (this._valPending === pending) { this._valPending = null; pending.run(); } }, VALUE_SAVE_MS);
      this._valPending = pending;
      this._render();
    }

    // Enregistre tout de suite une valeur en attente (avant toute autre modification)
    _flushValue() {
      const p = this._valPending;
      if (!p) return;
      this._valPending = null;
      clearTimeout(p.timer);
      p.run();
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

    async _save(li, blocks, original, day) {
      this._flushValue();
      const layer = this._layers()[li];
      const it = this._item(layer.entity);
      if (!it || !this._canEdit()) return;
      const dayKey = DAY_KEYS[day == null ? this._shown().day : day];
      const ser = serBlock;
      const msg = { type: 'schedule/update', schedule_id: it.id, name: it.name };
      if (it.icon) msg.icon = it.icon;
      DAY_KEYS.forEach((k) => {
        msg[k] = k === dayKey ? blocks.map(ser) : [].concat(it[k] || []).map((b) => ({ from: b.from, to: b.to, ...(b.data ? { data: b.data } : {}) }));
      });
      // Affichage immédiat, rétabli si Home Assistant refuse
      const before = original || it;
      const after = { ...it, [dayKey]: blocks.map(ser) };
      this._items.set(it.id, after);
      this._saving = true;
      this._status = { text: this._t('saving') };
      this._render();
      try {
        const res = await this._hass.callWS(msg);
        if (res && res.id) this._items.set(res.id, res);
        this._status = null;
        if (this._spec(layer) && this._config.create_automation !== false) this._autoEnsure(li);
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
    .auto:empty { display: none; }
    .auto .a-line { color: var(--primary-text-color); }
  ` + AUTO_STYLES;
  const DEFAULT_TRUE = ['show_sun', 'show_days', 'show_legend', 'haptics', 'summary', 'create_automation'];
  const SELECT_DEFAULTS = { theme: 'auto', knob_theme: 'metal', orientation: 'midnight_top', snap: '15', palette: 'default', card_style: 'standard' };
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
      this._config.layers.forEach((_, i) => this._autoPaint(i));
    }

    _signature() { return JSON.stringify([langOf(this._hass), this._config.layers.map((l) => kindOf(l.entity)), this._config.palette === 'theme', this._cardMode()]); }

    _cardMode() { return CARD_STYLES_LIST.includes(this._config.card_style) ? this._config.card_style : 'standard'; }

    // Couleur : nuancier + texte (toute couleur CSS) + effacer (= couleur du thème)
    _colorField(key, label, def) {
      const v = this._config[key] || '';
      return `<div class="field"><label>${esc(label)}</label><div class="color-row">
        <input type="color" data-gswatch="${key}" value="${esc(toHex(v) || def)}">
        <input type="text" data-field="${key}" value="${esc(v)}" placeholder="${esc(this._t('theme_ha'))}">
        <button type="button" class="mini" data-gclear="${key}" title="${esc(this._t('clear'))}" aria-label="${esc(this._t('clear'))}">✕</button></div></div>`;
    }

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
            ${kindOf(l.entity) === 'schedule' ? '<div class="field"><ha-entity-picker data-lkey="target"></ha-entity-picker></div>' : ''}
          </div>
          ${kindOf(l.entity) === 'schedule' ? `<div class="auto" data-auto="${i}"></div>` : ''}
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
            <div class="switches">${sw('show_sun', t('show_sun'))}${sw('show_days', t('show_days'))}${sw('show_legend', t('show_legend'))}${sw('haptics', t('haptics'))}${sw('summary', t('show_summary'))}${sw('create_automation', t('create_automation'))}</div>
          </div>
          <div class="section">
            <div class="section-title">${esc(t('sec_card'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('card_style'))}</label><select data-field="card_style">${opts(CARD_STYLES_LIST.map((k) => [k, t(`cs_${k}`)]), this._cardMode())}</select></div>
              ${['standard', 'background_only'].includes(this._cardMode()) ? this._colorField('card_background', t('card_background'), '#1c1f26') : ''}
              ${['standard', 'border_only'].includes(this._cardMode()) ? this._colorField('card_border_color', t('card_border_color'), '#5e6472') : ''}
            </div>
          </div>
          <div class="section">
            <div class="section-title">${esc(t('sec_layers', { n: c.layers.length }))}</div>
            ${layers}
            <button class="add" data-add ${c.layers.length >= 6 ? 'disabled' : ''}>${esc(t('add'))}</button>
            <div class="hint">${esc(t('layers_hint'))}</div>
            <div class="hint">${esc(t('target_hint'))}</div>
          </div>
        </div>`;
      this._bind();
      this._syncValues();
      this._config.layers.forEach((_, i) => this._autoRefresh(i));
    }

    // ---------- Automatisation de chaque planning piloté ----------
    _autoTarget(i) {
      const l = this._config.layers[i];
      return l && kindOf(l.entity) === 'schedule' && typeof l.target === 'string' && TARGETS[l.target.split('.')[0]] ? l : null;
    }

    _autoPaint(i) {
      const box = this.shadowRoot.querySelector(`[data-auto="${i}"]`);
      if (!box) return;
      const l = this._autoTarget(i);
      const info = l && this._autos && this._autos[`${l.entity}|${l.target}`];
      const html = l && info && this._hass ? autoHtml(this._hass, l, { ...info, li: i }, langOf(this._hass), true) : '';
      if (box.innerHTML !== html) box.innerHTML = html;
    }

    async _autoRefresh(i, force) {
      const l = this._autoTarget(i);
      if (!l || !this._hass || !this._hass.user || !this._hass.user.is_admin || typeof this._hass.callApi !== 'function') { this._autoPaint(i); return; }
      const key = `${l.entity}|${l.target}`;
      this._autos = this._autos || {};
      if (this._autos[key] && !force && !['error'].includes(this._autos[key].status)) { this._autoPaint(i); return; }
      this._autos[key] = { status: 'checking' };
      this._autoPaint(i);
      let info;
      try { info = await checkAuto(() => this._hass, l); } catch (e) { info = { status: 'error', msg: (e && (e.message || e.error)) || '' }; }
      this._autos[key] = info;
      this._config.layers.forEach((_, k) => this._autoPaint(k));
    }

    async _autoClick(act, i) {
      const l = this._autoTarget(i);
      if (!l) return;
      const key = `${l.entity}|${l.target}`;
      const info = (this._autos && this._autos[key]) || {};
      if (act === 'auto-open') {
        // Nouvel onglet : la configuration de la carte en cours d'édition n'est pas perdue
        if (info.id) window.open(`/config/automation/edit/${encodeURIComponent(info.id)}`, '_blank', 'noopener');
        return;
      }
      if (act === 'auto-update' && !(info.base && info.own)) return;
      this._autos[key] = { status: 'creating' };
      this._autoPaint(i);
      try {
        const again = act === 'auto-create' ? await findAutomation(this._hass, l.entity) : null;
        if (!again) await createAuto(() => this._hass, l, langOf(this._hass), act === 'auto-update' ? info.base : null);
        await this._autoRefresh(i, true);
      } catch (e) {
        this._autos[key] = { status: 'error', msg: (e && (e.message || e.error)) || '' };
        this._autoPaint(i);
      }
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
      root.querySelectorAll('[data-gswatch]').forEach((sw) => sw.addEventListener('change', () => {
        const key = sw.getAttribute('data-gswatch');
        const txt = root.querySelector(`[data-field="${key}"]`);
        if (txt) txt.value = sw.value;
        this._set(key, sw.value);
      }));
      root.querySelectorAll('[data-gclear]').forEach((b) => b.addEventListener('click', () => {
        const key = b.getAttribute('data-gclear');
        const txt = root.querySelector(`[data-field="${key}"]`);
        if (txt) txt.value = '';
        this._set(key, undefined);
      }));
      root.querySelectorAll('[data-layer]').forEach((box) => {
        const i = Number(box.getAttribute('data-layer'));
        box.querySelectorAll('[data-lkey]').forEach((p) => {
          const key = p.getAttribute('data-lkey');
          p.hass = this._hass;
          if (key === 'entity') {
            p.label = this._t('entity');
            p.includeDomains = ['schedule', 'input_datetime', 'time', 'sensor', 'calendar'];
          } else if (key === 'target') {
            p.label = this._t('target');
            p.includeDomains = Object.keys(TARGETS);
          } else p.label = this._t('icon');
          p.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            const v = ev.detail.value || undefined;
            if ((this._config.layers[i] || {})[key] === v) return;
            if (key === 'entity' && !v) return;
            // « Piloter » n'existe que pour un planning
            const patch = key === 'entity' && kindOf(v) !== 'schedule' ? { entity: v, target: undefined } : { [key]: v };
            this._setLayer(i, patch);
            if (this._signature() !== this._sig) this._render();
            else if (key === 'target' || key === 'entity') this._autoRefresh(i);
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
        const autoBox = box.querySelector('[data-auto]');
        if (autoBox) autoBox.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-act^="auto-"]');
          if (b) this._autoClick(b.getAttribute('data-act'), i);
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

  // Blueprint installé par la carte (copie de blueprints/day_wheel_schedule.yaml : node scripts/sync-blueprint.js)
  // <blueprint>
  const BLUEPRINT_YAML = `blueprint:
  name: Day Wheel – planning du chauffage, des volets et des lumières
  author: benshoesweb
  description: >-
    Applique aux appareils les valeurs réglées sur les plages d'un planning dans Day Wheel Card
    (option « Piloter ») : la température des thermostats, la position des volets roulants,
    la luminosité des lumières. Au début de chaque plage, la valeur de la plage est envoyée ;
    hors des plages, la valeur « hors plages » (ou l'extinction) est appliquée. Une valeur modifiée
    pendant une plage en cours est appliquée aussitôt, et tout est rétabli au redémarrage de
    Home Assistant. Pour piloter plusieurs lumières ensemble, créez un groupe de lumières
    (Paramètres › Appareils et services › Entrées › Groupe).


    Applies the values set on a schedule's time ranges in Day Wheel Card ("Control" option)
    to your devices: thermostat temperature, cover position, light brightness. At the start of
    each range its value is sent; outside the ranges, the "outside" value (or turning off)
    applies. A value changed during the current range applies right away, and everything is
    restored when Home Assistant restarts. To control several lights together, create a light
    group (Settings › Devices & services › Helpers › Group).
  domain: automation
  source_url: https://github.com/benshoesweb/day-wheel-card/blob/main/blueprints/day_wheel_schedule.yaml
  homeassistant:
    min_version: 2024.10.0
  input:
    schedule_entity:
      name: Planning / Schedule
      description: >-
        Le planning réglé dans la carte (anneau avec « Piloter »).
        The schedule set in the card (ring with "Control").
      selector:
        entity:
          filter:
            - domain: schedule
    targets:
      name: Appareils pilotés / Controlled devices
      description: >-
        Thermostats, volets roulants ou lumières (groupes de lumières compris).
        Thermostats, covers or lights (light groups included).
      selector:
        entity:
          multiple: true
          filter:
            - domain:
                - climate
                - cover
                - light
    climate_section:
      name: Thermostats
      icon: mdi:thermostat
      input:
        temperature_default:
          name: Température d'une plage sans valeur / Temperature of a range without a value
          default: 20
          selector:
            number:
              min: 5
              max: 35
              step: 0.5
              unit_of_measurement: "°"
              mode: box
        climate_outside:
          name: Hors des plages / Outside the ranges
          default: temperature
          selector:
            select:
              options:
                - label: Température hors plages / Outside temperature
                  value: temperature
                - label: Éteindre le thermostat / Turn the thermostat off
                  value: "off"
                - label: Ne rien faire / Do nothing
                  value: nothing
        temperature_outside:
          name: Température hors plages / Outside temperature
          default: 17
          selector:
            number:
              min: 5
              max: 35
              step: 0.5
              unit_of_measurement: "°"
              mode: box
    cover_section:
      name: Volets / Covers
      icon: mdi:window-shutter
      input:
        position_default:
          name: Position d'une plage sans valeur / Position of a range without a value
          description: 0 = fermé, 100 = ouvert. 0 = closed, 100 = open.
          default: 100
          selector:
            number:
              min: 0
              max: 100
              step: 5
              unit_of_measurement: "%"
        cover_outside:
          name: Hors des plages / Outside the ranges
          default: position
          selector:
            select:
              options:
                - label: Position hors plages / Outside position
                  value: position
                - label: Ne rien faire / Do nothing
                  value: nothing
        position_outside:
          name: Position hors plages / Outside position
          default: 0
          selector:
            number:
              min: 0
              max: 100
              step: 5
              unit_of_measurement: "%"
    light_section:
      name: Lumières / Lights
      icon: mdi:lightbulb-group
      input:
        brightness_default:
          name: Luminosité d'une plage sans valeur / Brightness of a range without a value
          default: 100
          selector:
            number:
              min: 1
              max: 100
              step: 1
              unit_of_measurement: "%"
        light_outside:
          name: Hors des plages / Outside the ranges
          default: "off"
          selector:
            select:
              options:
                - label: Éteindre / Turn off
                  value: "off"
                - label: Ne rien faire / Do nothing
                  value: nothing

mode: restart

triggers:
  # Début ou fin d'une plage, valeur modifiée dans la carte (attribut du planning)
  - trigger: state
    entity_id: !input schedule_entity
  - trigger: homeassistant
    event: start

variables:
  schedule_entity: !input schedule_entity
  targets: !input targets
  temperature_default: !input temperature_default
  climate_outside: !input climate_outside
  temperature_outside: !input temperature_outside
  position_default: !input position_default
  cover_outside: !input cover_outside
  position_outside: !input position_outside
  brightness_default: !input brightness_default
  light_outside: !input light_outside

conditions:
  # Planning disponible, et seulement un vrai changement : début / fin de plage ou valeur modifiée
  # (pas la simple mise à jour de « next_event » quand un autre jour est modifié)
  - condition: template
    value_template: >-
      {% set ok = states(schedule_entity) in ['on', 'off'] %}
      {% if not ok %}false
      {% elif trigger.platform != 'state' or trigger.from_state is none %}true
      {% elif trigger.from_state.state != trigger.to_state.state %}true
      {% else %}
        {% set ns = namespace(changed=false) %}
        {% for k in ['temperature', 'position', 'brightness_pct'] %}
          {% if trigger.from_state.attributes.get(k) != trigger.to_state.attributes.get(k) %}
            {% set ns.changed = true %}
          {% endif %}
        {% endfor %}
        {{ ns.changed }}
      {% endif %}

actions:
  - variables:
      active: "{{ is_state(schedule_entity, 'on') }}"
      t_value: "{{ state_attr(schedule_entity, 'temperature') }}"
      p_value: "{{ state_attr(schedule_entity, 'position') }}"
      b_value: "{{ state_attr(schedule_entity, 'brightness_pct') }}"
      temperature: >-
        {{ (t_value | float) if (t_value is not none and t_value | is_number) else (temperature_default | float) }}
      position: >-
        {% if active %}{{ (p_value | int) if (p_value is not none and p_value | is_number) else (position_default | int) }}
        {% else %}{{ position_outside | int }}{% endif %}
      brightness: >-
        {{ (b_value | int) if (b_value is not none and b_value | is_number) else (brightness_default | int) }}
      target_list: "{{ [targets] if targets is string else targets }}"
  - repeat:
      for_each: "{{ target_list }}"
      sequence:
        - variables:
            domain: "{{ repeat.item.split('.')[0] }}"
        - choose:
            # Thermostat pendant une plage : allumé si besoin, puis température de la plage
            - conditions: "{{ domain == 'climate' and active }}"
              sequence:
                - if: "{{ is_state(repeat.item, 'off') }}"
                  then:
                    - action: climate.turn_on
                      target:
                        entity_id: "{{ repeat.item }}"
                      continue_on_error: true
                - action: climate.set_temperature
                  target:
                    entity_id: "{{ repeat.item }}"
                  data:
                    temperature: "{{ temperature }}"
                  continue_on_error: true
            - conditions: "{{ domain == 'climate' and climate_outside == 'temperature' }}"
              sequence:
                - action: climate.set_temperature
                  target:
                    entity_id: "{{ repeat.item }}"
                  data:
                    temperature: "{{ temperature_outside }}"
                  continue_on_error: true
            - conditions: "{{ domain == 'climate' and climate_outside == 'off' }}"
              sequence:
                - action: climate.turn_off
                  target:
                    entity_id: "{{ repeat.item }}"
                  continue_on_error: true
            # Volet : position (ou simplement ouvert / fermé s'il ne règle pas de position)
            - conditions: "{{ domain == 'cover' and (active or cover_outside == 'position') }}"
              sequence:
                - if: "{{ (state_attr(repeat.item, 'supported_features') | int(0)) | bitwise_and(4) > 0 }}"
                  then:
                    - action: cover.set_cover_position
                      target:
                        entity_id: "{{ repeat.item }}"
                      data:
                        position: "{{ position }}"
                      continue_on_error: true
                  else:
                    - action: "{{ 'cover.open_cover' if position | int > 0 else 'cover.close_cover' }}"
                      target:
                        entity_id: "{{ repeat.item }}"
                      continue_on_error: true
            # Lumières : luminosité de la plage, éteintes hors plages
            - conditions: "{{ domain == 'light' and active }}"
              sequence:
                - action: light.turn_on
                  target:
                    entity_id: "{{ repeat.item }}"
                  data:
                    brightness_pct: "{{ brightness }}"
                  continue_on_error: true
            - conditions: "{{ domain == 'light' and light_outside == 'off' }}"
              sequence:
                - action: light.turn_off
                  target:
                    entity_id: "{{ repeat.item }}"
                  continue_on_error: true
`;
  // </blueprint>

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
