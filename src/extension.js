const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const patcher = require('./patcher');
const {loadTiles, bake} = require('./paper');
const {writeThemes} = require('./theme');

const WANTED = 'paperMyCode.wanted';
const PRINT_FONTS = "'IBM Plex Mono', 'Courier Prime', 'iA Writer Mono S', monospace";
// Settings the colour themes are made from; the others are for the overlay.
const THEME_KEYS = ['printColors', 'matte', 'brightness', 'accentColor'];
// Strengths renamed in 0.5.0, old name to new.
const RENAMED = {
    mottle: 'mottle.strength',
    printColors: 'printColors.strength',
    matte: 'matte.strength',
    brightness: 'brightness.level',
    inkSpread: 'inkSpread.strength',
    lightScatter: 'lightScatter.strength',
};
let pending;

async function activate(context) {
    const appRoot = vscode.env.appRoot;
    // uninstall.js runs without the vscode API and needs to know where to look.
    fs.writeFileSync(path.join(context.extensionPath, 'state.json'), JSON.stringify({appRoot}));

    const render = async () => {
        const cfg = config();
        const tiles = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Paper my Code: making ${cfg.paper} paper`,
        }, () => loadTiles(context.globalStorageUri.fsPath, cfg.paper, cfg.resolution));
        const version = Date.now().toString(36);
        const {files, body} = bake(tiles, cfg, version);
        patcher.apply(appRoot, files, version, body);
    };

    const run = async (action, done) => {
        try {
            await action();
        } catch (e) {
            return showError(e);
        }
        const choice = await vscode.window.showInformationMessage(
            `${done} Reload the window to see it (other open windows too).`, 'Reload Window');
        if (choice)
            vscode.commands.executeCommand('workbench.action.reloadWindow');
    };

    // The themes ship with the default settings; other settings rewrite them.
    const themes = () => writeThemes(path.join(context.extensionPath, 'themes'), config());

    context.subscriptions.push(
        vscode.commands.registerCommand('paperMyCode.enable', () => run(async () => {
            await render();
            await context.globalState.update(WANTED, true);
        }, 'Paper is on.')),
        vscode.commands.registerCommand('paperMyCode.disable', () => run(async () => {
            patcher.remove(appRoot);
            await context.globalState.update(WANTED, false);
        }, 'Paper is off.')),
        // Ink spread and light scattering are one SVG filter on the editor's
        // text, so they go on and off together. Off if either is on.
        vscode.commands.registerCommand('paperMyCode.toggleInk', async () => {
            const mine = vscode.workspace.getConfiguration('paperMyCode');
            const keys = ['inkSpread.enabled', 'lightScatter.enabled'];
            const on = !keys.some(key => mine.get(key));
            for (const key of keys)
                await mine.update(key, on, vscode.ConfigurationTarget.Global);
            // When the paper is on, the settings change renders it and asks to reload.
            if (!context.globalState.get(WANTED))
                vscode.window.showInformationMessage(
                    `Ink effects ${on ? 'on' : 'off'}. They show once the paper is on: run Turn On Paper.`);
        }),
        vscode.commands.registerCommand('paperMyCode.useFont', async () => {
            const editor = vscode.workspace.getConfiguration('editor');
            await editor.update('fontFamily', PRINT_FONTS, true);
            await editor.update('fontLigatures', false, true);
            await vscode.workspace.getConfiguration('terminal.integrated').update('fontFamily', PRINT_FONTS, true);
            vscode.window.showInformationMessage(
                'Editor font set to IBM Plex Mono, then Courier Prime. Install either if it isn\'t on your system yet.');
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (!e.affectsConfiguration('paperMyCode'))
                return;
            // The settings editor reports every keystroke in a number field.
            clearTimeout(pending);
            pending = setTimeout(() => {
                const themeChanged = THEME_KEYS.some(k => e.affectsConfiguration(`paperMyCode.${k}`)) && themes();
                if (context.globalState.get(WANTED))
                    run(render, 'Paper updated.');
                else if (themeChanged)
                    run(async () => {}, 'Theme colours updated.');
            }, 1000);
        }),
        {dispose: () => clearTimeout(pending)},
    );

    // Before 0.5.0 the strengths clashed with their switches; move them.
    await migrateStrengths();

    // Up to 0.3.0 the paper could be handed to the "background" extension.
    leaveBackgroundExtension(context).catch(showError);

    // After an extension update the themes are back at the defaults.
    if (themes())
        run(async () => {}, 'Paper themes updated to your settings.');

    // An update of VSCodium replaces workbench.html and drops the paper.
    if (context.globalState.get(WANTED) && !safeIsPatched(appRoot)) {
        const choice = await vscode.window.showInformationMessage(
            'VSCodium was updated and the paper texture is gone. Put it back?',
            'Put it back', 'Turn it off');
        if (choice === 'Put it back')
            run(render, 'Paper is back.');
        else if (choice === 'Turn it off')
            context.globalState.update(WANTED, false);
    }
}

/**
 * Version 0.3.0 could write the paper as one image for the "background"
 * extension (shalldie.background), and switched its own texture and mottle off
 * for that. The paper is now always drawn by Paper my Code itself: this takes
 * the image out of that extension's settings, deletes it, and offers to switch
 * the built-in paper back on.
 */
async function leaveBackgroundExtension(context) {
    const dir = path.join(context.globalStorageUri.fsPath, 'background');
    if (!fs.existsSync(dir))
        return;
    try {
        const bg = vscode.workspace.getConfiguration('background');
        const fullscreen = bg.inspect('fullscreen')?.globalValue;
        if (fullscreen?.images?.some(image => image.startsWith(dir)))
            await bg.update('fullscreen', undefined, vscode.ConfigurationTarget.Global);
    } catch {
        // The background extension is uninstalled, so its settings no longer apply.
    }
    fs.rmSync(dir, {recursive: true, force: true});

    const choice = await vscode.window.showInformationMessage(
        'Paper my Code now draws the paper itself and no longer uses the background extension. ' +
        'Turn the built-in paper on?', 'Turn On Paper');
    if (!choice)
        return;
    const mine = vscode.workspace.getConfiguration('paperMyCode');
    const off = ['texture.enabled', 'mottle.enabled'].filter(key => !mine.get(key));
    if (!off.length)
        return vscode.commands.executeCommand('paperMyCode.enable');
    // Wanted first: the settings change below then renders the paper.
    await context.globalState.update(WANTED, true);
    for (const key of off)
        await mine.update(key, true, vscode.ConfigurationTarget.Global);
}

/**
 * Before 0.5.0 a strength and its switch shared a name, as in
 * `paperMyCode.inkSpread` (a number) and `paperMyCode.inkSpread.enabled`.
 * VSCodium keeps settings as a tree, so once the number was set, the switch
 * under it was dropped, read as off, and the effect disappeared. This moves
 * the numbers to their new names; the switches then read correctly again.
 */
async function migrateStrengths() {
    const c = vscode.workspace.getConfiguration('paperMyCode');
    const targets = [
        ['globalValue', vscode.ConfigurationTarget.Global],
        ['workspaceValue', vscode.ConfigurationTarget.Workspace],
    ];
    for (const [old, renamed] of Object.entries(RENAMED)) {
        const values = c.inspect(old) ?? {};
        for (const [field, target] of targets) {
            if (typeof values[field] !== 'number')
                continue;
            await c.update(renamed, values[field], target);
            await c.update(old, undefined, target);
        }
    }
}

function config() {
    const c = vscode.workspace.getConfiguration('paperMyCode');
    const v = (key, on) => (c.get(on) ? c.get(key) : 0);
    return {
        paper: c.get('paper'),
        texture: c.get('texture.enabled'),
        intensity: c.get('texture.intensity'),
        darkBalance: c.get('texture.darkBalance'),
        grain: c.get('texture.grain'),
        mottle: v('mottle.strength', 'mottle.enabled'),
        printColors: v('printColors.strength', 'printColors.enabled'),
        matte: v('matte.strength', 'matte.enabled'),
        brightness: c.get('brightness.enabled') ? c.get('brightness.level') : 1,
        accentColor: c.get('accentColor'),
        inkSpread: v('inkSpread.strength', 'inkSpread.enabled'),
        lightScatter: v('lightScatter.strength', 'lightScatter.enabled'),
        scale: c.get('scale'),
        resolution: c.get('resolution') === '2x' ? 2 : 1,
        scope: c.get('scope'),
        hideInFullscreen: c.get('hideInFullscreen'),
        shift: c.get('shiftTexture')
            ? [crypto.randomInt(4096), crypto.randomInt(4096)] : [0, 0],
    };
}

function safeIsPatched(appRoot) {
    try {
        return patcher.isPatched(appRoot);
    } catch {
        return false;
    }
}

function showError(e) {
    if (['EACCES', 'EPERM', 'EROFS'].includes(e.code)) {
        vscode.window.showErrorMessage(
            `Paper my Code can't write to VSCodium's install folder (${e.path}). ` +
            'Flatpak, Snap and AppImage installs are read-only and can\'t be patched; ' +
            'for a system-wide .deb/.rpm install, see the README. The themes work regardless.');
    } else {
        vscode.window.showErrorMessage(`Paper my Code: ${e.message}`);
    }
}

module.exports = {activate};
