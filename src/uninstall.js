// vscode:uninstall hook. VSCodium runs it with plain Node on the first start
// after the extension was uninstalled, from the extension's folder.
const fs = require('node:fs');
const path = require('node:path');
const patcher = require('./patcher');

try {
    const {appRoot} = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'state.json'), 'utf8'));
    patcher.remove(appRoot);
} catch (e) {
    console.error(`Paper my Code: could not restore workbench.html: ${e.message}`);
}
