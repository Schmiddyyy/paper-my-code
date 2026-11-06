const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const patcher = require('./patcher');
const {loadTiles, bake, bakeSingle} = require('./paper');
const {writeThemes} = require('./theme');

const WANTED = 'paperMyCode.wanted';
const PRINT_FONTS = "'IBM Plex Mono', 'Courier Prime', 'iA Writer Mono S', monospace";
// Settings the colour themes are made from; the others are for the overlay.
const THEME_KEYS = ['printColors', 'matte', 'brightness'];
const BACKGROUND_EXTENSION = 'shalldie.background';
let pending;

/**
 * Hands the paper to the "background" extension: one seamless image with the
 * texture, highlights and mottle, set as its fullscreen image, repeated
 * instead of stretched. Paper my Code's own texture and mottle are switched
 * off so the two don't draw twice; its themes and ink filter stay.
 */
async function useBackgroundExtension(context) {
    // Its own mottle switch is turned off below; the strength still counts.
    const cfg = {...config(), mottle: vscode.workspace.getConfiguration('paperMyCode').get('mottle')};
    const tiles = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Paper my Code: making ${cfg.paper} paper for the background extension`,
    }, async () => {
        const t = await loadTiles(context.globalStorageUri.fsPath, cfg.paper, cfg.resolution);
        return bakeSingle(t, cfg);
    });
    const dir = path.join(context.globalStorageUri.fsPath, 'background');
    fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(dir, {recursive: true});
    // A new name each time, so the background extension sees a change.
    const file = path.join(dir, `paper-${cfg.paper}-${Date.now().toString(36)}.png`);
    fs.writeFileSync(file, tiles.png);

    const px = `${tiles.size / cfg.resolution * cfg.scale}px`;
    await vscode.workspace.getConfiguration('background').update('fullscreen', {
        images: [file],
        opacity: tiles.opacity,
        size: `${px} ${px}`,
        position: `${cfg.shift[0]}px ${cfg.shift[1]}px`,
        // Repeat the tile; normal blending on dark themes too, so the paper's
        // shadows and highlights both show, as in Paper my Shell.
        styles: [{'background-repeat': 'repeat', 'mix-blend-mode': 'normal', 'transition': 'none'}],
        interval: 0,
        random: false,
    }, vscode.ConfigurationTarget.Global);
    const mine = vscode.workspace.getConfiguration('paperMyCode');
    await mine.update('texture.enabled', false, vscode.ConfigurationTarget.Global);
    await mine.update('mottle.enabled', false, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
        'The paper is set as the background extension\'s fullscreen image. Reload when it asks you to. ' +
        'Run this command again after changing the paper or its strength.');
}

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
        vscode.commands.registerCommand('paperMyCode.useBackgroundExtension', async () => {
            if (!vscode.extensions.getExtension(BACKGROUND_EXTENSION)) {
                const choice = await vscode.window.showInformationMessage(
                    'This needs the "background" extension by shalldie. Install it first, then run this again.',
                    'Show Extension');
                if (choice)
                    vscode.commands.executeCommand('workbench.extensions.search', BACKGROUND_EXTENSION);
                return;
            }
            try {
                await useBackgroundExtension(context);
            } catch (e) {
                showError(e);
            }
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

function config() {
    const c = vscode.workspace.getConfiguration('paperMyCode');
    const v = (key, on) => (c.get(on) ? c.get(key) : 0);
    return {
        paper: c.get('paper'),
        texture: c.get('texture.enabled'),
        intensity: c.get('texture.intensity'),
        darkBalance: c.get('texture.darkBalance'),
        grain: c.get('texture.grain'),
        mottle: v('mottle', 'mottle.enabled'),
        printColors: v('printColors', 'printColors.enabled'),
        matte: v('matte', 'matte.enabled'),
        brightness: c.get('brightness.enabled') ? c.get('brightness') : 1,
        inkSpread: v('inkSpread', 'inkSpread.enabled'),
        lightScatter: v('lightScatter', 'lightScatter.enabled'),
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
