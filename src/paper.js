// Turns Paper my Shell's tiles into images and CSS the workbench can draw.
//
// The shell extension composites in a shader:
//   shade = 1 - intensity * shadow             (multiplied with the screen)
//   over  = intensity * balance * light, mottle (composited OVER the result)
// where shadow and light combine the detail, tone and grain tiles as
// 1 - (1-a)(1-b)(1-c).
//
// CSS has no shader, but normal alpha blending does the same thing: black
// with alpha a multiplies what is below by (1-a), white with alpha a lightens
// it like screen. Stacking the three tiles as layers of one element gives
// exactly 1 - (1-a)(1-b)(1-c), and the element's opacity then scales the
// whole group. Opacity is applied by the compositor in floating point, so the
// small strengths (0.05 by default) don't lose the 8-bit precision they would
// if they were baked into the PNG alpha.
//
// So: one element for shadows (opacity = intensity) and one for highlights
// and mottle (opacity = the larger of the two strengths, the other one baked
// in as a ratio).

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {Worker} = require('node:worker_threads');
const {textFilter, inkMask} = require('./filters');

const TILES = ['detail', 'tone', 'grain'];
const CACHED = [...TILES, 'ink'];

// From Paper my Shell: mottle samples the tone tile stretched only 2x
// (instead of 8x), starting at the tile's lowest values.
const MOTTLE_FLOOR = 0.3;

/** Generates a texture, or reads it from the cache. */
async function loadTiles(cacheDir, texture, resolution) {
    const dir = path.join(cacheDir, `${texture}@${resolution}x`);
    try {
        return Object.fromEntries(CACHED.map(name => {
            const pixels = new Uint8Array(fs.readFileSync(path.join(dir, `${name}.rgba`)));
            return [name, {size: Math.sqrt(pixels.length / 4), pixels}];
        }));
    } catch {
        // Not cached yet.
    }
    const tiles = await new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.mjs'),
            {workerData: {texture, resolution}});
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', code => code && reject(new Error(`generator exited with ${code}`)));
    });
    fs.mkdirSync(dir, {recursive: true});
    for (const name of CACHED) {
        // Written atomically, so an interrupted run leaves no truncated tile.
        const file = path.join(dir, `${name}.rgba`);
        fs.writeFileSync(`${file}.tmp`, tiles[name].pixels);
        fs.renameSync(`${file}.tmp`, file);
    }
    return tiles;
}

/**
 * Splits the tiles into shadow and highlight layers, scaled as described at
 * the top, and returns the files for the asset folder and the markup that
 * goes into <body> (the text filter), if any.
 */
function bake(tiles, cfg, version) {
    const {grain, mottle, scale, resolution, scope, shift} = cfg;
    const intensity = cfg.texture ? cfg.intensity : 0;
    const darkBalance = cfg.darkBalance;
    const lightOpacity = Math.max(intensity * darkBalance, mottle);
    const lightRatio = lightOpacity > 0 ? intensity * darkBalance / lightOpacity : 0;
    const mottleRatio = lightOpacity > 0 ? mottle / lightOpacity : 0;

    const files = {};
    const layer = (file, size, alphaOf) => {
        const {pixels} = tiles[size];
        const alpha = new Uint8Array(pixels.length / 4);
        for (let i = 0; i < alpha.length; i++) {
            const a = pixels[i * 4 + 3] / 255;
            const light = pixels[i * 4] / 255 * a; // grey 1 marks a highlight
            alpha[i] = Math.round(255 * Math.min(1, Math.max(0, alphaOf(light, a - light, a))));
        }
        files[file] = encodePng(tiles[size].size, alpha, file.startsWith('shadow') ? 0 : 255);
    };
    for (const name of TILES) {
        const k = name === 'grain' ? grain : 1;
        layer(`shadow-${name}.png`, name, (l, s) => k * s);
        layer(`light-${name}.png`, name, l => k * lightRatio * l);
    }
    layer('mottle.png', 'tone', (l, s, a) => mottleRatio * Math.max(0.5 - MOTTLE_FLOOR + l - 0.5 * a, 0));

    // CSS pixels per tile. The detail tile is 1024 logical pixels at either
    // resolution; grain stays one texel per device pixel; tone is drawn 8x
    // stretched and mottle 2x, as in the shell extension.
    const sizes = {
        detail: 1024 * scale, tone: 4096 * scale,
        grain: 256 / resolution * scale, mottle: 1024 * scale,
    };
    // Where the paper starts. Moved at random on every apply, so on OLED
    // screens its light and dark spots don't wear in one place.
    const position = names => names.map(() => `${shift[0]}px ${shift[1]}px`).join(', ');
    const images = names => names.map(n => `url("${n}.png?v=${version}")`).join(', ');
    const bgSizes = names => names.map(n => {
        const px = sizes[n.replace(/^(shadow|light)-/, '')];
        return `${px}px ${px}px`;
    }).join(', ');
    const shadowLayers = TILES.map(n => `shadow-${n}`);
    const lightLayers = ['mottle', ...TILES.map(n => `light-${n}`)];

    const overlay = intensity > 0 || mottle > 0;
    const target = scope === 'editor' ? '.monaco-workbench .part.editor' : 'body';
    const hidden = scope === 'editor' ? '.monaco-workbench.fullscreen .part.editor'
        : 'body:has(> .monaco-workbench.fullscreen)';
    const css = `/* Paper my Code: generated, do not edit. */
${target}::before, ${target}::after {
    content: "";
    position: ${scope === 'editor' ? 'absolute' : 'fixed'};
    inset: 0;
    pointer-events: none;
    background-repeat: repeat;
    background-attachment: fixed;
    will-change: opacity;
}
${target}::before {
    z-index: 2147483646;
    opacity: ${intensity};
    background-image: ${images(shadowLayers)};
    background-size: ${bgSizes(shadowLayers)};
    background-position: ${position(shadowLayers)};
}
${target}::after {
    z-index: 2147483647;
    opacity: ${lightOpacity};
    background-image: ${images(lightLayers)};
    background-size: ${bgSizes(lightLayers)};
    background-position: ${position(lightLayers)};
}
${cfg.hideInFullscreen ? `/* A fullscreen VSCodium (presenting, screen sharing) keeps the screen. */
${hidden}::before, ${hidden}::after { display: none; }
` : ''}`;
    const filter = textFilter(cfg, version);
    files['paper.css'] = Buffer.from((overlay ? css : '') + (filter?.css ?? ''));
    if (filter)
        files['ink.png'] = encodePng(tiles.ink.size, inkMask(tiles.ink), 0);
    return {files, body: filter?.svg ?? ''};
}

// --- PNG, grey + alpha, 8 bit -------------------------------------------

const CRC_TABLE = Int32Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
});

function crc32(buf) {
    let c = -1;
    for (const byte of buf)
        c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
}

function encodePng(size, alpha, grey) {
    const pixels = Buffer.alloc(size * size * 2);
    for (let i = 0; i < alpha.length; i++) {
        pixels[i * 2] = grey;
        pixels[i * 2 + 1] = alpha[i];
    }
    return encodePngGA(size, pixels);
}

/** Interleaved grey + alpha pixels. */
function encodePngGA(size, pixels) {
    const raw = Buffer.alloc(size * (1 + size * 2));
    for (let y = 0; y < size; y++) {
        const row = y * (1 + size * 2); // filter byte 0 (none)
        pixels.copy(raw, row + 1, y * size * 2, (y + 1) * size * 2);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8; // bit depth
    header[9] = 4; // grey + alpha
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(raw, {level: 6})),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

module.exports = {loadTiles, bake};
