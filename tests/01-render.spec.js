// Affichage : anneaux, fuseau du serveur, aiguille, soleil, jours, centre, légende, orientation
const LAYERS = [
  { entity: 'schedule.chauffage', color: '#ff7043' },
  { entity: 'schedule.volets', color: '#4fc3f7' },
  { entity: 'input_datetime.reveil', color: '#ffd54f' },
  { entity: 'calendar.famille', color: '#ba68c8' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;
  const read = (page) => page.evaluate(() => {
    const s = window.sr('a');
    const arcs = [...s.querySelectorAll('path.arc')].map((p) => ({ li: Number(p.dataset.li), t: p.querySelector('title').textContent }));
    return {
      arcs,
      markers: [...s.querySelectorAll('.marker')].map((g) => g.querySelector('title').textContent),
      hand: !!s.querySelector('.hand'),
      big: (s.querySelector('.c-big') || {}).textContent,
      day: (s.querySelector('.c-day') || {}).textContent || '',
      lines: [...s.querySelectorAll('.c-line')].map((l) => l.getAttribute('title') || l.textContent),
      days: [...s.querySelectorAll('.day')].map((d) => d.className),
      legend: [...s.querySelectorAll('.lg')].map((l) => l.textContent.trim()),
      night: !!s.querySelector('.nightband'),
      aria: s.querySelector('svg').getAttribute('aria-label'),
    };
  });

  group('Affichage du jour');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await page.evaluate((layers) => window.mk('a', { layers }), LAYERS);
    await page.waitForTimeout(250);
    const r = await read(page);
    check('heure du serveur (Europe/Paris) et non du navigateur (New York) : 10:00', r.big === '10:00' && r.day === 'Aujourd\'hui', r);
    const by = (li) => r.arcs.filter((a) => a.li === li).map((a) => a.t);
    check('planning du mercredi : 06:30 – 08:00 et 17:00 – 22:30', JSON.stringify(by(0)) === JSON.stringify(['06:30 – 08:00', '17:00 – 22:30']), by(0));
    check('2e planning : 07:45 – 19:00', JSON.stringify(by(1)) === JSON.stringify(['07:45 – 19:00']), by(1));
    check('calendrier : Piscine 13:00 – 14:30, veille coupée à minuit, journée entière ignorée',
      JSON.stringify(by(3).sort()) === JSON.stringify(['Piscine · 13:00 – 14:30', 'Veille · 00:00 – 01:00']), by(3));
    check('repère du réveil à 07:30', r.markers.length === 1 && r.markers[0] === 'Réveil · 07:30', r.markers);
    check('aiguille de l\'heure actuelle', r.hand);
    check('nuit (coucher → lever du soleil) affichée', r.night);
    check('centre : chauffage à 17:00, volets jusqu\'à 19:00, famille à 13:00',
      r.lines.includes('Chauffage · à 17:00') && r.lines.includes('Volets · jusqu\'à 19:00') && r.lines.includes('Famille · à 13:00'), r.lines);
    check('jours : 7, mercredi choisi et marqué « aujourd\'hui »', r.days.length === 7 && r.days[2].includes('sel') && r.days[2].includes('today'), r.days);
    check('légende des 4 anneaux', JSON.stringify(r.legend) === JSON.stringify(['Chauffage', 'Volets', 'Réveil', 'Famille']), r.legend);
    check('description accessible du cadran', r.aria.startsWith('Aujourd\'hui') && r.aria.includes('Chauffage'), r.aria);
    const ws = await h.ws(page);
    check('plannings lus par abonnement (schedule/subscribe) et registre des entités', ws.some((m) => m.type === 'schedule/subscribe') && ws.some((m) => m.type === 'config/entity_registry/get' && m.entity_id === 'schedule.chauffage'), ws);
    const api = await page.evaluate(() => window.__api);
    check('calendrier demandé pour le 4 novembre', api.length === 1 && api[0].path.startsWith('calendars/calendar.famille?start=2026-11-04T00%3A00%3A00'), api);

    // Autre jour
    await page.evaluate(() => window.sr('a').querySelector('[data-day="3"]').click());
    await page.waitForTimeout(150);
    const j = await read(page);
    check('jeudi : plage 07:00 – 09:00, sans aiguille', JSON.stringify(j.arcs.filter((a) => a.li === 0).map((a) => a.t)) === JSON.stringify(['07:00 – 09:00']) && !j.hand, j);
    check('jeudi : centre « Jeudi », « Demain »', j.big === 'Jeudi' && j.day === 'Demain', j);
    check('jeudi : calendrier relu pour le 5 novembre', (await page.evaluate(() => window.__api.map((a) => a.path))).some((p) => p.includes('2026-11-05')));
    await page.evaluate(() => window.sr('a').querySelector('[data-day="2"]').click());
    await page.waitForTimeout(100);
    check('retour à aujourd\'hui', (await read(page)).hand);

    // Mise à jour en direct d'un planning
    await page.evaluate(() => {
      const it = JSON.parse(JSON.stringify(window.__schedules[1]));
      it.wednesday = [{ from: '08:00:00', to: '18:00:00' }];
      window.pushSchedules([{ change_type: 'updated', schedule_id: it.id, item: it }]);
    });
    await page.waitForTimeout(60);
    check('planning modifié ailleurs : mis à jour en direct', (await read(page)).arcs.some((a) => a.li === 1 && a.t === '08:00 – 18:00'));
    await page.evaluate(() => window.pushSchedules([{ change_type: 'removed', schedule_id: 'volets', item: window.__schedules[1] }]));
    await page.waitForTimeout(60);
    check('planning supprimé ailleurs : son anneau se vide', !(await read(page)).arcs.some((a) => a.li === 1));
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Heures et repères');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await page.evaluate(() => window.mk('a', { layers: ['input_datetime.rdv', 'time.arrosage', 'sensor.prochaine_alarme', 'input_datetime.reveil'], show_sun: false }));
    await page.waitForTimeout(150);
    const r = await read(page);
    check('date + heure, heure d\'appareil, horodatage (06:15 à Paris), heure seule',
      JSON.stringify(r.markers) === JSON.stringify(['Rendez-vous · 15:00', 'Arrosage · 20:00', 'Alarme téléphone · 06:15', 'Réveil · 07:30']), r.markers);
    check('sans planning ni calendrier : pas de jours', r.days.length === 0 || (await page.evaluate(() => window.sr('a').querySelector('.days').style.display)) === 'none');
    check('show_sun: false : pas de nuit', !r.night);
    check('centre : prochains repères (rendez-vous, arrosage)', r.lines.includes('Rendez-vous · 15:00') && r.lines.includes('Arrosage · 20:00') && !r.lines.some((l) => l.includes('06:15')), r.lines);
    await page.evaluate(() => window.setState('input_datetime.rdv', '2026-11-06 09:00:00'));
    await page.waitForTimeout(60);
    check('rendez-vous un autre jour : masqué aujourd\'hui', !(await read(page)).markers.some((m) => m.startsWith('Rendez-vous')));
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Orientation, thèmes, langue');
  {
    const t = await h.open(browser, `<div style="display:flex;flex-wrap:wrap">${['a', 'b'].map((id) => h.card(id, 320)).join('')}</div>`, { w: 720, lang: 'en', theme: 'light' });
    const { page } = t;
    const r = await page.evaluate(() => {
      window.mk('a', { layers: ['schedule.chauffage'], orientation: 'noon_top', knob_theme: 'brass', theme: 'light' });
      window.mk('b', { layers: ['schedule.chauffage', 'schedule.yaml_only', 'light.inconnue'], knob_theme: 'nope' });
      const top = (id) => {
        const hours = [...window.sr(id).querySelectorAll('text.hour')];
        hours.sort((x, y) => Number(x.getAttribute('y')) - Number(y.getAttribute('y')));
        return hours[0].textContent;
      };
      return {
        topA: top('a'), topB: top('b'),
        skinA: window.sr('a').querySelector('.wrap').className, skinB: window.sr('b').querySelector('.wrap').className,
        day: window.sr('a').querySelector('.c-day').textContent,
        days: [...window.sr('a').querySelectorAll('.day')].map((d) => d.textContent).join(''),
      };
    });
    check('noon_top : midi en haut ; défaut : minuit en haut', r.topA === '12' && r.topB === '0', r);
    check('thème laiton ; thème inconnu = métal', r.skinA.includes('skin-brass') && r.skinB.includes('skin-metal'), r);
    check('anglais : « Today », jours M T W T F S S', r.day === 'Today' && r.days === 'MTWTFSS', r);
    const err = await page.evaluate(() => {
      const out = [];
      const el = document.getElementById('a');
      try { el.setConfig({ layers: [] }); } catch (e) { out.push(e.message); }
      try { el.setConfig({ layers: ['a.a', 'b.b', 'c.c', 'd.d', 'e.e', 'f.f', 'g.g'] }); } catch (e) { out.push(e.message); }
      return out;
    });
    check('0 ou 7 anneaux : erreur de configuration explicite', err.length === 2 && err[0].includes('1 to 6'), err);
    check('entité non prise en charge ou planning YAML : pas d\'erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
