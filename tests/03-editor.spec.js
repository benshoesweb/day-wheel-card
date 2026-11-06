// Éditeur visuel : langues, clés conservées, anneaux (ajout, ordre, suppression), options, saisie temporisée
module.exports = async (browser, h) => {
  const { check, group } = h;
  const BASE = {
    type: 'custom:day-wheel-card', name: 'Ma journée',
    layers: [{ entity: 'schedule.chauffage', color: '#ff7043' }, 'input_datetime.reveil'],
    grid_options: { columns: 6, rows: 7 }, visibility: [{ condition: 'user', users: ['abc'] }], cle_inconnue: 42,
  };
  const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1000 });
  const { page } = t;
  const setup = (lang = 'fr', cfg = BASE) => page.evaluate(({ cfg, lang }) => {
    document.getElementById('host').innerHTML = '';
    const ed = document.createElement('day-wheel-card-editor');
    document.getElementById('host').appendChild(ed);
    window.__log = [];
    ed.addEventListener('config-changed', (e) => { window.__log.push(e.detail.config); queueMicrotask(() => ed.setConfig(e.detail.config)); });
    ed.hass = { ...window.makeHass(), language: lang, locale: { language: lang } };
    ed.setConfig(cfg);
    window.ed = ed;
    window.$ = (s) => ed.shadowRoot.querySelector(s);
    window.$$ = (s) => [...ed.shadowRoot.querySelectorAll(s)];
    window.choose = (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); };
    window.tick = (el, on) => { el.checked = on; el.dispatchEvent(new Event('change')); };
    window.last = () => window.__log[window.__log.length - 1];
  }, { cfg, lang });
  const wait = (ms = 30) => page.waitForTimeout(ms);

  group('Éditeur : affichage');
  {
    await setup('fr');
    const r = await page.evaluate(() => ({
      titles: $$('.section-title').map((x) => x.textContent),
      layers: $$('[data-layer]').length,
      picker: $('[data-layer="0"] [data-lkey="entity"]').value,
      domains: $('[data-layer="0"] [data-lkey="entity"]').includeDomains,
      swatch: $('[data-layer="0"] [data-swatch]').value,
      skins: $('[data-field="knob_theme"]').options.length,
    }));
    check('français : sections (générales, apparence, anneaux), 2 anneaux (chaîne normalisée)', r.titles[0] === 'Paramètres généraux' && r.titles[1] === 'Apparence de la carte' && r.titles[2].startsWith('Anneaux (2/6)') && r.layers === 2, r);
    check('entité et couleur affichées, entités proposées : schedule, input_datetime, time, sensor, calendar',
      r.picker === 'schedule.chauffage' && r.swatch === '#ff7043' && JSON.stringify(r.domains) === JSON.stringify(['schedule', 'input_datetime', 'time', 'sensor', 'calendar']), r);
    check('7 styles de centre', r.skins === 7, r);
    await setup('en');
    const en = await page.evaluate(() => $$('.section-title').map((x) => x.textContent));
    check('anglais', en[0] === 'General' && en[1] === 'Card appearance' && en[2].startsWith('Rings (2/6)'), en);
  }

  group('Éditeur : options');
  {
    await setup('fr');
    const r = await page.evaluate(() => {
      choose($('[data-field="snap"]'), '30');
      const a = last();
      choose($('[data-field="orientation"]'), 'noon_top');
      choose($('[data-field="knob_theme"]'), 'neon');
      tick($('[data-field="show_sun"]'), false);
      const b = last();
      choose($('[data-field="snap"]'), '15');
      tick($('[data-field="show_sun"]'), true);
      choose($('[data-field="orientation"]'), 'midnight_top');
      const c = last();
      return { snap: a.snap, b, c };
    });
    check('pas de 30 min (nombre), midi en haut, néon, soleil masqué', r.snap === 30 && r.b.orientation === 'noon_top' && r.b.knob_theme === 'neon' && r.b.show_sun === false, r);
    check('valeurs par défaut : clés retirées', !('snap' in r.c) && !('show_sun' in r.c) && !('orientation' in r.c) && r.c.knob_theme === 'neon', r.c);
    check('clés inconnues conservées (grid_options, visibility…)', r.c.cle_inconnue === 42 && r.c.grid_options.rows === 7 && r.c.visibility.length === 1 && r.c.type === 'custom:day-wheel-card', r.c);
    await page.evaluate(() => {
      const el = $('[data-field="name"]');
      el.focus(); el.value = 'Mon'; el.dispatchEvent(new Event('input'));
      el.value = 'Mon planning'; el.dispatchEvent(new Event('input'));
    });
    const n0 = await page.evaluate(() => window.__log.length);
    await wait(350);
    const n = await page.evaluate(() => ({ count: window.__log.length, name: last().name }));
    check('titre : enregistré une fois, 250 ms après la frappe', n.count === n0 + 1 && n.name === 'Mon planning', { n0, n });
  }

  group('Éditeur : anneaux');
  {
    await setup('fr');
    const r = await page.evaluate(async () => {
      const out = {};
      $('[data-layer="1"] [data-lkey="entity"]').pick('time.arrosage');
      out.pick = last().layers[1];
      $('[data-layer="0"] [data-lkey="icon"]').pick('mdi:fire');
      out.icon = last().layers[0].icon;
      const col = $('[data-layer="1"] [data-lfield="color"]');
      col.value = '#123456'; col.dispatchEvent(new Event('change'));
      out.color = last().layers[1].color;
      out.swatch = $('[data-layer="1"] [data-swatch]').value;
      $('[data-add]').click();
      await new Promise((r) => setTimeout(r, 10));
      out.added = last().layers.map((l) => l.entity);
      $('[data-layer="2"] [data-move="-1"]').click();
      await new Promise((r) => setTimeout(r, 10));
      out.moved = last().layers.map((l) => l.entity);
      $('[data-layer="0"] [data-del]').click();
      await new Promise((r) => setTimeout(r, 10));
      out.deleted = last().layers.map((l) => l.entity);
      out.count = $$('[data-layer]').length;
      return out;
    });
    check('entité choisie', r.pick.entity === 'time.arrosage', r);
    check('icône et couleur (pastille mise à jour)', r.icon === 'mdi:fire' && r.color === '#123456' && r.swatch === '#123456', r);
    check('ajout : une entité pas encore utilisée', r.added.length === 3 && !['schedule.chauffage', 'time.arrosage'].includes(r.added[2]) && /^(schedule|input_datetime|calendar)\./.test(r.added[2]), r.added);
    check('ordre : monter', r.moved[1] === r.added[2] && r.moved[2] === 'time.arrosage', r.moved);
    check('suppression', JSON.stringify(r.deleted) === JSON.stringify(r.moved.slice(1)) && r.count === 2, r);
    await setup('fr', { type: 'custom:day-wheel-card', layers: ['schedule.chauffage'] });
    const one = await page.evaluate(() => ({ del: $('[data-layer="0"] [data-del]').disabled, n: (() => { $('[data-layer="0"] [data-del]').click(); return window.__log.length; })() }));
    check('dernier anneau : suppression impossible', one.del && one.n === 0, one);
  }

  group('Éditeur : carte de démonstration');
  {
    const stub = await page.evaluate(() => customElements.get('day-wheel-card').getStubConfig(window.makeHass()));
    check('getStubConfig : plannings, heure et calendrier de l\'installation', JSON.stringify(stub.layers.map((l) => l.entity)) === JSON.stringify(['schedule.chauffage', 'schedule.volets', 'input_datetime.reveil', 'calendar.famille']), stub);
    const cc = await page.evaluate(() => window.customCards.find((c) => c.type === 'day-wheel-card'));
    check('carte déclarée dans le sélecteur de cartes', cc && cc.name === 'Day Wheel Card' && cc.preview === true, cc);
  }
  check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
  await t.close();
};
