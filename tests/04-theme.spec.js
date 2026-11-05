// Suivi du thème Home Assistant : style de centre « ha » (cadran entier) et palette « theme » (anneaux)
const LAYERS = ['schedule.chauffage', 'schedule.volets', 'input_datetime.reveil', 'calendar.famille'];
// Couleurs d'un thème (Radial Nord, sombre)
const NORD = '--primary-color:#8fbcbb;--accent-color:#8fbcbb;--success-color:#a3be8c;--warning-color:#d08770;--info-color:#88c0d0;--error-color:#f6929a;'
  + '--primary-text-color:#eceff4;--secondary-text-color:#b9c2d1;--card-background-color:#3b4252;--secondary-background-color:#353c4a;'
  + '--primary-background-color:#2e3440;--divider-color:rgba(216,222,233,.12)';

module.exports = async (browser, h) => {
  const { check, group } = h;
  const body = `<div id="theme" style="${NORD}"><div style="display:flex">${h.card('a', 360)}${h.card('b', 360)}</div></div>`;

  group('Style « ha » : cadran aux couleurs du thème');
  {
    const t = await h.open(browser, body, { w: 780 });
    const { page } = t;
    const r = await page.evaluate((layers) => {
      window.mk('a', { layers });
      window.mk('b', { layers, knob_theme: 'ha' });
      const css = (id, sel, prop) => getComputedStyle(window.sr(id).querySelector(sel))[prop];
      return {
        faceMetal: css('a', '.face', 'fill'), faceHa: css('b', '.face', 'fill'),
        trackMetal: css('a', '.track', 'stroke'), trackHa: css('b', '.track', 'stroke'),
        tickHa: css('b', '.tick', 'stroke'), sunHa: css('b', '.sunmark', 'fill'),
        handHa: css('b', '.hand', 'stroke'),
      };
    }, LAYERS);
    check('cadran : couleur secondaire du thème (métal : gris de la carte)', r.faceHa === 'rgb(53, 60, 74)' && r.faceMetal !== r.faceHa, r);
    check('anneaux vides, graduations, soleil, aiguille : tirés du thème', r.trackHa !== r.trackMetal && r.tickHa === 'rgb(185, 194, 209)' && r.sunHa === 'rgb(208, 135, 112)' && r.handHa === 'rgb(143, 188, 187)', r);
    // Changement de thème à chaud : la carte suit sans être reconstruite
    const live = await page.evaluate(() => {
      const before = window.sr('b').querySelector('.face');
      document.getElementById('theme').style.setProperty('--secondary-background-color', '#ffffff');
      return { same: before === window.sr('b').querySelector('.face'), face: getComputedStyle(before).fill };
    });
    check('changement de thème : suivi immédiat, sans reconstruire la carte', live.same && live.face === 'rgb(255, 255, 255)', live);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Palette « theme » : anneaux aux couleurs du thème');
  {
    const t = await h.open(browser, body, { w: 780 });
    const { page } = t;
    const r = await page.evaluate((layers) => {
      window.mk('a', { layers });
      window.mk('b', { layers: [...layers.slice(0, 3), { entity: 'calendar.famille', color: '#123456' }], palette: 'theme' });
      const s = (id) => window.sr(id);
      const stroke = (id, li) => getComputedStyle(s(id).querySelector(`path.arc[data-li="${li}"]`)).stroke;
      return new Promise((res) => setTimeout(() => res({
        a0: stroke('a', 0), b0: stroke('b', 0), b1: stroke('b', 1), b3: stroke('b', 3),
        marker: getComputedStyle(s('b').querySelector('.marker .m-dot')).fill,
        legend: getComputedStyle(s('b').querySelector('.lg ha-icon')).color,
      }), 200));
    }, LAYERS);
    check('par défaut : palette de la carte (orange)', r.a0 === 'rgb(255, 138, 101)', r);
    check('palette: theme : couleur principale, succès, avertissement…', r.b0 === 'rgb(143, 188, 187)' && r.b1 === 'rgb(163, 190, 140)' && r.marker === 'rgb(208, 135, 112)', r);
    check('… couleur choisie à la main conservée, légende assortie', r.b3 === 'rgb(18, 52, 86)' && r.legend === 'rgb(143, 188, 187)', r);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : palette');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const { page } = t;
    const r = await page.evaluate(() => {
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage', { entity: 'schedule.volets', color: '#ff0000' }] });
      const $ = (q) => ed.shadowRoot.querySelector(q);
      const opts = [...$('[data-field="palette"]').options].map((o) => o.textContent);
      const sel = $('[data-field="palette"]'); sel.value = 'theme'; sel.dispatchEvent(new Event('change'));
      const a = log[log.length - 1].palette;
      const placeholder = $('[data-layer="0"] [data-lfield="color"]').placeholder;
      const dot = $('[data-layer="0"] .layer-head i').getAttribute('style');
      const sel2 = $('[data-field="palette"]'); sel2.value = 'default'; sel2.dispatchEvent(new Event('change'));
      return { opts, a, placeholder, dot, b: 'palette' in log[log.length - 1] };
    });
    check('choix « Palette de la carte (défaut) » / « Couleurs du thème HA »', JSON.stringify(r.opts) === JSON.stringify(['Palette de la carte (défaut)', 'Couleurs du thème HA']), r);
    check('palette: theme écrit, pastille et indication « Thème HA » sur les anneaux', r.a === 'theme' && r.placeholder === 'Thème HA' && r.dot.includes('var(--primary-color'), r);
    check('retour au défaut : la clé est retirée', r.b === false, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
