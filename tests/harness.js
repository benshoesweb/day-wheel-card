// Banc d'essai : Chrome sans interface (Playwright) + faux Home Assistant
// (ha-card, ha-icon, sélecteurs, hass avec plannings, calendriers et heures)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mdi = require('@mdi/js');

const CARD = path.resolve(process.env.CARD || path.join(__dirname, '..', 'dist', 'day-wheel-card.js'));

const ICON_NAMES = ['trash-can-outline', 'close', 'calendar-clock', 'calendar', 'alarm', 'radiator', 'window-shutter',
  'water', 'robot-vacuum', 'help-circle-outline', 'weather-sunset', 'bed', 'sprinkler'];
const camel = (n) => 'mdi' + n.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
const ICONS = Object.fromEntries(ICON_NAMES.map((n) => [camel(n), mdi[camel(n)] || mdi.mdiHelpCircleOutline]));

// Mercredi 4 novembre 2026, 10:00 à Paris (09:00 UTC)
const NOW = '2026-11-04T09:00:00Z';

const STATES = {
  'schedule.chauffage': { state: 'off', attributes: { friendly_name: 'Chauffage', icon: 'mdi:radiator', next_event: '2026-11-04T17:00:00+01:00' } },
  'schedule.volets': { state: 'on', attributes: { friendly_name: 'Volets' } },
  'schedule.yaml_only': { state: 'off', attributes: { friendly_name: 'YAML' } },
  'input_datetime.reveil': { state: '07:30:00', attributes: { friendly_name: 'Réveil', has_date: false, has_time: true } },
  'input_datetime.rdv': { state: '2026-11-04 15:00:00', attributes: { friendly_name: 'Rendez-vous', has_date: true, has_time: true } },
  'time.arrosage': { state: '20:00:00', attributes: { friendly_name: 'Arrosage' } },
  'sensor.prochaine_alarme': { state: '2026-11-04T05:15:00+00:00', attributes: { friendly_name: 'Alarme téléphone', device_class: 'timestamp' } },
  'calendar.famille': { state: 'off', attributes: { friendly_name: 'Famille' } },
  'sun.sun': { state: 'above_horizon', attributes: { next_rising: '2026-11-05T06:50:00+00:00', next_setting: '2026-11-04T16:20:00+00:00' } },
};

// Plannings (stockage HA) : l'id du planning est l'identifiant unique de l'entité
const SCHEDULES = [
  {
    id: 'chauffage_id', name: 'Chauffage', icon: 'mdi:radiator',
    monday: [{ from: '06:30:00', to: '08:00:00' }], tuesday: [],
    wednesday: [{ from: '06:30:00', to: '08:00:00' }, { from: '17:00:00', to: '22:30:00', data: { consigne: 20 } }],
    thursday: [{ from: '07:00:00', to: '09:00:00' }], friday: [], saturday: [{ from: '08:00:00', to: '24:00:00' }], sunday: [],
  },
  {
    id: 'volets', name: 'Volets',
    monday: [], tuesday: [], wednesday: [{ from: '07:45:00', to: '19:00:00' }], thursday: [], friday: [], saturday: [], sunday: [],
  },
];
const REGISTRY = { 'schedule.chauffage': 'chauffage_id', 'schedule.volets': 'volets' };
const CALENDAR = {
  'calendar.famille': [
    { summary: 'Piscine', start: { dateTime: '2026-11-04T13:00:00+01:00' }, end: { dateTime: '2026-11-04T14:30:00+01:00' } },
    { summary: 'Toute la journée', start: { date: '2026-11-04' }, end: { date: '2026-11-05' } },
    { summary: 'Veille', start: { dateTime: '2026-11-03T23:00:00+01:00' }, end: { dateTime: '2026-11-04T01:00:00+01:00' } },
  ],
};

const THEMES = {
  dark: '--primary-text-color:#e1e1e1;--secondary-text-color:#9ba0a8;--divider-color:rgba(225,225,225,.14);--card-background-color:#1c1f26;--primary-background-color:#111318;--secondary-background-color:#262a33;--primary-color:#03a9f4;',
  light: '--primary-text-color:#212121;--secondary-text-color:#727272;--divider-color:rgba(0,0,0,.12);--card-background-color:#ffffff;--primary-background-color:#f0f2f5;--secondary-background-color:#e5e8ec;--primary-color:#03a9f4;',
};

