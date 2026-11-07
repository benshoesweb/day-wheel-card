// Format de l'heure : 24 h (défaut), 12 h (AM / PM), auto (profil Home Assistant)
const M = (hh, mm = 0) => hh * 60 + mm;

module.exports = async (browser, h) => {
  const { check, group } = h;
  const read = (page) => page.evaluate(() => {
    const s = window.sr('a');
    return {
      big: s.querySelector('.center .c-big').textContent.trim(),
      ap: !!s.querySelector('.center .c-big small.ap'),
      hours: [...s.querySelectorAll('text.hour')].map((t) => t.textContent),
      arcs: [...s.querySelectorAll('path.arc[data-li="0"] title')].map((t) => t.textContent),
      line: (s.querySelector('.c-line') || {}).textContent,
      marker: [...s.querySelectorAll('.marker text')].map((t) => t.textContent),
      markerTitle: [...s.querySelectorAll('.marker title')].map((t) => t.textContent),
      sun: [...s.querySelectorAll('.sunmark title')].map((t) => t.textContent),
    };
  });
  const LAYERS = ['schedule.chauffage', 'input_datetime.reveil'];

  group('Format de l\'heure sur le cadran');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await page.evaluate((L) => window.mk('a', { layers: L }), LAYERS);
    await page.waitForTimeout(150);
    let r = await read(page);
    check('par défaut : 24 heures (10:00, 0 à 21, 17:00 – 22:30)', r.big === '10:00' && !r.ap && r.hours.join() === '0,3,6,9,12,15,18,21' && r.arcs.includes('17:00 – 22:30') && r.line.includes('17:00'), r);
    await page.evaluate((L) => window.mk('a', { layers: L, time_format: '12' }), LAYERS);
    await page.waitForTimeout(80);
    r = await read(page);
    check('12 heures : « 10:00 AM » au centre, AM en petit', r.big === '10:00AM' && r.ap, r);
    check('… chiffres du cadran 12a, 3a … 9p', r.hours.join() === '12a,3a,6a,9a,12p,3p,6p,9p', r.hours);
    check('… plages : « 6:30 – 8:00 AM », « 5:00 – 10:30 PM »', r.arcs.includes('6:30 – 8:00 AM') && r.arcs.includes('5:00 – 10:30 PM'), r.arcs);
    check('… prochaine plage au centre : « 5:00 PM »', r.line.includes('5:00 PM'), r.line);
    check('… repère du réveil : « 7:30 » sur l\'anneau, « 7:30 AM » dans l\'info-bulle', r.marker.join() === '7:30' && r.markerTitle[0].endsWith('7:30 AM'), r);
    check('… lever et coucher du soleil', r.sun.join() === '7:50 AM,5:20 PM', r.sun);
    await page.evaluate((L) => window.mk('a', { layers: L, time_format: 12 }), LAYERS);
    check('time_format: 12 (nombre en YAML) accepté', (await read(page)).ap);
    // Plage choisie, plage qui passe midi, fin à minuit
    await page.evaluate((L) => {
      window.__schedules[0].wednesday = [{ from: '11:00:00', to: '13:00:00' }, { from: '20:00:00', to: '24:00:00' }];
      window.pushSchedules([{ change_type: 'updated', schedule_id: window.__schedules[0].id, item: window.__schedules[0] }]);
      window.mk('a', { layers: L, time_format: '12' });
    }, LAYERS);
    await page.waitForTimeout(80);
    r = await read(page);
    check('plage qui passe midi : « 11:00 AM – 1:00 PM » ; fin à minuit : « 8:00 PM – 12:00 AM »', r.arcs.includes('11:00 AM – 1:00 PM') && r.arcs.includes('8:00 PM – 12:00 AM'), r.arcs);
    const p = await h.point(page, 'a', 0, M(12));
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
    const sel = await page.evaluate(() => window.sr('a').querySelector('.center .c-big').textContent.trim());
    check('plage choisie : « 11:00 AM – 1:00 PM » au centre', sel === '11:00 AM – 1:00 PM', sel);
    // Pendant un glisser : début et fin en 12 h
    const a = await h.point(page, 'a', 0, M(20));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const b2 = await h.point(page, 'a', 0, M(19));
    await page.mouse.move(b2.x, b2.y, { steps: 6 });
    const drag = await page.evaluate(() => window.sr('a').querySelector('.center .c-big').textContent.trim());
    await page.mouse.up();
    check('pendant le glisser : « 7:00PM » puis « 12:00AM »', drag === '7:00PM12:00AM', drag);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Format de l\'heure : résumé, auto, anglais');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await page.evaluate(() => window.mk('a', { layers: ['schedule.chauffage', 'sensor.prochaine_alarme'], time_format: '12' }));
    await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('a')._openSummary());
    await page.waitForTimeout(250);
    const sum = await page.evaluate(() => window.sr('a').querySelector('.dlg-body').textContent.replace(/\s+/g, ' '));
    check('résumé : plages (08:00 – minuit = « 8:00 AM–12:00 AM »), alarme, soleil et réglage en 12 heures', sum.includes('6:30–8:00 AM') && sum.includes('8:00 AM–12:00 AM') && /06:15\s?AM/.test(sum)
      && sum.includes('lever 7:50 AM · coucher 5:20 PM') && sum.includes('Format de l\'heure12 heures (7:30 PM)'), sum);
    await page.evaluate(() => document.getElementById('a')._closeSummary());
    // Auto : réglage du profil Home Assistant
    const auto = await page.evaluate(() => {
      const r = {};
      for (const [k, tf] of [['p12', '12'], ['p24', '24'], ['frLang', 'language']]) {
        window.__tf = tf;
        window.mk('a', { layers: ['schedule.chauffage'], time_format: 'auto' });
        r[k] = window.sr('a').querySelector('.center .c-big').textContent.trim();
      }
      window.__tf = undefined;
      return r;
    });
    check('auto : profil 12 h → 10:00 AM, profil 24 h → 10:00, « selon la langue » en français → 24 h', auto.p12 === '10:00AM' && auto.p24 === '10:00' && auto.frLang === '10:00', auto);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
    const e = await h.open(browser, h.card('a'), { lang: 'en' });
    const en = await e.page.evaluate(() => {
      window.__tf = 'language';
      window.mk('a', { layers: ['schedule.chauffage'], time_format: 'auto' });
      return window.sr('a').querySelector('.center .c-big').textContent.trim();
    });
    check('auto, « selon la langue » en anglais (en) → 12 h', en === '10:00AM', en);
    check('aucune erreur JS', e.errors.length === 0, e.errors);
    await e.close();
  }

  group('Éditeur : format de l\'heure');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1200 });
    const r = await t.page.evaluate(() => {
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (ev) => { log.push(ev.detail.config); ed.setConfig(ev.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage'] });
      const sel = ed.shadowRoot.querySelector('[data-field="time_format"]');
      const r = { label: sel.closest('.field').querySelector('label').textContent, options: [...sel.options].map((o) => [o.value, o.textContent]), value: sel.value };
      sel.value = '12'; sel.dispatchEvent(new Event('change'));
      r.a = log[log.length - 1].time_format;
      const sel2 = ed.shadowRoot.querySelector('[data-field="time_format"]');
      sel2.value = '24'; sel2.dispatchEvent(new Event('change'));
      r.b = 'time_format' in log[log.length - 1];
      return r;
    });
    check('« Format de l\'heure » : 24 heures (défaut), 12 heures, Auto', r.label === 'Format de l\'heure' && JSON.stringify(r.options.map((o) => o[0])) === '["24","12","auto"]' && r.value === '24' && r.options[0][1].includes('défaut'), r);
    check('12 heures : time_format: "12" ; retour à 24 : clé retirée', r.a === '12' && r.b === false, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
