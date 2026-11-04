// Lance toutes les suites de tests : node tests/run.js  (ONLY=groups pour une seule suite)
// CARD=chemin/vers/la/carte.js pour tester un autre fichier que dist/day-wheel-card.js
const fs = require('fs');
const path = require('path');
const h = require('./harness');

(async () => {
  console.log(`Carte testée : ${h.CARD}`);
  const only = process.env.ONLY;
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.spec.js'))
    .filter((f) => !only || f.startsWith(only))
    .sort();
  const browser = await h.launch();
  try {
    for (const f of files) {
      console.log(`\n=== ${f}`);
      try {
        await require(path.join(__dirname, f))(browser, h);
      } catch (e) {
        h.check(`${f} : exécution sans plantage`, false, e.stack || e.message);
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(h.summary() ? 0 : 1);
})();
