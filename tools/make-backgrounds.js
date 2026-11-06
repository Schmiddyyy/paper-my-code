// Writes the seven papers as seamless images for the "background" extension,
// with the opacity each one needs, at Paper my Shell's default strengths.
//
//   node tools/make-backgrounds.js [output-dir]
//
// The images are ~8 MB each, so they aren't kept in the repository; attach
// them to a GitHub release instead.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {loadTiles, bakeSingle} = require('../src/paper');

const PAPERS = ['recycled', 'drawing', 'watercolor', 'washi', 'laid-paper', 'cardboard', 'canvas'];
const STRENGTHS = {intensity: 0.05, darkBalance: 0.4, grain: 0.5, mottle: 0.04};

(async () => {
    const out = path.resolve(process.argv[2] ?? 'paper-backgrounds');
    const cache = path.join(os.tmpdir(), 'paper-my-code-cache');
    fs.mkdirSync(out, {recursive: true});
    for (const paper of PAPERS) {
        const {png, opacity} = bakeSingle(await loadTiles(cache, paper, 1), STRENGTHS);
        fs.writeFileSync(path.join(out, `paper-${paper}.png`), png);
        console.log(`paper-${paper}.png  opacity ${opacity}`);
    }
})();
