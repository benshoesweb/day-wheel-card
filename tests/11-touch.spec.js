// Pas de carré au toucher (surbrillance des navigateurs mobiles) ; anneaux de focus ronds, au clavier seulement
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Toucher : pas de carré autour du centre');
  {
    const t = await h.open(browser, h.card('a', 360), { w: 390, h: 700, touch: true });
    const { page } = t;
    await page.evaluate(() => window.mk('a', { layers: [{ entity: 'schedule.chauffage', target: 'climate.salon' }, 'input_datetime.reveil'] }));
    await page.waitForTimeout(200);
    const hl = await page.evaluate(() => {
      const s = window.sr('a');
      const el = document.getElementById('a');
      el._sel = { li: 0, i: 1 }; el._render();
      const q = ['.center', 'svg', '.c-btn', '.day', '.lg', '.dlg', '.dlg-x'];
      const r = Object.fromEntries(q.map((k) => [k, s.querySelector(k) ? getComputedStyle(s.querySelector(k)).webkitTapHighlightColor : 'absent']));
      el._sel = null; el._render();
      return r;
    });
    check('aucune surbrillance au toucher : centre, cadran, boutons, jours, légende, résumé', Object.values(hl).every((v) => v === 'rgba(0, 0, 0, 0)'), hl);
    const cdp = await t.ctx.newCDPSession(page);
    const c = await page.evaluate(() => { const r = window.sr('a').querySelector('.center').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] });
    await page.waitForTimeout(250);
    const during = await page.evaluate(() => { const e = window.sr('a').querySelector('.center'); const cs = getComputedStyle(e); return { outline: cs.outlineStyle, fv: e.matches(':focus-visible'), ring: cs.boxShadow.includes('rgb(3, 169, 244)') }; });
    check('pendant l\'appui long : ni contour ni anneau autour du centre', during.outline === 'none' && !during.fv && !during.ring, during);
    await page.waitForTimeout(450);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    check('… le résumé s\'ouvre', await page.evaluate(() => window.sr('a').querySelector('.dlg').open));
    await page.evaluate(() => window.sr('a').querySelector('.dlg-x').click());
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => { const s = window.sr('a'); const sv = s.querySelector('svg'); const cs = getComputedStyle(sv); return { fv: sv.matches(':focus-visible'), outline: cs.outlineStyle, shadow: cs.boxShadow }; });
    check('résumé fermé : retour au cadran sans anneau de focus', !after.fv && after.outline === 'none' && after.shadow === 'none', after);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Clavier : anneaux de focus ronds');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    await page.evaluate(() => window.mk('a', { layers: ['schedule.chauffage'] }));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.sr('a').querySelector('svg').focus());
    await page.keyboard.press('Tab');
    const k = await page.evaluate(() => { const e = window.sr('a').querySelector('.center'); const cs = getComputedStyle(e); return { active: window.sr('a').activeElement === e, fv: e.matches(':focus-visible'), outline: cs.outlineStyle, ring: cs.boxShadow.includes('rgb(3, 169, 244)'), radius: cs.borderTopLeftRadius }; });
    check('Tab jusqu\'au centre : anneau rond (ombre sur le cercle, pas de contour carré)', k.active && k.fv && k.outline === 'none' && k.ring && k.radius === '50%', k);
    await page.keyboard.press('Tab');
    const d = await page.evaluate(() => { const e = window.sr('a').activeElement; const cs = getComputedStyle(e); return { cls: e.className, outline: cs.outlineStyle, ring: cs.boxShadow.includes('rgb(3, 169, 244)') }; });
    check('… jour suivant : anneau rond aussi', d.cls.includes('day') && d.outline === 'none' && d.ring, d);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
