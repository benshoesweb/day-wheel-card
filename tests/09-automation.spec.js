// Une automatisation par planning piloté : créée par la carte (blueprint installé au besoin), sans doublon
const fs = require('fs');
const path = require('path');

const M = (hh, mm = 0) => hh * 60 + mm;
const BP_FILE = fs.readFileSync(path.join(__dirname, '..', 'blueprints', 'day_wheel_schedule.yaml'), 'utf8');
const BP_PATH = 'benshoesweb/day_wheel_schedule.yaml';
const CH = { entity: 'schedule.chauffage', target: 'climate.salon' };

module.exports = async (browser, h) => {
  const { check, group } = h;
  const api = (page, method) => page.evaluate((method) => window.__api.filter((a) => a.path.startsWith('config/automation') && (!method || a.method === method)), method);
  const reset = async (page, layers, cfg = {}, pre = {}) => {
    await page.evaluate(({ layers, cfg, pre }) => {
      window.__ws = []; window.__api = []; window.__calls = []; window.__automations = pre.automations || {}; window.__blueprints = pre.blueprints || {};
      window.__autoLoad = pre.autoLoad !== false; window.__autoFail = !!pre.autoFail;
      Object.keys(window.__states).filter((e) => e.startsWith('automation.')).forEach((e) => { delete window.__states[e]; });
      (pre.loaded || []).forEach(([id, alias, st]) => window.addAutomation(id, alias, st));
      window.__schedulesOrig = window.__schedulesOrig || JSON.parse(JSON.stringify(window.__schedules));
      window.__schedules = JSON.parse(JSON.stringify(window.__schedulesOrig));
      window.pushSchedules(window.__schedules.map((item) => ({ change_type: 'updated', schedule_id: item.id, item })));
      const el = document.getElementById('a');
      el._day = null; el._sel = null; el._cfgKey = null;
      window.mk('a', { layers, ...cfg });
    }, { layers, cfg, pre });
    await page.waitForTimeout(150);
  };
  const plus = async (page) => {
    const p = await h.point(page, 'a', 0, M(19));
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
    await page.evaluate(() => window.sr('a').querySelector('[data-act="inc"]').click());
    await page.waitForTimeout(900);
  };
  const summary = async (page) => {
    await page.evaluate(() => document.getElementById('a')._openSummary());
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const l = window.sr('a').querySelector('.dlg .a-line');
      return l ? { text: l.textContent.replace(/\s+/g, ' ').trim(), btns: [...l.querySelectorAll('.a-btn')].map((b) => b.getAttribute('data-act')) } : null;
    });
  };
  const close = (page) => page.evaluate(() => document.getElementById('a')._closeSummary());

  group('Automatisation créée avec la première valeur');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await reset(page, [CH]);
    await plus(page);
    const ws = await h.ws(page);
    const save = ws.find((m) => m.type === 'blueprint/save');
    check('blueprint installé (il manquait) : benshoesweb/day_wheel_schedule.yaml, lien vers GitHub', save && save.path === BP_PATH && save.domain === 'automation'
      && save.source_url === 'https://github.com/benshoesweb/day-wheel-card/blob/main/blueprints/day_wheel_schedule.yaml' && !save.allow_override, save && { ...save, yaml: save.yaml.length });
    check('… identique au fichier blueprints/day_wheel_schedule.yaml', save && save.yaml === BP_FILE);
    const posts = await api(page, 'POST');
    check('une automatisation créée, identifiant fixe day_wheel_chauffage', posts.length === 1 && posts[0].path === 'config/automation/config/day_wheel_chauffage', posts);
    const cfg = posts[0] && posts[0].data;
    check('… nommée « Day Wheel · Chauffage → Thermostat salon », avec le blueprint, le planning et l\'appareil', cfg && cfg.alias === 'Day Wheel · Chauffage → Thermostat salon'
      && cfg.use_blueprint.path === BP_PATH && cfg.use_blueprint.input.schedule_entity === 'schedule.chauffage' && JSON.stringify(cfg.use_blueprint.input.targets) === '["climate.salon"]'
      && cfg.description.includes('Day Wheel Card'), cfg);
    const order = ws.filter((m) => m.type.startsWith('blueprint/') || m.type === 'search/related').map((m) => m.type);
    check('… après vérification (et revérification juste avant d\'écrire) : pas d\'automatisation existante', JSON.stringify(order) === '["search/related","search/related","blueprint/list","blueprint/save"]', order);
    const trig = (await h.calls(page)).filter((c) => c.domain === 'automation');
    check('… lancée une fois aussitôt (valeur de la plage en cours appliquée)', trig.length === 1 && trig[0].service === 'trigger' && trig[0].data.entity_id === 'automation.day_wheel_chauffage_thermostat_salon' && trig[0].data.skip_condition === true, trig);
    const msg = await page.evaluate(() => (window.sr('a').querySelector('.center .c-hint:last-child') || {}).textContent);
    check('message au centre : « Automatisation créée : … »', msg && msg.startsWith('Automatisation créée : Day Wheel · Chauffage'), msg);
    await page.evaluate(() => window.sr('a').querySelector('[data-act="inc"]').click());
    await page.waitForTimeout(900);
    check('valeur suivante : pas de deuxième automatisation', (await api(page, 'POST')).length === 1);
    const s = await summary(page);
    check('résumé : « Automatisation : Day Wheel · Chauffage → Thermostat salon · active », bouton Ouvrir', s && s.text.includes('Automatisation : Day Wheel · Chauffage → Thermostat salon · active') && JSON.stringify(s.btns) === '["auto-open"]', s);
    const nav = await page.evaluate(() => {
      let ev = null;
      window.addEventListener('location-changed', () => { ev = location.pathname; }, { once: true });
      const start = location.pathname;
      window.sr('a').querySelector('.dlg [data-act="auto-open"]').click();
      const r = { ev, path: location.pathname, open: window.sr('a').querySelector('.dlg').open };
      history.pushState(null, '', start);
      return r;
    });
    check('Ouvrir : éditeur d\'automatisation de Home Assistant, résumé fermé', nav.path === '/config/automation/edit/day_wheel_chauffage' && nav.ev === nav.path && !nav.open, nav);

    // Deux enregistrements rapprochés sur un planning neuf : une seule automatisation
    await reset(page, [CH]);
    await page.evaluate(async () => { const el = document.getElementById('a'); await Promise.all([el._autoEnsure(0), el._autoAction('auto-create', 0)]); });
    await page.waitForTimeout(200);
    check('deux demandes en même temps : une seule automatisation', (await api(page, 'POST')).length === 1, await api(page, 'POST'));
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Automatisation déjà là, blueprint déjà importé');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    // Blueprint importé avec le bouton du README : il est réutilisé, pas réécrit
    await reset(page, [CH], {}, { blueprints: { [BP_PATH]: { metadata: { source_url: 'https://github.com/benshoesweb/day-wheel-card/blob/main/blueprints/day_wheel_schedule.yaml' } } } });
    await plus(page);
    check('blueprint déjà importé : réutilisé, pas réécrit', !(await h.ws(page)).some((m) => m.type === 'blueprint/save') && (await api(page, 'POST')).length === 1);
    await reset(page, [CH], {}, { blueprints: { 'moi/dw.yaml': { metadata: { source_url: 'https://github.com/benshoesweb/day-wheel-card/blob/main/blueprints/day_wheel_schedule.yaml' } } } });
    await plus(page);
    const p2 = (await api(page, 'POST'))[0];
    check('blueprint importé ailleurs (même source) : ce chemin est utilisé', p2 && p2.data.use_blueprint.path === 'moi/dw.yaml', p2);

    // Automatisation faite à la main avec le blueprint : pas de doublon, affichée
    const mine = { alias: 'Mon chauffage', use_blueprint: { path: BP_PATH, input: { schedule_entity: 'schedule.chauffage', targets: ['climate.salon'] } } };
    await reset(page, [CH], {}, { automations: { 1712345: mine }, loaded: [['1712345', 'Mon chauffage']] });
    await plus(page);
    check('automatisation faite à la main avec le blueprint : pas de doublon', (await api(page, 'POST')).length === 0, await api(page, 'POST'));
    let s = await summary(page);
    check('… le résumé l\'affiche', s && s.text.includes('Mon chauffage · active'), s);
    await close(page);

    // Désactivée
    await reset(page, [CH], {}, { automations: { day_wheel_chauffage: { ...mine, alias: 'Day Wheel · Chauffage → Thermostat salon' } }, loaded: [['day_wheel_chauffage', 'Day Wheel · Chauffage → Thermostat salon', 'off']] });
    s = await summary(page);
    check('automatisation désactivée : « désactivée »', s && s.text.includes('Thermostat salon · désactivée'), s);
    await close(page);

    // Appareil changé dans la carte : proposer de mettre à jour la nôtre (sans toucher aux autres réglages)
    const own = { alias: 'Day Wheel · Chauffage → Chambre', use_blueprint: { path: BP_PATH, input: { schedule_entity: 'schedule.chauffage', targets: ['climate.chambre'], temperature_outside: 16 } } };
    await reset(page, [CH], {}, { automations: { day_wheel_chauffage: own }, loaded: [['day_wheel_chauffage', own.alias]] });
    s = await summary(page);
    check('appareil changé : « pilote climate.chambre, pas Thermostat salon » + bouton', s && s.text.includes('pas Thermostat salon') && s.btns.includes('auto-update'), s);
    await page.evaluate(() => window.sr('a').querySelector('.dlg [data-act="auto-update"]').click());
    await page.waitForTimeout(300);
    const up = (await api(page, 'POST'))[0];
    check('… mise à jour : appareil remplacé, nom et autres réglages conservés', up && up.path === 'config/automation/config/day_wheel_chauffage'
      && JSON.stringify(up.data.use_blueprint.input) === JSON.stringify({ schedule_entity: 'schedule.chauffage', targets: ['climate.salon'], temperature_outside: 16 }) && up.data.alias === own.alias && !('id' in up.data), up);
    s = await page.evaluate(() => window.sr('a').querySelector('.dlg .a-line').textContent);
    check('… le résumé montre l\'automatisation à jour', s.includes('· active') && !s.includes('pas Thermostat'), s);
    await close(page);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Création manuelle, erreurs, droits');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await reset(page, [CH], { create_automation: false });
    await plus(page);
    check('create_automation: false : rien de créé en réglant une valeur', (await api(page, 'POST')).length === 0);
    let s = await summary(page);
    check('… résumé : « aucune : les valeurs ne s\'appliquent pas toutes seules » + bouton Créer', s && s.text.includes('aucune') && JSON.stringify(s.btns) === '["auto-create"]', s);
    await page.evaluate(() => window.sr('a').querySelector('.dlg [data-act="auto-create"]').click());
    await page.waitForTimeout(400);
    s = await page.evaluate(() => window.sr('a').querySelector('.dlg .a-line').textContent);
    check('… bouton Créer : automatisation créée, affichée active', (await api(page, 'POST')).length === 1 && s.includes('Thermostat salon · active'), s);
    await close(page);

    await reset(page, [CH], {}, { autoFail: true });
    await plus(page);
    s = await summary(page);
    const err = await page.evaluate(() => (window.sr('a').querySelector('.c-err') || {}).textContent);
    check('refus de Home Assistant : message au centre, et bouton Créer dans le résumé pour réessayer', err === 'Automatisation non créée' && s && s.text.includes('aucune') && s.btns.includes('auto-create'), { s, err });
    await close(page);

    await reset(page, [CH], {}, { autoLoad: false });
    await plus(page);
    await page.waitForTimeout(6000);
    s = await summary(page);
    check('enregistrée mais pas chargée : explication (automations.yaml)', s && s.text.includes('automations.yaml'), s);
    await close(page);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();

    const t2 = await h.open(browser, h.card('a'), { admin: false });
    const p2 = t2.page;
    await reset(p2, [CH], {}, { automations: { day_wheel_chauffage: { alias: 'Day Wheel · Chauffage → Thermostat salon' } }, loaded: [['day_wheel_chauffage', 'Day Wheel · Chauffage → Thermostat salon']] });
    s = await summary(p2);
    check('non administrateur : l\'automatisation affichée, sans bouton ni appel à la configuration', s && s.text.includes('· active') && s.btns.length === 0 && (await api(p2)).length === 0, s);
    await reset(p2, [CH]);
    s = await summary(p2);
    check('… et rien d\'affiché quand il ne peut pas savoir', s === null, s);
    check('aucune erreur JS', t2.errors.length === 0, t2.errors);
    await t2.close();
  }

  group('Éditeur : automatisation du planning');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const { page } = t;
    await page.evaluate(() => {
      window.__opened = [];
      window.open = (u, w) => { window.__opened.push([u, w]); return null; };
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      window.__log = [];
      ed.addEventListener('config-changed', (e) => { window.__log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage', 'input_datetime.reveil'] });
      window.__ed = ed;
    });
    const box = () => page.evaluate(() => { const b = window.__ed.shadowRoot.querySelector('[data-auto="0"]'); return b ? { text: b.textContent.replace(/\s+/g, ' ').trim(), btns: [...b.querySelectorAll('.a-btn')].map((x) => x.getAttribute('data-act')) } : null; });
    check('planning sans appareil piloté : pas de ligne d\'automatisation', (await box()).text === '');
    await page.evaluate(() => window.__ed.shadowRoot.querySelector('[data-layer="0"] [data-lkey="target"]').pick('climate.salon'));
    await page.waitForTimeout(150);
    let b = await box();
    check('appareil choisi : « aucune » + bouton « Créer l\'automatisation »', b.text.includes('aucune') && JSON.stringify(b.btns) === '["auto-create"]' && b.text.includes('Créer l\'automatisation'), b);
    await page.evaluate(() => window.__ed.shadowRoot.querySelector('[data-auto="0"] [data-act="auto-create"]').click());
    await page.waitForTimeout(400);
    b = await box();
    check('… clic : créée, « active » + bouton Ouvrir', (await api(page, 'POST')).length === 1 && b.text.includes('Day Wheel · Chauffage → Thermostat salon · active') && JSON.stringify(b.btns) === '["auto-open"]', b);
    await page.evaluate(() => window.__ed.shadowRoot.querySelector('[data-auto="0"] [data-act="auto-open"]').click());
    const opened = await page.evaluate(() => window.__opened);
    check('… Ouvrir : dans un nouvel onglet (l\'édition de la carte n\'est pas perdue)', opened.length === 1 && opened[0][0] === '/config/automation/edit/day_wheel_chauffage' && opened[0][1] === '_blank', opened);
    const r = await page.evaluate(() => {
      const c = window.__ed.shadowRoot.querySelector('[data-field="create_automation"]');
      const label = c.closest('label').textContent.trim();
      const on = c.checked;
      c.checked = false; c.dispatchEvent(new Event('change'));
      return { label, on, v: window.__log[window.__log.length - 1].create_automation };
    });
    check('case « Créer l\'automatisation du planning dès qu\'une valeur est réglée », cochée par défaut ; décochée : false', r.on && r.v === false && r.label.startsWith('Créer l\'automatisation du planning'), r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
