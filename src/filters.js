// Ink spread and light scattering, rebuilt as an SVG filter on the editor's
// text area. Paper my Shell does them in its print shader on the finished
// screen; an SVG filter is the one place a web page gets to read pixels, so
// they run there, on code only.
//
// Ink spread: each pixel darkens towards the darkest of its four neighbours
// half a pixel away (feOffset by half a pixel averages two pixels, like the
// shader's neighbour reads), but only where the paper takes ink: a hard
// threshold on the ink tile's absorbency, so the edges turn ragged instead
// of soft. Never lightens. The shader's feathers along single fibres need a
// direction per pixel, which a filter can't follow, so they're left out.
//
// Light scattering: the shader computes out = (T * (T + s * (blur(T) - T)))^(1/2.2)
// with T = c^1.1. To first order that is c + s/2.2 * (blur(c) - c), a mix of
// the pixel with the mean of its four half-pixel neighbours: dark strokes
// get a faint halo, light gaps between them get a little darker.

// Constants from Paper my Shell.
const INK_SHARE = 0.7;
const INK_STRENGTH = 0.9;
const SCATTER_MAX_MM = 0.25;
const TEXEL_MM = 0.23; // a logical pixel at about 110 dpi

/** From Paper my Shell: how much of the neighbours' mean scattering mixes in. */
function scatterStrength(kp, pixel) {
    if (kp <= 0)
        return 0;
    const scale = kp / pixel / (2 * Math.PI);
    const steps = 80, end = 16, angles = 8;
    let stay = 0;
    for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) * end / steps;
        const r = scale * t;
        let ring = 0;
        for (let j = 0; j < angles; j++) {
            const angle = (j + 0.5) * Math.PI / 2 / angles;
            ring += Math.max(0, 1 - r * Math.cos(angle)) * Math.max(0, 1 - r * Math.sin(angle));
        }
        stay += t * Math.exp(-t) * ring / angles * end / steps;
    }
    return Math.min(1, 2 * (1 - stay));
}

/**
 * The inline <svg> with the filter, and the CSS that applies it, or null if
 * both effects are off.
 */
function textFilter({inkSpread, lightScatter, resolution, scale}, version) {
    if (inkSpread <= 0 && lightScatter <= 0)
        return null;
    const reach = 0.5 / resolution; // half a device pixel, in CSS pixels
    const tile = 256 / resolution * scale;
    const f = [];

    f.push(`<feOffset in="SourceGraphic" dx="${reach}" result="r"/>`,
        `<feOffset in="SourceGraphic" dx="-${reach}" result="l"/>`,
        `<feOffset in="SourceGraphic" dy="${reach}" result="d"/>`,
        `<feOffset in="SourceGraphic" dy="-${reach}" result="u"/>`);
    let current = 'SourceGraphic';

    if (inkSpread > 0) {
        // Darkest of the pixel and its neighbours.
        f.push('<feBlend in="r" in2="l" mode="darken" result="n1"/>',
            '<feBlend in="d" in2="u" mode="darken" result="n2"/>',
            '<feBlend in="n1" in2="n2" mode="darken" result="n3"/>',
            '<feBlend in="n3" in2="SourceGraphic" mode="darken" result="near"/>');
        // Where the paper takes ink, as alpha: absorbency above the threshold.
        const threshold = 1 - INK_SHARE * inkSpread;
        const take = INK_STRENGTH * Math.sqrt(inkSpread);
        const steps = 64;
        const table = Array.from({length: steps},
            (_, i) => ((i + 0.5) / steps >= threshold ? take : 0).toFixed(3)).join(' ');
        f.push(`<feImage href="paper-my-code/ink.png?v=${version}" x="0" y="0" width="${tile}" height="${tile}" preserveAspectRatio="none" result="inkTile"/>`,
            '<feTile in="inkTile" result="inkPaper"/>',
            `<feComponentTransfer in="inkPaper" result="takes"><feFuncA type="discrete" tableValues="${table}"/></feComponentTransfer>`,
            '<feComposite in="near" in2="takes" operator="in" result="soaked"/>',
            '<feComposite in="soaked" in2="SourceGraphic" operator="over" result="inked"/>');
        current = 'inked';
    }

    if (lightScatter > 0) {
        const s = scatterStrength(lightScatter * SCATTER_MAX_MM, TEXEL_MM / resolution);
        const a = s / 2.2;
        f.push('<feComposite in="r" in2="l" operator="arithmetic" k2="0.5" k3="0.5" result="h"/>',
            '<feComposite in="d" in2="u" operator="arithmetic" k2="0.5" k3="0.5" result="v"/>',
            '<feComposite in="h" in2="v" operator="arithmetic" k2="0.5" k3="0.5" result="around"/>',
            `<feComposite in="${current}" in2="around" operator="arithmetic" k2="${(1 - a).toFixed(4)}" k3="${a.toFixed(4)}" result="scattered"/>`);
    }

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" ' +
        'style="position:absolute;width:0;height:0" aria-hidden="true">' +
        '<filter id="paper-my-code-ink" x="0" y="0" width="100%" height="100%" ' +
        'color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">' +
        f.join('') + '</filter></svg>';
    // The editor's viewport, gutter and text, not the whole scrolled content.
    const css = `.monaco-workbench .monaco-editor .overflow-guard { filter: url(#paper-my-code-ink); }\n`;
    return {svg, css};
}

/** The ink tile's absorbency as a grey + alpha mask (alpha = absorbency). */
function inkMask(tile) {
    const alpha = new Uint8Array(tile.size * tile.size);
    for (let i = 0; i < alpha.length; i++)
        alpha[i] = tile.pixels[i * 4 + 2];
    return alpha;
}

module.exports = {textFilter, inkMask};
