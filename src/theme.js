// Builds the colour themes. Every colour goes through the same steps, in the
// same order, as a pixel in Paper my Shell's print shader:
//
//   print colours  out-of-gamut colours move into the gamut of offset print
//                  on uncoated paper (the shell extension's 65³ lookup table)
//   matte          even the darkest ink reflects some light: blacks lift
//   paper tint     paper white under room light is a little warm
//   brightness     dims everything
//
// A shader applies these to finished pixels; a theme can only apply them to
// its own colours, so images, icons and webviews keep theirs.
//
// Run `node src/theme.js` to write the default themes and a contrast report.

const fs = require('node:fs');
const path = require('node:path');
const palettes = require('./palette');

const LUT_SIZE = 65;
let lut;

// The darkest ink on uncoated paper still reflects about 5 % of the light,
// in a slightly warm colour (from Paper my Shell).
const PAPER_BLACK = [0.05, 0.05 * 0.97 ** 2.2, 0.05 * 0.92 ** 2.2];

/** Trilinear lookup, laid out like the shell's: red along x, green + blue × size along y. */
function printLut([r, g, b]) {
    lut ??= fs.readFileSync(path.join(__dirname, 'print-lut.bin'));
    const n = LUT_SIZE;
    const s = [r, g, b].map(v => Math.min(1, Math.max(0, v)) * (n - 1));
    const i0 = s.map(Math.floor);
    const i1 = i0.map(i => Math.min(i + 1, n - 1));
    const f = s.map((v, k) => v - i0[k]);
    const at = (x, y, z, ch) => lut[((z * n + y) * n + x) * 3 + ch] / 255;
    return [0, 1, 2].map(ch => {
        let v = 0;
        for (const [dx, wx] of [[i0[0], 1 - f[0]], [i1[0], f[0]]])
            for (const [dy, wy] of [[i0[1], 1 - f[1]], [i1[1], f[1]]])
                for (const [dz, wz] of [[i0[2], 1 - f[2]], [i1[2], f[2]]])
                    v += wx * wy * wz * at(dx, dy, dz, ch);
        return v;
    });
}

function transform(rgb, {printColors, matte, brightness}) {
    let c = rgb;
    // Greys skip the table, as in the shader.
    if (printColors > 0 && Math.max(...c) - Math.min(...c) > 1 / 1024) {
        const p = printLut(c);
        c = c.map((v, i) => v + (p[i] - v) * printColors);
    }
    if (matte > 0) {
        const black = PAPER_BLACK.map(b => (matte * b ** (1 / 2.2)) ** 2.2);
        c = c.map((v, i) => (black[i] + (1 - black[i]) * Math.max(v, 0) ** 2.2) ** (1 / 2.2));
    }
    const tint = [1, 1 - 0.015 * matte, 1 - 0.045 * matte];
    return c.map((v, i) => v * tint[i] * brightness);
}

const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const toHex = rgb => '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16).padStart(2, '0')).join('');

/** A colour of the palette, printed, optionally with an alpha suffix. */
function ink(hex, cfg) {
    return toHex(transform(parse(hex.slice(0, 7)), cfg)) + hex.slice(7);
}

