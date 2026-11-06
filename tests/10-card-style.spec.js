// Apparence de la carte (card_style, card_background, card_border_color), comme Radial Selector Card
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Fond et contour de la carte');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    const look = (cfg) => page.evaluate((cfg) => {
      window.mk('a', { layers: ['schedule.chauffage'], ...cfg });
      const card = window.sr('a').querySelector('ha-card');
      const cs = getComputedStyle(card);
      return { bg: cs.backgroundColor, bw: cs.borderTopWidth, bc: cs.borderTopColor, shadow: cs.boxShadow, style: card.getAttribute('style') };
    }, cfg);
    const def = await look({});
    check('par défaut : fond et contour du thème (apparence inchangée)', def.bg === 'rgb(28, 31, 38)' && def.bw === '1px' && def.style === '', def);
    const tr = await look({ card_style: 'transparent' });
    check('transparent : ni fond, ni contour, ni ombre', tr.bg === 'rgba(0, 0, 0, 0)' && tr.bw === '0px' && tr.shadow === 'none', tr);
    const bo = await look({ card_style: 'border_only', card_border_color: '#ff0000', card_background: '#00ff00' });
    check('border_only : contour (couleur choisie), sans fond', bo.bg === 'rgba(0, 0, 0, 0)' && bo.bw === '1px' && bo.bc === 'rgb(255, 0, 0)', bo);
    const bg = await look({ card_style: 'background_only', card_background: 'rgb(10, 20, 30)', card_border_color: '#ff0000' });
    check('background_only : fond (couleur choisie), sans contour', bg.bg === 'rgb(10, 20, 30)' && bg.bw === '0px', bg);
    const st = await look({ card_style: 'standard', card_background: '#123456', card_border_color: 'var(--primary-color)' });
    check('standard + couleurs : fond et contour choisis (variables CSS acceptées)', st.bg === 'rgb(18, 52, 86)' && st.bc === 'rgb(3, 169, 244)' && st.bw === '1px', st);
    const bad = await look({ card_background: 'red;--ha-card-border-width:9px"><b>x' });
    check('couleur piégée ou invalide : ignorée, fond du thème, rien d\'injecté', bad.style === '' && bad.bg === 'rgb(28, 31, 38)' && bad.bw === '1px' && (await page.evaluate(() => { const c = window.sr('a').querySelectorAll('ha-card'); return c.length === 1 && [...c[0].attributes].map((x) => x.name).join() === 'style'; })), bad);
    const theme = await page.evaluate(() => {
      window.mk('a', { layers: ['schedule.chauffage'], card_style: 'transparent' });
      document.getElementById('a').style.setProperty('--card-background-color', 'rgb(1, 2, 3)');
      const r = getComputedStyle(window.sr('a').querySelector('ha-card')).backgroundColor;
      document.getElementById('a').style.removeProperty('--card-background-color');
      return r;
    });
    check('transparent reste transparent quel que soit le thème', theme === 'rgba(0, 0, 0, 0)', theme);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : apparence de la carte');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1200 });
    const r = await t.page.evaluate(() => {
      const ed = document.createElement('day-wheel-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:day-wheel-card', layers: ['schedule.chauffage'] });
      const $ = (q) => ed.shadowRoot.querySelector(q);
      const fields = () => ({ bg: !!$('[data-field="card_background"]'), border: !!$('[data-field="card_border_color"]') });
      const titles = [...ed.shadowRoot.querySelectorAll('.section-title')].map((x) => x.textContent);
      const sel = $('[data-field="card_style"]');
      const r = { titles, options: [...sel.options].map((o) => [o.value, o.textContent]), value: sel.value, f0: fields() };
      sel.value = 'transparent'; sel.dispatchEvent(new Event('change'));
      r.a = log[log.length - 1].card_style; r.f1 = fields();
      const sel2 = $('[data-field="card_style"]');
      sel2.value = 'background_only'; sel2.dispatchEvent(new Event('change'));
      r.f2 = fields();
      const sw = $('[data-gswatch="card_background"]');
      sw.value = '#336699'; sw.dispatchEvent(new Event('change'));
      r.b = log[log.length - 1].card_background; r.txt = $('[data-field="card_background"]').value;
      $('[data-gclear="card_background"]').click();
      r.c = 'card_background' in log[log.length - 1];
      const sel3 = $('[data-field="card_style"]');
      sel3.value = 'standard'; sel3.dispatchEvent(new Event('change'));
      r.d = 'card_style' in log[log.length - 1]; r.f3 = fields();
      return r;
    });
    check('section « Apparence de la carte » avec les 4 choix, « Fond + contour » par défaut', r.titles.includes('Apparence de la carte')
      && JSON.stringify(r.options.map((o) => o[0])) === '["standard","border_only","background_only","transparent"]' && r.value === 'standard' && r.f0.bg && r.f0.border, r);
    check('transparente : card_style: transparent, pas de champ de couleur', r.a === 'transparent' && !r.f1.bg && !r.f1.border, r);
    check('fond sans contour : seulement la couleur du fond', r.f2.bg && !r.f2.border, r);
    check('nuancier : card_background choisi ; ✕ : retiré (couleur du thème)', r.b === '#336699' && r.txt === '#336699' && r.c === false, r);
    check('retour au défaut : clé retirée, deux couleurs proposées', r.d === false && r.f3.bg && r.f3.border, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
