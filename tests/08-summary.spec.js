// Résumé : appui long sur le centre, fenêtre aux couleurs du thème, défilement, téléphone / tablette / PC
const LAYERS = [{ entity: 'schedule.chauffage', target: 'climate.salon' }, 'input_datetime.reveil', 'sensor.prochaine_alarme', 'calendar.famille'];

module.exports = async (browser, h) => {
  const { check, group } = h;
  const hold = async (page, ms = 700) => {
    const r = await page.evaluate(() => { const b = window.sr('a').querySelector('.center').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.2 }; });
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(80);
  };
  const info = (page) => page.evaluate(() => {
    const s = window.sr('a');
    const d = s.querySelector('.dlg');
    const r = d.getBoundingClientRect();
    const body = s.querySelector('.dlg-body');
    const cs = getComputedStyle(d);
    return {
      open: d.open, title: s.querySelector('.dlg-head h2').textContent,
      text: body.textContent.replace(/\s+/g, ' '),
      w: Math.round(r.width), hgt: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top),
      radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, fg: cs.color,
      scroll: body.scrollHeight > body.clientHeight + 2, overflow: getComputedStyle(body).overflowY,
      vw: window.innerWidth, vh: window.innerHeight,
    };
  });
  const setup = async (page, cfg = {}) => {
    await page.evaluate((cfg) => {
      window.__schedules[0].wednesday[1].data = { consigne: 20, temperature: 21 };
      window.mk('a', { layers: cfg.layers || window.__L, ...cfg });
    }, cfg);
    await page.waitForTimeout(200);
  };

  group('Résumé : ouverture et contenu');
  {
    const t = await h.open(browser, h.card('a'), { w: 1280, h: 800 });
    const { page } = t;
    await page.evaluate((L) => { window.__L = L; }, LAYERS);
    await setup(page);
    const p = await page.evaluate(() => { const b = window.sr('a').querySelector('.center').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 20 }; });
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(80);
    check('simple appui sur le centre : pas de résumé', !(await info(page)).open);
    await hold(page);
    await page.waitForTimeout(250);   // fin de l'animation d'ouverture
    let i = await info(page);
    check('appui long sur le centre : fenêtre « Résumé » ouverte', i.open && i.title.startsWith('Résumé') && i.title.includes('mercredi 4 novembre'), i.title);
    const days = await page.evaluate(() => [...window.sr('a').querySelectorAll('.sm-sec:first-child .sm-day')].map((d) => ({ today: d.classList.contains('today'), t: d.textContent.replace(/\s+/g, ' ').trim() })));
    check('planning : les 7 jours, aujourd\'hui (mercredi) mis en avant', days.length === 7 && days[2].today && days.filter((d) => d.today).length === 1, days);
    check('… plages et valeurs : « 17:00–22:30 21 °C », total du jour', days[2].t.includes('06:30–08:00') && days[2].t.includes('17:00–22:3021 °C') && days[2].t.includes('7 h'), days[2]);
    check('… jour vide : « Aucune plage » ; samedi jusqu\'à 24:00', days[1].t.includes('Aucune plage') && days[5].t.includes('08:00–24:00') && days[5].t.includes('16 h'), [days[1], days[5]]);
    check('… total de la semaine et appareil piloté', i.text.includes('sur la semaine') && i.text.includes('pilote Thermostat salon'), i.text);
    check('heure du réveil, alarme du téléphone (date), événement du calendrier', i.text.includes('07:30') && /mercredi 4 novembre.*06:15/.test(i.text) && i.text.includes('13:00–14:30Piscine'), i.text);
    check('réglages de la carte : pas, orientation, style, droits, soleil', i.text.includes('Pas de réglage15 min') && i.text.includes('Minuit en haut') && i.text.includes('Métal brossé')
      && i.text.includes('autorisée (administrateur)') && i.text.includes('lever 07:50 · coucher 17:20'), i.text);
    check('PC : fenêtre centrée, 640 px, coins arrondis', i.w === 640 && Math.abs(i.left - (i.vw - 640) / 2) <= 1 && i.radius === '24px' && i.hgt <= i.vh * 0.87, i);

    // Mise à jour en direct
    await page.evaluate(() => {
      const it = JSON.parse(JSON.stringify(window.__schedules[0]));
      it.tuesday = [{ from: '10:00:00', to: '11:00:00', data: { temperature: 18 } }];
      window.pushSchedules([{ change_type: 'updated', schedule_id: it.id, item: it }]);
    });
    await page.waitForTimeout(80);
    check('planning modifié ailleurs : le résumé ouvert se met à jour', (await info(page)).text.includes('10:00–11:0018 °C'));

    // Fermer : croix, Échap, fond
    await page.evaluate(() => window.sr('a').querySelector('.dlg-x').click());
    await page.waitForTimeout(60);
    check('croix en haut à droite : fermée', !(await info(page)).open);
    const xpos = await (async () => { await hold(page); return page.evaluate(() => { const s = window.sr('a'); const d = s.querySelector('.dlg').getBoundingClientRect(); const x = s.querySelector('.dlg-x').getBoundingClientRect(); return { right: d.right - x.right, top: x.top - d.top, label: s.querySelector('.dlg-x').getAttribute('aria-label') }; }); })();
    check('… la croix est bien en haut à droite, avec un libellé', xpos.right < 20 && xpos.top < 24 && xpos.label === 'Fermer', xpos);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    check('touche Échap : fermée', !(await info(page)).open);
    await hold(page);
    await page.waitForTimeout(450);
    await page.mouse.click(10, 10);
    await page.waitForTimeout(60);
    check('clic sur le fond : fermée', !(await info(page)).open);

    // Touches du cadran inactives pendant le résumé
    await page.evaluate(() => { const el = document.getElementById('a'); el._sel = { li: 0, i: 1 }; el._render(); });
    await hold(page);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(60);
    check('Suppr dans le résumé : aucune plage supprimée', (await h.ws(page, 'schedule/update')).length === 0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const el = document.getElementById('a'); el._sel = null; el._render(); });

    // Clavier
    await page.evaluate(() => window.sr('a').querySelector('.center').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
    const kb = await page.evaluate(() => ({ open: window.sr('a').querySelector('.dlg').open, focus: window.sr('a').activeElement && window.sr('a').activeElement.className, role: window.sr('a').querySelector('.center').getAttribute('role') }));
    check('clavier : Entrée sur le centre ouvre le résumé, focus sur la croix', kb.open && kb.focus === 'dlg-x' && kb.role === 'button', kb);
    await page.keyboard.press('Escape');

    // Option désactivée
    await setup(page, { summary: false });
    await hold(page);
    const off = await page.evaluate(() => ({ open: window.sr('a').querySelector('.dlg').open, tab: window.sr('a').querySelector('.center').hasAttribute('tabindex') }));
    check('summary: false : pas de résumé, centre non focalisable', !off.open && !off.tab, off);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Résumé : téléphone, tablette, défilement');
  {
    const many = ['schedule.chauffage', 'schedule.volets', 'input_datetime.reveil', 'time.arrosage', 'sensor.prochaine_alarme', 'calendar.famille'];
    const t = await h.open(browser, h.card('a', 360), { w: 390, h: 844, touch: true });
    const { page } = t;
    await setup(page, { layers: many });
    const cdp = await t.ctx.newCDPSession(page);
    const c = await page.evaluate(() => { const b = window.sr('a').querySelector('.center').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 15 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const i = await info(page);
    check('doigt : appui long ouvre le résumé (retour haptique)', i.open && (await page.evaluate(() => window.__haptics)).includes('medium'), i.open);
    check('téléphone : plein écran, sans coins arrondis', i.w === 390 && i.hgt === 844 && i.left === 0 && i.top === 0 && i.radius === '0px', i);
    check('beaucoup d\'infos : la fenêtre défile', i.scroll && i.overflow === 'auto', i);
    await page.evaluate(() => { window.sr('a').querySelector('.dlg-body').scrollTop = 99999; });
    const end = await page.evaluate(() => { const b = window.sr('a').querySelector('.dlg-body'); const r = b.lastElementChild.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && b.scrollTop > 0; });
    check('… jusqu\'en bas (réglages visibles)', end);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(80);
    const land = await info(page);
    check('téléphone à l\'horizontale : plein écran aussi', land.w === 844 && land.hgt === 390, land);
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(80);
    const tab = await info(page);
    check('tablette : fenêtre centrée de 640 px, hauteur limitée', tab.w === 640 && tab.hgt <= 1180 * 0.87 && tab.radius === '24px', tab);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Résumé : thèmes');
  {
    const cases = [
      ['thème HA sombre (auto)', { theme: 'dark' }, {}, 'rgb(28, 31, 38)', 'rgb(225, 225, 225)'],
      ['thème HA clair (auto)', { theme: 'light' }, {}, 'rgb(255, 255, 255)', 'rgb(33, 33, 33)'],
      ['thème « Sombre » choisi, HA clair', { theme: 'light' }, { theme: 'dark' }, 'rgb(28, 31, 38)', 'rgb(236, 239, 244)'],
      ['thème « Clair » choisi, HA sombre', { theme: 'dark' }, { theme: 'light' }, 'rgb(255, 255, 255)', 'rgb(28, 31, 38)'],
    ];
    for (const [label, o, cfg, bg, fg] of cases) {
      const t = await h.open(browser, h.card('a'), { w: 1000, h: 800, ...o });
      await setup(t.page, { layers: ['schedule.chauffage'], ...cfg });
      await hold(t.page);
      await t.page.waitForTimeout(250);
      const i = await info(t.page);
      check(`${label} : fond et texte`, i.open && i.bg === bg && i.fg === fg, i);
      await t.close();
    }
    const t = await h.open(browser, h.card('a'), { w: 1000, h: 800 });
    await setup(t.page, { layers: ['schedule.chauffage'] });
    await t.page.evaluate(() => {
      const el = document.getElementById('a');
      el.style.setProperty('--ha-dialog-surface-background', 'rgb(10, 20, 30)');
      el.style.setProperty('--primary-color', 'rgb(200, 100, 0)');
    });
    await hold(t.page);
    const r = await t.page.evaluate(() => ({ bg: getComputedStyle(window.sr('a').querySelector('.dlg')).backgroundColor, today: getComputedStyle(window.sr('a').querySelector('.sm-day.today .sm-dn')).color }));
    check('variables du thème : fond des fenêtres HA et couleur principale', r.bg === 'rgb(10, 20, 30)' && r.today === 'rgb(200, 100, 0)', r);
    await t.close();
  }

  group('Résumé : anglais, lecture seule, éditeur');
  {
    const t = await h.open(browser, h.card('a'), { lang: 'en', admin: false, w: 1000, h: 800 });
    await t.page.evaluate((L) => { window.__L = L; }, LAYERS);
    await setup(t.page);
    await hold(t.page);
    const i = await info(t.page);
    check('anglais : « Summary », jours, « read only »', i.title.startsWith('Summary') && i.title.includes('Wednesday, November 4') && i.text.includes('Monday') && i.text.includes('read only'), { title: i.title, text: i.text.slice(0, 300) });
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
    const e = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const r = await e.page.evaluate(() => {
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (ev) => { log.push(ev.detail.config); ed.setConfig(ev.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage'] });
      const box = ed.shadowRoot.querySelector('[data-field="summary"]');
      const label = box.closest('label').textContent.trim();
      const on = box.checked;
      box.checked = false; box.dispatchEvent(new Event('change'));
      const a = log[log.length - 1].summary;
      const box2 = ed.shadowRoot.querySelector('[data-field="summary"]');
      box2.checked = true; box2.dispatchEvent(new Event('change'));
      return { label, on, a, b: 'summary' in log[log.length - 1] };
    });
    check('éditeur : case « Résumé par appui long sur le centre », cochée par défaut', r.label === 'Résumé par appui long sur le centre' && r.on, r);
    check('… décochée : summary: false ; recochée : clé retirée', r.a === false && r.b === false, r);
    check('éditeur : aucune erreur JS', e.errors.length === 0, e.errors);
    await e.close();
  }
};