const page = (body, opts) => `<!doctype html><html lang="${opts.lang}"><head><meta charset="utf-8"><style>
  body { margin:0; font-family: Roboto, "Segoe UI", sans-serif; background:${opts.theme === 'light' ? '#f0f2f5' : '#111318'}; ${THEMES[opts.theme] || ''} }
  .grid { display:grid; grid-template-columns: repeat(${opts.cols || 3}, ${opts.colWidth || 380}px); gap:16px; padding:16px; }
  h4 { margin: 0 0 8px; font-size: 13px; color: var(--secondary-text-color); text-align:center; font-weight:500 }
</style></head><body>${body}
<script>
window.__dwcNow = ${JSON.stringify(opts.now || NOW)};
window.__mdi = ${JSON.stringify(ICONS)};
window.__calls = []; window.__ws = []; window.__api = []; window.__events = []; window.__haptics = [];
window.__states = ${JSON.stringify(STATES)};
window.__schedules = ${JSON.stringify(SCHEDULES)};
window.__registry = ${JSON.stringify(REGISTRY)};
window.__calendar = ${JSON.stringify(CALENDAR)};
window.__lang = ${JSON.stringify(opts.lang)};
window.__dark = ${opts.theme !== 'light'};
window.__admin = ${opts.admin !== false};
window.__failUpdate = false;
window.__subs = [];
navigator.vibrate = () => true;
window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
document.addEventListener('hass-more-info', (e) => window.__events.push({ type: 'more-info', entity: e.detail.entityId }));
customElements.define('ha-icon', class extends HTMLElement {
  static get observedAttributes() { return ['icon']; }
  connectedCallback() { this.render(); } attributeChangedCallback() { this.render(); }
  render() {
    const n = (this.getAttribute('icon') || '').replace('mdi:', '');
    const key = n ? 'mdi' + n.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('') : '';
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor;display:block"><path d="' + (window.__mdi[key] || '') + '"/></svg>';
  }
});
customElements.define('ha-card', class extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:12px;border:1px solid var(--divider-color,#e0e0e0);color:var(--primary-text-color)}</style><slot></slot>'; }
});
const picker = () => class extends HTMLElement {
  set value(v) { this._v = v; } get value() { return this._v || ''; }
  set hass(h) { this._hass = h; } set label(l) { this._label = l; }
  set includeDomains(d) { this._domains = d; } get includeDomains() { return this._domains; }
  pick(v) { this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v }, bubbles: true, composed: true })); }
};
customElements.define('ha-entity-picker', picker());
customElements.define('ha-icon-picker', picker());
const clone = (o) => JSON.parse(JSON.stringify(o));
window.pushSchedules = (changes) => window.__subs.forEach((cb) => cb(clone(changes)));
window.makeHass = () => ({
  states: window.__states,
  themes: { darkMode: window.__dark },
  language: window.__lang,
  locale: { language: window.__lang },
  config: { time_zone: 'Europe/Paris' },
  user: { is_admin: window.__admin },
  connection: {
    subscribeMessage(cb, msg) {
      window.__ws.push(clone(msg));
      window.__subs.push(cb);
      setTimeout(() => cb(window.__schedules.map((item) => ({ change_type: 'added', schedule_id: item.id, item: clone(item) }))), 0);
      return Promise.resolve(() => { window.__subs = window.__subs.filter((x) => x !== cb); });
    },
  },
  callWS(msg) {
    window.__ws.push(clone(msg));
    if (msg.type === 'config/entity_registry/get') {
      const id = window.__registry[msg.entity_id];
      return id ? Promise.resolve({ entity_id: msg.entity_id, unique_id: id, platform: 'schedule' }) : Promise.reject(new Error('not found'));
    }
    if (msg.type === 'schedule/list') return Promise.resolve(clone(window.__schedules));
    if (msg.type === 'schedule/update') {
      if (window.__failUpdate) return Promise.reject(new Error('refusé'));
      const { type, schedule_id, ...rest } = msg;
      const item = { id: schedule_id, ...rest };
      window.__schedules = window.__schedules.map((s) => (s.id === schedule_id ? item : s));
      setTimeout(() => window.pushSchedules([{ change_type: 'updated', schedule_id, item }]), 5);
      return Promise.resolve(clone(item));
    }
    return Promise.reject(new Error('unknown ' + msg.type));
  },
  callApi(method, path) {
    window.__api.push({ method, path });
    const entity = decodeURIComponent(path.split('?')[0].replace('calendars/', ''));
    return Promise.resolve(clone(window.__calendar[entity] || []));
  },
  callService(domain, service, data) { window.__calls.push({ domain, service, data: clone(data || {}) }); return Promise.resolve(); },
});
window.mk = (id, cfg) => {
  const el = document.getElementById(id);
  el.setConfig({ type: 'custom:day-wheel-card', ...cfg });
  el.hass = window.makeHass();
  return el;
};
window.setState = (entity, state, attributes) => {
  const prev = window.__states[entity] || { attributes: {} };
  window.__states = { ...window.__states, [entity]: { state, attributes: { ...prev.attributes, ...(attributes || {}) } } };
  document.querySelectorAll('day-wheel-card').forEach((el) => { if (el._config) el.hass = window.makeHass(); });
};
window.sr = (id) => document.getElementById(id).shadowRoot;
</script>
<script src="/day-wheel-card.js"></script>
</body></html>`;