function build(p, cfg) {
    const c = hex => ink(hex, cfg);
    const s = Object.fromEntries(Object.entries(p.syntax).map(([k, v]) => [k, c(v)]));
    // The coloured paper of the title, activity and status bars.
    const bar = c(p.bars[cfg.accentColor] ?? p.bars.beige);

    const colors = {
        // Base
        'foreground': c(p.ink), 'descriptionForeground': c(p.inkSoft),
        'disabledForeground': c(p.inkFaint), 'errorForeground': c(p.error),
        'focusBorder': c(p.accent) + '80', 'contrastBorder': '#00000000',
        'icon.foreground': c(p.inkSoft), 'widget.shadow': '#0000001a',
        'selection.background': c(p.selection), 'sash.hoverBorder': c(p.accent) + '80',
        'textLink.foreground': c(p.info), 'textLink.activeForeground': c(p.accent),
        'textBlockQuote.background': c(p.paperAlt), 'textBlockQuote.border': c(p.rule),
        'textCodeBlock.background': c(p.paperAlt), 'textPreformat.foreground': c(p.syntax.string),
        'textSeparator.foreground': c(p.rule),

        // Window
        'titleBar.activeBackground': bar, 'titleBar.activeForeground': c(p.ink),
        'titleBar.inactiveBackground': bar, 'titleBar.inactiveForeground': c(p.inkFaint),
        'titleBar.border': c(p.rule),
        'activityBar.background': bar, 'activityBar.foreground': c(p.ink),
        'activityBar.inactiveForeground': c(p.inkFaint), 'activityBar.border': c(p.rule),
        'activityBar.activeBorder': c(p.accent), 'activityBarBadge.background': c(p.accent),
        'activityBarBadge.foreground': c(p.paper),
        'sideBar.background': c(p.paperAlt), 'sideBar.foreground': c(p.ink), 'sideBar.border': c(p.rule),
        'sideBarTitle.foreground': c(p.inkSoft),
        'sideBarSectionHeader.background': c(p.paperAlt), 'sideBarSectionHeader.foreground': c(p.inkSoft),
        'sideBarSectionHeader.border': c(p.rule),
        'statusBar.background': bar, 'statusBar.foreground': c(p.inkSoft),
        'statusBar.border': c(p.rule), 'statusBar.debuggingBackground': c(p.warning),
        'statusBar.debuggingForeground': c(p.paper), 'statusBar.noFolderBackground': bar,
        'statusBarItem.hoverBackground': c(p.ruleSoft), 'statusBarItem.remoteBackground': c(p.accent),
        'statusBarItem.remoteForeground': c(p.paper),
        'panel.background': c(p.paper), 'panel.border': c(p.rule),
        'panelTitle.activeForeground': c(p.ink), 'panelTitle.inactiveForeground': c(p.inkFaint),
        'panelTitle.activeBorder': c(p.accent),

        // Tabs and editor groups
        'editorGroupHeader.tabsBackground': c(p.paperAlt), 'editorGroupHeader.tabsBorder': c(p.rule),
        'editorGroup.border': c(p.rule), 'editorGroup.emptyBackground': c(p.paper),
        'tab.activeBackground': c(p.paper), 'tab.activeForeground': c(p.ink),
        'tab.activeBorderTop': c(p.accent), 'tab.inactiveBackground': c(p.paperAlt),
        'tab.inactiveForeground': c(p.inkFaint), 'tab.border': c(p.rule),
        'tab.hoverBackground': c(p.paper), 'tab.unfocusedActiveForeground': c(p.inkSoft),
        'breadcrumb.foreground': c(p.inkFaint), 'breadcrumb.focusForeground': c(p.ink),
        'breadcrumb.activeSelectionForeground': c(p.ink), 'breadcrumbPicker.background': c(p.paperAlt),

        // Editor
        'editor.background': c(p.paper), 'editor.foreground': c(p.ink),
        'editorLineNumber.foreground': c(p.inkFaint) + 'b0', 'editorLineNumber.activeForeground': c(p.ink),
        'editorCursor.foreground': c(p.accent),
        'editor.selectionBackground': c(p.selection), 'editor.inactiveSelectionBackground': c(p.selectionInactive),
        'editor.selectionHighlightBackground': c(p.selection) + '80',
        'editor.wordHighlightBackground': c(p.selection) + '70',
        'editor.wordHighlightStrongBackground': c(p.selection) + 'a0',
        'editor.lineHighlightBackground': c(p.lineHighlight), 'editor.lineHighlightBorder': '#00000000',
        'editor.findMatchBackground': c(p.findMatch) + 'a0', 'editor.findMatchHighlightBackground': c(p.findMatch) + '50',
        'editor.rangeHighlightBackground': c(p.selection) + '50',
        'editorWhitespace.foreground': c(p.rule), 'editorIndentGuide.background1': c(p.ruleSoft),
        'editorIndentGuide.activeBackground1': c(p.rule), 'editorRuler.foreground': c(p.ruleSoft),
        'editorBracketMatch.background': c(p.selection) + '80', 'editorBracketMatch.border': c(p.inkFaint),
        'editorBracketHighlight.foreground1': s.punct, 'editorBracketHighlight.foreground2': s.keyword,
        'editorBracketHighlight.foreground3': s.func, 'editorBracketHighlight.foreground4': s.string,
        'editorBracketHighlight.foreground5': s.type, 'editorBracketHighlight.foreground6': s.number,
        'editorCodeLens.foreground': c(p.inkFaint), 'editorLink.activeForeground': c(p.info),
        'editorError.foreground': c(p.error), 'editorWarning.foreground': c(p.warning),
        'editorInfo.foreground': c(p.info), 'editorHint.foreground': c(p.inkFaint),
        'editorGutter.addedBackground': c(p.added), 'editorGutter.modifiedBackground': c(p.modified),
        'editorGutter.deletedBackground': c(p.deleted),
        'editorOverviewRuler.border': '#00000000', 'editorOverviewRuler.errorForeground': c(p.error),
        'editorOverviewRuler.warningForeground': c(p.warning),
        'editorStickyScroll.background': c(p.paper), 'editorStickyScrollHover.background': c(p.lineHighlight),
        'editorInlayHint.foreground': c(p.inkFaint), 'editorInlayHint.background': c(p.paperAlt),
        'editorGhostText.foreground': c(p.inkFaint),
        'editorWidget.background': c(p.paperAlt), 'editorWidget.foreground': c(p.ink),
        'editorWidget.border': c(p.rule), 'editorHoverWidget.background': c(p.paperAlt),
        'editorHoverWidget.border': c(p.rule), 'editorSuggestWidget.background': c(p.paperAlt),
        'editorSuggestWidget.border': c(p.rule), 'editorSuggestWidget.foreground': c(p.ink),
        'editorSuggestWidget.selectedBackground': c(p.selection),
        'editorSuggestWidget.highlightForeground': c(p.accent),
        'minimap.background': c(p.paper), 'minimapSlider.background': c(p.rule) + '60',
        'scrollbar.shadow': '#00000000', 'scrollbarSlider.background': c(p.rule) + '80',
        'scrollbarSlider.hoverBackground': c(p.rule) + 'c0', 'scrollbarSlider.activeBackground': c(p.inkFaint) + '80',

        // Diff
        'diffEditor.insertedTextBackground': c(p.added) + '26', 'diffEditor.removedTextBackground': c(p.deleted) + '26',
        'diffEditor.insertedLineBackground': c(p.added) + '14', 'diffEditor.removedLineBackground': c(p.deleted) + '14',

        // Lists, inputs, buttons, menus
        'list.activeSelectionBackground': c(p.selection), 'list.activeSelectionForeground': c(p.ink),
        'list.inactiveSelectionBackground': c(p.selectionInactive), 'list.inactiveSelectionForeground': c(p.ink),
        'list.hoverBackground': c(p.lineHighlight), 'list.focusOutline': c(p.accent) + '80',
        'list.highlightForeground': c(p.accent), 'list.errorForeground': c(p.error),
        'list.warningForeground': c(p.warning), 'tree.indentGuidesStroke': c(p.rule),
        'input.background': c(p.paper), 'input.foreground': c(p.ink), 'input.border': c(p.rule),
        'input.placeholderForeground': c(p.inkFaint), 'inputOption.activeBorder': c(p.accent),
        'inputOption.activeBackground': c(p.selection),
        'inputValidation.errorBorder': c(p.error), 'inputValidation.warningBorder': c(p.warning),
        'dropdown.background': c(p.paper), 'dropdown.border': c(p.rule), 'dropdown.foreground': c(p.ink),
        'checkbox.background': c(p.paper), 'checkbox.border': c(p.rule),
        'button.background': c(p.accent), 'button.foreground': c(p.paper),
        'button.hoverBackground': c(p.accentHover),
        'button.secondaryBackground': c(p.paperDeep), 'button.secondaryForeground': c(p.ink),
        'button.secondaryHoverBackground': c(p.ruleSoft),
        'badge.background': c(p.paperDeep), 'badge.foreground': c(p.ink),
        'progressBar.background': c(p.accent),
        'menu.background': c(p.paperAlt), 'menu.foreground': c(p.ink), 'menu.border': c(p.rule),
        'menu.selectionBackground': c(p.selection), 'menu.selectionForeground': c(p.ink),
        'menu.separatorBackground': c(p.rule), 'menubar.selectionBackground': c(p.ruleSoft),
        'quickInput.background': c(p.paperAlt), 'quickInput.foreground': c(p.ink),
        'quickInputList.focusBackground': c(p.selection), 'pickerGroup.foreground': c(p.accent),
        'pickerGroup.border': c(p.rule), 'keybindingLabel.background': c(p.paperDeep),
        'keybindingLabel.foreground': c(p.ink), 'keybindingLabel.border': c(p.rule),
        'keybindingLabel.bottomBorder': c(p.rule),
        'notifications.background': c(p.paperAlt), 'notifications.foreground': c(p.ink),
        'notifications.border': c(p.rule), 'notificationCenterHeader.background': c(p.paperDeep),
        'peekView.border': c(p.accent), 'peekViewEditor.background': c(p.paperAlt),
        'peekViewResult.background': c(p.paperAlt), 'peekViewTitle.background': c(p.paperDeep),
        'peekViewEditor.matchHighlightBackground': c(p.findMatch) + '60',
        'peekViewResult.matchHighlightBackground': c(p.findMatch) + '60',

        // Git, terminal
        'gitDecoration.addedResourceForeground': c(p.added), 'gitDecoration.modifiedResourceForeground': c(p.modified),
        'gitDecoration.deletedResourceForeground': c(p.deleted), 'gitDecoration.untrackedResourceForeground': c(p.added),
        'gitDecoration.ignoredResourceForeground': c(p.inkFaint), 'gitDecoration.conflictingResourceForeground': c(p.error),
        'terminal.background': c(p.paper), 'terminal.foreground': c(p.ink),
        'terminalCursor.foreground': c(p.accent), 'terminal.selectionBackground': c(p.selection),
        ...Object.fromEntries(Object.entries(p.ansi).map(([k, v]) => [`terminal.ansi${k}`, c(v)])),
    };

    const scope = (name, scopes, color, fontStyle) =>
        ({name, scope: scopes, settings: {...color && {foreground: color}, ...fontStyle !== undefined && {fontStyle}}});
    const tokenColors = [
        scope('Comment', ['comment', 'punctuation.definition.comment', 'string.comment'], s.comment, 'italic'),
        scope('Doc tags', ['comment keyword', 'comment storage.type', 'storage.type.class.jsdoc'], s.comment, 'italic bold'),
        scope('Keyword', ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'], s.keyword, 'bold'),
        scope('Operator', ['keyword.operator', 'punctuation.separator', 'punctuation.terminator', 'punctuation.accessor'], s.punct, ''),
        scope('Punctuation', ['punctuation', 'meta.brace'], s.punct),
        scope('String', ['string', 'punctuation.definition.string', 'markup.inline.raw'], s.string),
        scope('Escape', ['constant.character.escape', 'string.regexp', 'constant.other.character-class.regexp'], s.regex),
        scope('Number', ['constant.numeric', 'constant.language', 'constant.character', 'support.constant'], s.number),
        scope('Constant', ['variable.other.constant', 'variable.other.enummember', 'entity.name.constant'], s.constant),
        scope('Variable', ['variable', 'meta.definition.variable.name', 'support.variable'], s.variable),
        scope('Parameter', ['variable.parameter', 'meta.parameter'], s.param, 'italic'),
        scope('Property', ['variable.other.property', 'variable.other.object.property', 'meta.object-literal.key', 'support.type.property-name', 'entity.name.tag.yaml'], s.property),
        scope('Function', ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], s.func),
        scope('Type', ['entity.name.type', 'entity.name.class', 'entity.other.inherited-class', 'support.type', 'support.class', 'storage.type.primitive'], s.type),
        scope('Namespace', ['entity.name.namespace', 'entity.name.module', 'entity.name.package'], s.namespace),
        scope('Tag', ['entity.name.tag', 'punctuation.definition.tag'], s.tag),
        scope('Attribute', ['entity.other.attribute-name'], s.attr, 'italic'),
        scope('Decorator', ['meta.decorator', 'entity.name.function.decorator', 'punctuation.decorator'], s.attr),
        scope('Language variable', ['variable.language'], s.keyword, 'italic'),
        scope('Heading', ['markup.heading', 'entity.name.section'], s.keyword, 'bold'),
        scope('Bold', ['markup.bold'], undefined, 'bold'),
        scope('Italic', ['markup.italic'], undefined, 'italic'),
        scope('Strikethrough', ['markup.strikethrough'], undefined, 'strikethrough'),
        scope('Link', ['markup.underline.link', 'string.other.link'], s.func, 'underline'),
        scope('Quote', ['markup.quote'], s.comment, 'italic'),
        scope('List', ['punctuation.definition.list', 'markup.list'], s.keyword),
        scope('Inserted', ['markup.inserted', 'meta.diff.header.to-file'], c(p.added)),
        scope('Deleted', ['markup.deleted', 'meta.diff.header.from-file'], c(p.deleted)),
        scope('Changed', ['markup.changed'], c(p.modified)),
        scope('Invalid', ['invalid', 'invalid.illegal'], c(p.error), 'underline'),
    ];

    return {
        $schema: 'vscode://schemas/color-theme',
        name: p.name,
        type: p.type,
        semanticHighlighting: true,
        semanticTokenColors: {
            'namespace': s.namespace, 'type': s.type, 'class': s.type, 'interface': s.type,
            'enum': s.type, 'typeParameter': {foreground: s.type, italic: true},
            'function': s.func, 'method': s.func, 'macro': s.func,
            'parameter': {foreground: s.param, italic: true}, 'property': s.property,
            'enumMember': s.constant, 'variable': s.variable,
            'variable.readonly': s.constant, 'variable.defaultLibrary': s.constant,
            'keyword': {foreground: s.keyword, bold: true}, 'decorator': s.attr,
            '*.deprecated': {strikethrough: true},
        },
        colors,
        tokenColors,
    };
}

