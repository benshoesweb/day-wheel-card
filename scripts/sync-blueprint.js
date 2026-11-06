// Recopie blueprints/day_wheel_schedule.yaml dans la carte (la carte l'installe elle-même dans Home Assistant)
// node scripts/sync-blueprint.js   (le test 09 vérifie que les deux sont identiques)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const card = path.join(root, 'dist', 'day-wheel-card.js');
const yaml = fs.readFileSync(path.join(root, 'blueprints', 'day_wheel_schedule.yaml'), 'utf8');
if (/[`\\]|\$\{/.test(yaml)) throw new Error('Le blueprint contient ` \\ ou ${ : à échapper');
const src = fs.readFileSync(card, 'utf8');
const re = /(\/\/ <blueprint>\n  const BLUEPRINT_YAML = `)[\s\S]*?(`;\n  \/\/ <\/blueprint>)/;
if (!re.test(src)) throw new Error('Repères <blueprint> introuvables dans la carte');
fs.writeFileSync(card, src.replace(re, (m, a, b) => a + yaml + b));
console.log('Blueprint recopié dans dist/day-wheel-card.js');
