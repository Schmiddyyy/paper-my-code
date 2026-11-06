// Adds one <link> to VSCodium's workbench.html and keeps product.json's
// checksum of that file in step, so there's no "installation appears to be
// corrupt" warning. The stylesheet and images sit in a folder next to
// workbench.html, so they load as 'self' under the page's CSP.
//
// No vscode API in here: uninstall.js uses it too.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ASSET_DIR = 'paper-my-code';
// Up to two blocks: the stylesheet in <head>, the text filter in <body>.
const BLOCK = /\n?<!-- paper-my-code -->.*?<!-- \/paper-my-code -->/gs;
const has = html => html.includes('<!-- paper-my-code -->');

// Where workbench.html has lived, newest first.
const CANDIDATES = [
    'vs/code/electron-browser/workbench/workbench.html',
    'vs/code/electron-sandbox/workbench/workbench.html',
    'vs/code/electron-sandbox/workbench/workbench.esm.html',
];

function locate(appRoot) {
    for (const rel of CANDIDATES) {
        const file = path.join(appRoot, 'out', rel);
        if (fs.existsSync(file))
            return {rel, file, assets: path.join(path.dirname(file), ASSET_DIR)};
    }
    throw new Error(`workbench.html not found under ${appRoot}`);
}

function isPatched(appRoot) {
    return has(fs.readFileSync(locate(appRoot).file, 'utf8'));
}

/** Replaces the assets, then points workbench.html at the new version. */
function apply(appRoot, files, version, body = '') {
    const wb = locate(appRoot);
    fs.rmSync(wb.assets, {recursive: true, force: true});
    fs.mkdirSync(wb.assets);
    for (const [name, data] of Object.entries(files))
        fs.writeFileSync(path.join(wb.assets, name), data);

    const html = fs.readFileSync(wb.file, 'utf8').replace(BLOCK, '');
    const link = `\n<!-- paper-my-code --><link rel="stylesheet" ` +
        `href="./${ASSET_DIR}/paper.css?v=${version}"><!-- /paper-my-code -->`;
    // Last in <head>, after the workbench CSS.
    let patched = html.replace(/(\s*<\/head>)/, m => link + m);
    if (body)
        patched = patched.replace(/(\s*<\/body>)/,
            m => `\n<!-- paper-my-code -->${body}<!-- /paper-my-code -->` + m);
    if (!patched.includes('<link rel="stylesheet" href="./' + ASSET_DIR))
        throw new Error('no </head> in workbench.html');
    write(appRoot, wb, patched);
}

/** Puts workbench.html back byte for byte and deletes the assets. */
function remove(appRoot) {
    const wb = locate(appRoot);
    const html = fs.readFileSync(wb.file, 'utf8');
    if (has(html))
        write(appRoot, wb, html.replace(BLOCK, ''));
    fs.rmSync(wb.assets, {recursive: true, force: true});
}

function write(appRoot, wb, html) {
    fs.writeFileSync(wb.file, html);
    const productFile = path.join(appRoot, 'product.json');
    const product = fs.readFileSync(productFile, 'utf8');
    const hash = crypto.createHash('sha256').update(html).digest('base64').replace(/=+$/, '');
    // Edit the one value in place instead of reformatting the whole file.
    const key = new RegExp(`("${wb.rel.replace(/[.\\/]/g, '\\$&')}"\\s*:\\s*")[^"]*"`);
    if (key.test(product))
        fs.writeFileSync(productFile, product.replace(key, `$1${hash}"`));
}

module.exports = {locate, isPatched, apply, remove};