// ---------- Résultats ----------
const results = [];
let section = '';
const check = (label, ok, extra = '') => {
  results.push({ label: `${section}${label}`, ok: !!ok });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${!ok && extra ? `  →  ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
const group = (name) => { section = `${name} : `; console.log(`\n${name}`); };

let server = null;
let base = '';
const pages = new Map();
function serve() {
  if (server) return Promise.resolve();
  server = http.createServer((req, res) => {
    const url = req.url.split('?')[0].split('#')[0];
    if (url === '/day-wheel-card.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(CARD));
    } else if (pages.has(url)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pages.get(url));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }));
}

async function launch() {
  await serve();
  const opts = { args: ['--no-sandbox'] };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(opts);
  const close = browser.close.bind(browser);
  browser.close = async () => { await close(); if (server) { server.close(); server = null; } };
  return browser;
}

async function open(browser, body, o = {}) {
  const opts = { lang: 'fr', theme: 'dark', w: 440, h: 640, dsf: 1, ...o };
  const ctx = await browser.newContext({
    viewport: { width: opts.w, height: opts.h }, deviceScaleFactor: opts.dsf, hasTouch: !!opts.touch,
    locale: opts.lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: opts.tz || 'America/New_York',
  });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  const name = `/page-${Math.random().toString(36).slice(2, 8)}.html`;
  pages.set(name, page(body, opts));
  await pg.goto(base + name);
  await pg.waitForTimeout(100);
  return { page: pg, ctx, errors, close: () => ctx.close() };
}

// Point du cadran : minute m de la journée, sur l'anneau li (au milieu de son épaisseur)
const point = (pg, id, li, m, dr = 0) => pg.evaluate(({ id, li, m, dr }) => {
  const el = document.getElementById(id);
  const svg = el.shadowRoot.querySelector('svg');
  const r = svg.getBoundingClientRect();
  const k = r.width / 400;
  const R = el._geom().rings[li].r + dr;
  const a = ((m / 1440) * 360 - 90 + el._rot()) * Math.PI / 180;
  return { x: r.left + (200 + Math.cos(a) * R) * k, y: r.top + (200 + Math.sin(a) * R) * k };
}, { id, li, m, dr });

// Glisser de la minute a à la minute b le long de l'anneau li
async function drag(pg, id, li, a, b, steps = 12) {
  const p = await point(pg, id, li, a);
  await pg.mouse.move(p.x, p.y);
  await pg.mouse.down();
  for (let s = 1; s <= steps; s += 1) {
    const q = await point(pg, id, li, a + ((b - a) * s) / steps);
    await pg.mouse.move(q.x, q.y);
  }
  await pg.mouse.up();
  await pg.waitForTimeout(60);
}

const card = (id, w = 400) => `<div style="width:${w}px;padding:10px"><day-wheel-card id="${id}"></day-wheel-card></div>`;
const ws = (pg, type) => pg.evaluate((type) => window.__ws.filter((m) => !type || m.type === type), type);
const calls = (pg) => pg.evaluate(() => window.__calls);

function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
  if (failed.length) {
    console.log('Échecs :');
    failed.forEach((r) => console.log(`  - ${r.label}`));
  }
  return failed.length === 0;
}

module.exports = { launch, open, point, drag, card, ws, calls, check, group, summary, CARD, STATES, NOW };