/** WCAG 2 contrast ratio. */
function contrast(a, b) {
    const lum = hex => {
        const [r, g, bl] = parse(hex).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
}

/** Writes both themes; returns true if a file changed. */
function writeThemes(dir, cfg) {
    let changed = false;
    for (const [file, palette] of Object.entries(palettes)) {
        const target = path.join(dir, `${file}-color-theme.json`);
        const json = JSON.stringify(build(palette, cfg), null, 2) + '\n';
        const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        if (json !== old) {
            fs.writeFileSync(target, json);
            changed = true;
        }
    }
    return changed;
}

const DEFAULTS = {printColors: 1, matte: 0.2, brightness: 1, accentColor: 'beige'};

module.exports = {writeThemes, build, contrast, DEFAULTS};

if (require.main === module) {
    writeThemes(path.join(__dirname, '..', 'themes'), DEFAULTS);
    for (const p of Object.values(palettes)) {
        const t = build(p, DEFAULTS);
        const bg = t.colors['editor.background'];
        console.log(`\n${p.name}  (editor ${bg})`);
        const rows = Object.keys(p.syntax).map(k => [k, ink(p.syntax[k], DEFAULTS)]);
        for (const [k, v] of [['foreground', t.colors['editor.foreground']], ...rows,
            ['line numbers', t.colors['editorLineNumber.activeForeground']],
            ['sidebar text', t.colors['sideBar.foreground'] + ' on ' + t.colors['sideBar.background']],
            ['button', t.colors['button.foreground'] + ' on ' + t.colors['button.background']]]) {
            const [fg, , other] = v.split(' ');
            const ratio = contrast(fg, other ?? bg);
            console.log(`  ${k.padEnd(14)} ${v.padEnd(20)} ${ratio.toFixed(2).padStart(5)}${ratio < 4.5 ? '  < AA' : ''}`);
        }
    }
}
