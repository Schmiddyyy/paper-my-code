// The themes' colours before printing (see theme.js). Paper and ink tones,
// with syntax colours a printer would choose: reds and ochres carry, blue,
// violet and green are dark and quiet, and the print table calms them more.

module.exports = {
    'paper': {
        name: 'Paper', type: 'light',
        paper: '#fcf9f2', paperAlt: '#f5f0e5', paperDeep: '#ece5d5',
        rule: '#d9cfbc', ruleSoft: '#e6dfcf',
        ink: '#26251f', inkSoft: '#57534a', inkFaint: '#827b6c',
        accent: '#8b2f3c', accentHover: '#73252f',
        selection: '#e6d9b6', selectionInactive: '#eee6d2', lineHighlight: '#f4eee0',
        findMatch: '#e2b85a',
        // Title bar, activity bar and status bar, by paperMyCode.accentColor.
        bars: {beige: '#ece5d5', purple: '#e2d8ea', green: '#d9e4cd', blue: '#d3dfea'},
        added: '#4a7335', modified: '#9c6c1e', deleted: '#a3352d',
        error: '#a8241b', warning: '#8f5a0c', info: '#2c5785',
        syntax: {
            comment: '#736b5b', keyword: '#8b2f3c', string: '#476426',
            number: '#9a4b16', constant: '#9a4b16', func: '#2a4a78',
            type: '#5a4688', property: '#2b5957', param: '#69471f',
            variable: '#26251f', namespace: '#57534a', punct: '#625d53',
            tag: '#8b2f3c', attr: '#9a4b16', regex: '#86591a',
        },
        ansi: {
            Black: '#26251f', Red: '#a3352d', Green: '#4a7335', Yellow: '#8f5a0c',
            Blue: '#2c5785', Magenta: '#7a3a6e', Cyan: '#2b5957', White: '#d9cfbc',
            BrightBlack: '#827b6c', BrightRed: '#b8483d', BrightGreen: '#5c8744',
            BrightYellow: '#a86d17', BrightBlue: '#3d6a99', BrightMagenta: '#8f4d82',
            BrightCyan: '#3b6e6b', BrightWhite: '#f5f0e5',
        },
    },
    'paper-night': {
        name: 'Paper Night', type: 'dark',
        paper: '#1d1c19', paperAlt: '#191815', paperDeep: '#151411',
        rule: '#34312b', ruleSoft: '#2a2823',
        ink: '#ded7c8', inkSoft: '#aaa294', inkFaint: '#827b6d',
        accent: '#d98a7d', accentHover: '#e6a195',
        selection: '#3e3a31', selectionInactive: '#312e28', lineHighlight: '#24221e',
        findMatch: '#8a6a2a',
        bars: {beige: '#151411', purple: '#211a2a', green: '#17211a', blue: '#151e2a'},
        added: '#93b06d', modified: '#d4a95c', deleted: '#df7b70',
        error: '#ec7c70', warning: '#dcaa52', info: '#93b2d8',
        syntax: {
            comment: '#8e877a', keyword: '#e3958a', string: '#afc488',
            number: '#e2ab70', constant: '#e2ab70', func: '#97b6dc',
            type: '#c0acdf', property: '#91c6be', param: '#ddc8a6',
            variable: '#ded7c8', namespace: '#aaa294', punct: '#a39c8e',
            tag: '#e3958a', attr: '#e2ab70', regex: '#dbb86d',
        },
        ansi: {
            Black: '#1d1c19', Red: '#df7b70', Green: '#93b06d', Yellow: '#d4a95c',
            Blue: '#93b2d8', Magenta: '#c99ac0', Cyan: '#91c6be', White: '#ded7c8',
            BrightBlack: '#827b6d', BrightRed: '#eb968c', BrightGreen: '#a9c487',
            BrightYellow: '#e2bd78', BrightBlue: '#aac4e4', BrightMagenta: '#d8b1d0',
            BrightCyan: '#a9d6cf', BrightWhite: '#f2ecdf',
        },
    },
};
