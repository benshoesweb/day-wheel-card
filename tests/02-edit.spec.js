// Modifications : glisser les extrémités, déplacer, créer, supprimer, limites, repères, droits, erreurs
const LAYERS = [{ entity: 'schedule.chauffage' }, { entity: 'input_datetime.reveil' }, { entity: 'time.arrosage' }];
const M = (hh, mm = 0) => hh * 60 + mm;

module.exports = async (browser, h) => {
  const { check, group } = h;
  const lastUpdate = async (page) => (await h.ws(page, 'schedule/update')).pop();
  const fresh = async (page, cfg = {}) => {
    await page.evaluate(({ layers, cfg }) => {
      window.__ws = []; window.__calls = [];
      window.__schedules = window.__schedulesOrig || (window.__schedulesOrig = JSON.parse(JSON.stringify(window.__schedules)));
      window.__schedules = JSON.parse(JSON.stringify(window.__schedulesOrig));
      // Remise à zéro reçue par l'abonnement, comme si le planning avait été rétabli ailleurs
      window.pushSchedules(window.__schedules.map((item) => ({ change_type: 'updated', schedule_id: item.id, item })));
      const el = document.getElementById('a');
      el._day = null; el._sel = null;    // la même configuration garde le jour affiché : on repart d'aujourd'hui
      window.mk('a', { layers, ...cfg });
    }, { layers: LAYERS, cfg });
    await page.waitForTimeout(200);
  };
  const arcs = (page) => page.evaluate(() => [...window.sr('a').querySelectorAll('path.arc[data-li="0"]')].map((p) => p.querySelector('title').textContent));

  group('Plages du planning');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await fresh(page);

    await h.drag(page, 'a', 0, M(22, 30), M(23, 30));
    let u = await lastUpdate(page);
    check('fin glissée de 22:30 à 23:30 : schedule/update', u && u.schedule_id === 'chauffage_id' && JSON.stringify(u.wednesday) === JSON.stringify([
      { from: '06:30:00', to: '08:00:00' }, { from: '17:00:00', to: '23:30:00', data: { consigne: 20 } }]), u);
    check('… les autres jours, le nom et l\'icône sont conservés (24:00:00 compris)', u && u.name === 'Chauffage' && u.icon === 'mdi:radiator'
      && JSON.stringify(u.saturday) === JSON.stringify([{ from: '08:00:00', to: '24:00:00' }]) && u.thursday.length === 1 && u.tuesday.length === 0, u);
    await page.waitForTimeout(60);
    check('affichage à jour', (await arcs(page)).includes('17:00 – 23:30'), await arcs(page));

    await fresh(page);
    await h.drag(page, 'a', 0, M(17), M(15, 50));
    u = await lastUpdate(page);
    check('début glissé de 17:00 à 15:45 (pas de 15 min)', u && u.wednesday[1].from === '15:45:00' && u.wednesday[1].to === '22:30:00', u && u.wednesday);

    await fresh(page);
    await h.drag(page, 'a', 0, M(7, 15), M(8, 15));
    u = await lastUpdate(page);
    check('plage déplacée d\'une heure : 07:30 – 09:00', u && u.wednesday[0].from === '07:30:00' && u.wednesday[0].to === '09:00:00', u && u.wednesday);

    await fresh(page);
    await h.drag(page, 'a', 0, M(8), M(19), 30);
    u = await lastUpdate(page);
    check('fin bloquée par la plage suivante (17:00)', u && u.wednesday[0].to === '17:00:00' && u.wednesday[1].from === '17:00:00', u && u.wednesday);

    await fresh(page);
    await h.drag(page, 'a', 0, M(17), M(23, 59), 20);
    u = await lastUpdate(page);
    check('début bloqué un pas avant la fin', u && u.wednesday[1].from === '22:15:00', u && u.wednesday);

    await fresh(page);
    await h.drag(page, 'a', 0, M(19), M(23, 50), 20);
    u = await lastUpdate(page);
    check('déplacement bloqué à minuit (pas de passage au jour suivant)', u && u.wednesday[1].from === '18:30:00' && u.wednesday[1].to === '24:00:00', u && u.wednesday);

    await fresh(page, { snap: 30 });
    await h.drag(page, 'a', 0, M(22, 30), M(23, 10));
    u = await lastUpdate(page);
    check('snap: 30 : 23:10 arrondi à 23:00', u && u.wednesday[1].to === '23:00:00', u && u.wednesday);

    // Choisir puis supprimer
    await fresh(page);
    let p = await h.point(page, 'a', 0, M(19));
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
    const sel = await page.evaluate(() => ({ big: window.sr('a').querySelector('.c-big').textContent, del: !!window.sr('a').querySelector('[data-act="delete"]'), handles: window.sr('a').querySelectorAll('.handle').length }));
    check('appui sur une plage : heures au centre, poignées et corbeille', sel.big.includes('17:00') && sel.big.includes('22:30') && sel.del && sel.handles === 2, sel);
    await page.evaluate(() => window.sr('a').querySelector('[data-act="delete"]').click());
    await page.waitForTimeout(60);
    u = await lastUpdate(page);
    check('corbeille : la plage est supprimée', u && JSON.stringify(u.wednesday) === JSON.stringify([{ from: '06:30:00', to: '08:00:00' }]), u && u.wednesday);

    await fresh(page);
    p = await h.point(page, 'a', 0, M(7, 15));
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(60);
    u = await lastUpdate(page);
    check('touche Suppr : la plage choisie est supprimée', u && JSON.stringify(u.wednesday.map((b) => b.from)) === JSON.stringify(['17:00:00']), u && u.wednesday);

    // Nouvelle plage (appui long sur un vide)
    await fresh(page);
    p = await h.point(page, 'a', 0, M(12));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(60);
    u = await lastUpdate(page);
    check('appui long sur un vide : nouvelle plage 11:30 – 12:30', u && JSON.stringify(u.wednesday.map((b) => [b.from, b.to])) === JSON.stringify([['06:30:00', '08:00:00'], ['11:30:00', '12:30:00'], ['17:00:00', '22:30:00']]), u && u.wednesday);
    check('… et elle est choisie', await page.evaluate(() => window.sr('a').querySelector('.c-big').textContent.includes('11:30')));

    await fresh(page);
    p = await h.point(page, 'a', 0, M(16, 30));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(60);
    u = await lastUpdate(page);
    check('nouvelle plage collée à la suivante : 16:00 – 17:00', u && u.wednesday[1].from === '16:00:00' && u.wednesday[1].to === '17:00:00', u && u.wednesday);

    // Autre jour : c'est ce jour-là qui est modifié
    await fresh(page);
    await page.evaluate(() => window.sr('a').querySelector('[data-day="3"]').click());
    await page.waitForTimeout(60);
    await h.drag(page, 'a', 0, M(9), M(10));
    u = await lastUpdate(page);
    check('jeudi affiché : seul le jeudi change', u && u.thursday[0].to === '10:00:00' && u.wednesday.length === 2, u);

    // Échec de l'enregistrement
    await fresh(page);
    await page.evaluate(() => { window.__failUpdate = true; });
    await h.drag(page, 'a', 0, M(22, 30), M(23, 30));
    await page.waitForTimeout(80);
    const fail = await page.evaluate(() => ({ err: (window.sr('a').querySelector('.c-err') || {}).textContent, arcs: [...window.sr('a').querySelectorAll('path.arc[data-li="0"]')].map((p) => p.querySelector('title').textContent) }));
    check('refus de Home Assistant : message et plage rétablie', fail.err && fail.err.includes('Échec') && fail.arcs.includes('17:00 – 22:30'), fail);
    await page.evaluate(() => { window.__failUpdate = false; });
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Au doigt');
  {
    const t = await h.open(browser, h.card('a'), { touch: true });
    const { page } = t;
    await fresh(page);
    const cdp = await t.ctx.newCDPSession(page);
    const tp = (p) => [{ x: p.x, y: p.y }];
    let p = await h.point(page, 'a', 0, M(22, 30));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(p) });
    for (let k = 1; k <= 10; k += 1) {
      p = await h.point(page, 'a', 0, M(22, 30) + k * 6);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(80);
    const u = await lastUpdate(page);
    check('doigt : fin glissée à 23:30', u && u.wednesday[1].to === '23:30:00', u && u.wednesday);
    const hp = await page.evaluate(() => window.__haptics);
    check('retour haptique à chaque cran', hp.filter((x) => x === 'selection').length >= 3, hp);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Repères d\'heure');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await fresh(page);
    await h.drag(page, 'a', 1, M(7, 30), M(8, 15));
    let c = (await h.calls(page)).pop();
    check('réveil glissé à 08:15 : input_datetime.set_datetime', c && c.domain === 'input_datetime' && c.service === 'set_datetime' && c.data.time === '08:15:00' && c.data.entity_id === 'input_datetime.reveil', c);
    await h.drag(page, 'a', 2, M(20), M(21, 30));
    c = (await h.calls(page)).pop();
    check('arrosage glissé à 21:30 : time.set_value', c && c.domain === 'time' && c.service === 'set_value' && c.data.time === '21:30:00', c);
    await page.evaluate(() => { window.__calls = []; window.mk('a', { layers: ['input_datetime.rdv', 'sensor.prochaine_alarme'] }); });
    await page.waitForTimeout(100);
    await h.drag(page, 'a', 0, M(15), M(16));
    c = (await h.calls(page)).pop();
    check('date + heure : datetime du jour affiché', c && c.data.datetime === '2026-11-04 16:00:00', c);
    await h.drag(page, 'a', 1, M(6, 15), M(8));
    check('capteur horodatage : lecture seule', (await h.calls(page)).length === 1);
    await h.drag(page, 'a', 0, M(10), M(11));
    check('glisser loin du repère : rien', (await h.calls(page)).length === 1);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Utilisateur non administrateur');
  {
    const t = await h.open(browser, h.card('a'), { admin: false });
    const { page } = t;
    await fresh(page);
    await h.drag(page, 'a', 0, M(22, 30), M(23, 30));
    const p = await h.point(page, 'a', 0, M(12));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    check('ni glisser ni créer : aucune modification', (await h.ws(page, 'schedule/update')).length === 0);
    const q = await h.point(page, 'a', 0, M(19));
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => ({ hint: window.sr('a').querySelector('.c-hint').textContent, del: !!window.sr('a').querySelector('[data-act="delete"]') }));
    check('appui : heures affichées, « réservé aux administrateurs », pas de corbeille', r.hint.includes('administrateurs') && !r.del, r);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
