// Noms des entités : comme Home Assistant (hass.formatEntityName depuis 2026.11), repli friendly_name
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Noms des entités');
  {
    const t = await h.open(browser, h.card('a'));
    const { page } = t;
    const run = (mode) => page.evaluate((mode) => {
      const base = window.makeHass();
      const states = {};
      Object.entries(base.states).forEach(([id, st]) => { states[id] = { entity_id: id, ...st }; });
      // Plus de friendly_name (comme après sa suppression annoncée) sur le réveil
      states['input_datetime.reveil'] = { ...states['input_datetime.reveil'], attributes: { has_date: false, has_time: true } };
      const fmt = {
        modern: (st) => ({ 'schedule.chauffage': 'Chauffage', 'input_datetime.reveil': 'Chambre Réveil', 'calendar.famille': 'Agenda Famille' })[st.entity_id] || '',
        throws: () => { throw new Error('ancienne interface'); },
      }[mode];
      const hass = { ...base, states, ...(fmt ? { formatEntityName: fmt } : {}) };
      // Le registre ne répond pas : la carte retrouve le planning par son nom
      if (mode === 'modern') hass.callWS = (msg) => (msg.type === 'config/entity_registry/get' ? Promise.reject(new Error('non')) : base.callWS(msg));
      const el = document.getElementById('a');
      el._ids = {};
      el.setConfig({ type: 'custom:day-wheel-card', layers: [{ entity: 'schedule.chauffage' }, { entity: 'input_datetime.reveil' }, { entity: 'calendar.famille', name: 'Famille (perso)' }] });
      el.hass = hass;
      return new Promise((res) => setTimeout(() => {
        const s = el.shadowRoot;
        res({
          legend: [...s.querySelectorAll('.lg')].map((b) => b.textContent.trim()),
          marker: (s.querySelector('.marker title') || {}).textContent,
          arcs: s.querySelectorAll('path.arc[data-li="0"]').length,
          aria: s.querySelector('svg').getAttribute('aria-label'),
        });
      }, 250));
    }, mode);

    const m = await run('modern');
    check('HA 2026.11 : noms de hass.formatEntityName, nom choisi (name) prioritaire', JSON.stringify(m.legend) === JSON.stringify(['Chauffage', 'Chambre Réveil', 'Famille (perso)']), m);
    check('… repris au survol du repère et dans la description accessible', m.marker === 'Chambre Réveil · 07:30' && m.aria.includes('Chauffage'), m);
    check('… planning retrouvé par son nom quand le registre ne répond pas', m.arcs === 2, m);
    const old = await run('none');
    check('HA plus ancien : friendly_name, puis entity_id', JSON.stringify(old.legend) === JSON.stringify(['Chauffage', 'input_datetime.reveil', 'Famille (perso)']), old);
    const thr = await run('throws');
    check('formatEntityName en erreur : repli sans planter', JSON.stringify(thr.legend) === JSON.stringify(old.legend), thr);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
