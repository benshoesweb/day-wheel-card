// Titre de la carte : en-tête standard de Home Assistant (attribut « header » de ha-card)
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Titre de la carte');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    const read = () => page.evaluate(() => {
      const el = document.getElementById('a');
      const card = el.shadowRoot.querySelector('ha-card');
      const h1 = card.shadowRoot.querySelector('h1.card-header');
      return {
        header: card.hasAttribute('header') ? card.getAttribute('header') : null,
        shown: !!h1 && h1.textContent === card.getAttribute('header'),
        size: h1 ? getComputedStyle(h1).fontSize : null,
        ownTitle: !!el.shadowRoot.querySelector('.title'),
        rows: el.getGridOptions().rows, cardSize: el.getCardSize(),
      };
    });
    await page.evaluate(() => window.mk('a', { layers: ['schedule.chauffage'] }));
    const none = await read();
    check('sans nom : pas de titre', none.header === null && !none.shown && none.rows === 7, none);
    await page.evaluate(() => window.mk('a', { name: 'Ma journée', layers: ['schedule.chauffage'] }));
    const on = await read();
    check('avec un nom : titre standard de Home Assistant (en-tête de ha-card)', on.header === 'Ma journée' && on.shown && !on.ownTitle && on.size === '24px', on);
    check('… une ligne de plus dans la grille', on.rows === 8 && on.cardSize === 8, on);
    const themed = await page.evaluate(() => {
      const el = document.getElementById('a');
      el.style.setProperty('--ha-card-header-font-size', '18px');
      const h1 = el.shadowRoot.querySelector('ha-card').shadowRoot.querySelector('h1.card-header');
      const size = getComputedStyle(h1).fontSize;
      el.style.removeProperty('--ha-card-header-font-size');
      return size;
    });
    check('… le titre suit les variables du thème', themed === '18px', themed);
    await page.evaluate(() => window.mk('a', { name: '<i>Planning & réveil</i>', layers: ['schedule.chauffage'] }));
    const esc = await read();
    check('nom affiché tel quel (pas de HTML interprété)', esc.header === '<i>Planning & réveil</i>' && esc.shown, esc);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
