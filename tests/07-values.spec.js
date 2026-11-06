// Plannings qui pilotent un appareil (« target ») : température, position ou luminosité par plage
const M = (hh, mm = 0) => hh * 60 + mm;

module.exports = async (browser, h) => {
  const { check, group } = h;
  const updates = (page) => h.ws(page, 'schedule/update');
  const fresh = async (page, layers, cfg = {}) => {
    await page.evaluate(({ layers, cfg }) => {
      window.__ws = []; window.__failUpdate = false;
      window.__schedulesOrig = window.__schedulesOrig || JSON.parse(JSON.stringify(window.__schedules));
      window.__schedules = JSON.parse(JSON.stringify(window.__schedulesOrig));
      window.pushSchedules(window.__schedules.map((item) => ({ change_type: 'updated', schedule_id: item.id, item })));
      const el = document.getElementById('a');
      el._day = null; el._sel = null; el._cfgKey = null;
      window.mk('a', { layers, ...cfg });
    }, { layers, cfg });
    await page.waitForTimeout(150);
  };
  const tap = async (page, li, m) => {
    const p = await h.point(page, 'a', li, m);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
  };
  const center = (page) => page.evaluate(() => {
    const s = window.sr('a');
    const v = s.querySelector('.c-val b');
    const inc = s.querySelector('[data-act="inc"]');
    const dec = s.querySelector('[data-act="dec"]');
    return { val: v ? v.textContent : null, inc: !!inc, dec: !!dec, incOff: !!(inc && inc.disabled), decOff: !!(dec && dec.disabled), del: !!s.querySelector('[data-act="delete"]') };
  });
  const press = async (page, act, n = 1) => {
    for (let k = 0; k < n; k += 1) {
      await page.evaluate((act) => window.sr('a').querySelector(`[data-act="${act}"]`).click(), act);
      await page.waitForTimeout(30);
    }
  };
  const labels = (page) => page.evaluate(() => [...window.sr('a').querySelectorAll('text.arc-val')].map((t) => t.textContent));
  const CH = [{ entity: 'schedule.chauffage', target: 'climate.salon' }];

  group('Thermostat : une température par plage');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await fresh(page, CH);
    check('pas encore de valeur : rien d\'écrit sur les plages', (await labels(page)).length === 0, await labels(page));
    await tap(page, 0, M(19));
    let c = await center(page);
    check('plage choisie : valeur « — », boutons − / + et corbeille', c.val === '—' && c.inc && c.dec && c.del, c);
    await press(page, 'inc');
    c = await center(page);
    check('+ : valeur par défaut (20 °C), affichée tout de suite', c.val === '20 °C', c);
    check('… pas encore envoyée (petite pause avant l\'enregistrement)', (await updates(page)).length === 0);
    await press(page, 'inc', 2);
    check('+ + : 21 °C (pas du thermostat : 0,5)', (await center(page)).val === '21 °C', await center(page));
    await page.waitForTimeout(800);
    let u = await updates(page);
    check('un seul enregistrement après la pause : temperature: 21 dans les données de la plage', u.length === 1
      && JSON.stringify(u[0].wednesday) === JSON.stringify([{ from: '06:30:00', to: '08:00:00' }, { from: '17:00:00', to: '22:30:00', data: { consigne: 20, temperature: 21 } }]), u);
    check('… les autres données de la plage sont conservées, les autres jours aussi', u[0] && u[0].saturday.length === 1 && u[0].thursday.length === 1, u[0]);
    check('valeur écrite sur la plage', (await labels(page)).includes('21°'), await labels(page));
    const title = await page.evaluate(() => window.sr('a').querySelector('path.arc[data-li="0"][data-i="1"] title').textContent);
    check('… et dans son info-bulle', title === '17:00 – 22:30 · 21 °C', title);

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(40);
    check('flèche bas : 20,5 °C', (await center(page)).val === '20,5 °C', await center(page));
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(800);
    u = await updates(page);
    check('touche + : 21,5 °C enregistré', u.length === 2 && u[1].wednesday[1].data.temperature === 21.5, u.map((x) => x.wednesday[1]));

    // Centre au repos : la prochaine plage avec sa température
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
    const line = await page.evaluate(() => { const l = window.sr('a').querySelector('.c-line'); return { t: l.textContent, title: l.title }; });
    check('centre : « 17:00 21,5° »', line.t.includes('17:00') && line.t.includes('21,5°') && line.title.includes('21,5°'), line);

    // Nouvelle plage : valeur de la plage voisine
    let p = await h.point(page, 'a', 0, M(12));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(100);
    u = await updates(page);
    check('appui long : nouvelle plage avec la température de la plage voisine', u.length === 3 && JSON.stringify(u[2].wednesday[1]) === JSON.stringify({ from: '11:30:00', to: '12:30:00', data: { temperature: 21.5 } }), u[2] && u[2].wednesday);
    check('… choisie, valeur au centre', (await center(page)).val === '21,5 °C', await center(page));
    check('… valeur écrite seulement là où elle tient (pas sur la plage d\'une heure)', JSON.stringify(await labels(page)) === '["21,5°"]', await labels(page));

    // Valeur en attente puis glisser : rien n'est perdu
    await fresh(page, CH);
    await tap(page, 0, M(19));
    await press(page, 'inc');
    await h.drag(page, 'a', 0, M(22, 30), M(23, 30));
    await page.waitForTimeout(800);
    u = await updates(page);
    const last = u[u.length - 1];
    check('+ puis glisser la fin aussitôt : heure et température enregistrées', last && last.wednesday[1].to === '23:30:00' && last.wednesday[1].data.temperature === 20, u.map((x) => x.wednesday[1]));

    // Bornes : max du thermostat (30) et réglage max de l'anneau
    await fresh(page, [{ ...CH[0], max: 21 }]);
    await tap(page, 0, M(19));
    await press(page, 'inc', 5);
    c = await center(page);
    check('max: 21 → bloqué à 21 °C, + désactivé', c.val === '21 °C' && c.incOff, c);
    await fresh(page, [{ ...CH[0], min: 19, step: 1 }]);
    await tap(page, 0, M(19));
    await press(page, 'inc');
    await press(page, 'dec', 3);
    c = await center(page);
    check('min: 19, step: 1 → 19 °C, − désactivé', c.val === '19 °C' && c.decOff, c);
    await page.waitForTimeout(800);

    // Refus de Home Assistant : valeur rétablie
    await fresh(page, CH);
    await page.evaluate(() => { window.__failUpdate = true; });
    await tap(page, 0, M(19));
    await press(page, 'inc');
    await page.waitForTimeout(800);
    const fail = await page.evaluate(() => ({ err: (window.sr('a').querySelector('.c-err') || {}).textContent }));
    check('refus : message d\'erreur et valeur rétablie', fail.err && fail.err.includes('Échec') && (await center(page)).val === '—', { fail, c: await center(page) });
    await page.evaluate(() => { window.__failUpdate = false; });

    // Changement de configuration pendant la pause : envoyé tout de suite
    await fresh(page, CH);
    await tap(page, 0, M(19));
    await press(page, 'inc');
    await page.evaluate(() => window.mk('a', { layers: [{ entity: 'schedule.chauffage', target: 'climate.salon' }], name: 'X' }));
    await page.waitForTimeout(60);
    u = await updates(page);
    check('carte reconfigurée pendant la pause : la valeur part aussitôt', u.length === 1 && u[0].wednesday[1].data.temperature === 20, u);
    await page.evaluate(() => { const el = document.getElementById('a'); el._sel = { li: 0, i: 1 }; el._render(); });
    await press(page, 'inc');
    await page.evaluate(() => { const el = document.getElementById('a'); el.remove(); document.body.appendChild(el); });
    await page.waitForTimeout(60);
    u = await updates(page);
    check('carte retirée de la page pendant la pause : la valeur part aussitôt', u.length === 2 && u[1].wednesday[1].data.temperature === 20.5, u.map((x) => x.wednesday[1]));

    // Sans « target » : comme avant
    await fresh(page, ['schedule.chauffage']);
    await tap(page, 0, M(19));
    c = await center(page);
    check('sans target : pas de valeur ni de − / +', c.val === null && !c.inc && c.del, c);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Volets et lumières');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await fresh(page, [{ entity: 'schedule.volets', target: 'cover.salon' }, { entity: 'schedule.chauffage', target: 'light.groupe_salon' }]);
    await tap(page, 0, M(12));
    await press(page, 'inc');
    check('volet : 100 % par défaut', (await center(page)).val === '100 %', await center(page));
    await press(page, 'dec', 3);
    check('… − − − : 70 %', (await center(page)).val === '70 %', await center(page));
    await page.waitForTimeout(800);
    let u = await updates(page);
    check('volet : position: 70 dans la plage', u.length === 1 && u[0].schedule_id === 'volets' && JSON.stringify(u[0].wednesday) === JSON.stringify([{ from: '07:45:00', to: '19:00:00', data: { position: 70 } }]), u);
    check('… écrit « 70% » sur la plage', (await labels(page)).includes('70%'), await labels(page));
    await tap(page, 1, M(19));
    await press(page, 'dec', 12);
    check('lumières : 10 % au minimum', (await center(page)).val === '10 %', await center(page));
    await page.waitForTimeout(800);
    u = await updates(page);
    check('lumières : brightness_pct: 10', u.length === 2 && u[1].schedule_id === 'chauffage_id' && u[1].wednesday[1].data.brightness_pct === 10, u.map((x) => x.wednesday));
    const icons = await page.evaluate(() => [...window.sr('a').querySelectorAll('.lg ha-icon')].map((i) => i.getAttribute('icon')));
    check('légende : icône du planning, sinon celle de l\'appareil piloté', icons[0] === 'mdi:window-shutter' && icons[1] === 'mdi:radiator', icons);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Valeurs en anglais, en lecture seule');
  {
    const t = await h.open(browser, h.card('a'), { lang: 'en' });
    const { page } = t;
    await fresh(page, CH);
    await tap(page, 0, M(19));
    await press(page, 'inc', 2);
    check('anglais : « 20.5 °C »', (await center(page)).val === '20.5 °C', await center(page));
    await page.waitForTimeout(800);
    await t.close();
    const t2 = await h.open(browser, h.card('a'), { admin: false });
    const p2 = t2.page;
    await p2.evaluate(() => {
      window.__schedules[0].wednesday[1].data = { temperature: 19 };
      window.mk('a', { layers: [{ entity: 'schedule.chauffage', target: 'climate.salon' }] });
    });
    await p2.waitForTimeout(150);
    const p = await h.point(p2, 'a', 0, M(19));
    await p2.mouse.click(p.x, p.y);
    await p2.waitForTimeout(60);
    const c = await p2.evaluate(() => ({ val: window.sr('a').querySelector('.c-val b').textContent, inc: !!window.sr('a').querySelector('[data-act="inc"]'), hint: window.sr('a').querySelector('.c-hint').textContent }));
    check('non administrateur : valeur affichée, sans − / +', c.val === '19 °C' && !c.inc && c.hint.includes('administrateurs'), c);
    await p2.keyboard.press('ArrowUp');
    await p2.waitForTimeout(700);
    check('… et le clavier ne change rien', (await h.ws(p2, 'schedule/update')).length === 0);
    check('aucune erreur JS', t.errors.length === 0 && t2.errors.length === 0, [t.errors, t2.errors]);
    await t2.close();
  }

  group('Éditeur : appareil piloté');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const { page } = t;
    const r = await page.evaluate(() => {
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage', 'input_datetime.reveil'] });
      const $$ = (q) => [...ed.shadowRoot.querySelectorAll(q)];
      const targets = () => $$('[data-layer]').map((b) => !!b.querySelector('[data-lkey="target"]'));
      const before = targets();
      const picker = ed.shadowRoot.querySelector('[data-layer="0"] [data-lkey="target"]');
      const info = { label: picker._label, domains: picker.includeDomains };
      picker.pick('climate.salon');
      const a = log[log.length - 1].layers[0];
      const shown = ed.shadowRoot.querySelector('[data-layer="0"] [data-lkey="target"]').value;
      ed.shadowRoot.querySelector('[data-layer="0"] [data-lkey="entity"]').pick('calendar.famille');
      const b = log[log.length - 1].layers[0];
      const after = targets();
      ed.shadowRoot.querySelector('[data-layer="1"] [data-lkey="entity"]').pick('schedule.volets');
      const after2 = targets();
      const hints = $$('.hint').map((x) => x.textContent).join(' ');
      return { before, info, a, shown, b, after, after2, hints };
    });
    check('« Piloter » seulement pour un planning', JSON.stringify(r.before) === '[true,false]', r.before);
    check('… thermostats, volets et lumières', r.info.label === 'Piloter (thermostat, volet ou lumière)' && JSON.stringify(r.info.domains) === '["climate","cover","light"]', r.info);
    check('choisir un thermostat : target: climate.salon', r.a.entity === 'schedule.chauffage' && r.a.target === 'climate.salon' && r.shown === 'climate.salon', r);
    check('anneau changé en calendrier : target retiré, champ masqué', r.b.entity === 'calendar.famille' && !('target' in r.b) && JSON.stringify(r.after) === '[false,false]', r);
    check('anneau changé en planning : champ affiché', JSON.stringify(r.after2) === '[false,true]', r.after2);
    check('indication : blueprint et groupe de lumières', r.hints.includes('blueprint') && r.hints.includes('groupe de lumières'), r.hints);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
