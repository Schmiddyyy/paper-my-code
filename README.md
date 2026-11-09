# Paper my Code

**Code that reads like print, not like a glowing panel.**

Two colour themes for [VSCodium](https://vscodium.com) and VS Code, **Paper** and **Paper Night**, set in the colours offset print can actually reach, with an optional realistic paper texture over the window.

A port of [Paper my Shell](https://github.com/coffeebowl/paper-my-shell) by coffeebowl, a GNOME Shell extension that lays paper over the whole desktop. The textures come from its generator, and the print colours from its gamut table and shader formulas.

| Paper | Paper Night |
|---|---|
| ![Paper theme with paper texture](docs/paper.png) | ![Paper Night theme with paper texture](docs/paper-night.png) |

## Features

**Themes**, installable anywhere, nothing patched:

- **Print colours**: every colour goes through Paper my Shell's 65³ lookup table for offset print on uncoated paper. Blues, violets and bright greens calm down, while reds and ochres stay strong.
- **Matte**: blacks lift towards the charcoal of real ink, and white gets a touch warmer.
- **Set like code in a book**: bold keywords, italic comments and parameters, semantic highlighting.
- **Readable**: every text colour passes WCAG AA, and body text is about 14:1 on Paper and 11.5:1 on Paper Night.
- **Accent colour**: beige, purple, green or blue paper around the editor. It is strongest on the title, activity and status bars and fades inwards through the sidebar, tabs and popups, to a panel and terminal close to paper. The editor stays plain paper.
- **Adjustable**: brightness, matte and print colours are settings, and the themes are rewritten to match.

**Paper**, drawn over the workbench:

- **Seven papers** from Paper my Shell: recycled, drawing, watercolor, washi, laid paper, cardboard and canvas.
- **Paper texture**: a shaded relief of tooth, fibres and pulp formation, lit from the upper left. Shadows show on light surfaces and highlights on dark ones.
- **Ink mottle**: dark areas lighten in soft patches, where ink soaked in unevenly.
- **Ink spread** on the editor's text: strokes grow ragged where the paper takes ink.
- **Light scattering**: dark strokes get a faint halo, and light gaps between them darken a little.
- **Window or editor only**, 1x/2x resolution, adjustable scale for true size, and the texture hides when VSCodium is fullscreen.
- **Self-contained**: the paper is drawn by this extension alone. No other extension is needed.

## Install

**From the extension store** (VSCodium and other editors that use [Open VSX](https://open-vsx.org/extension/schmiddyyy/paper-my-code)):

1. Open Extensions (`Ctrl+Shift+X`), search for **Paper my Code** and click **Install**. Or run:
   ```bash
   codium --install-extension schmiddyyy.paper-my-code
   ```
2. Pick the theme: `Ctrl+K` `Ctrl+T` → **Paper** or **Paper Night**.

Updates then come in automatically.

**From a .vsix** (VS Code, or without the store): download `paper-my-code-x.y.z.vsix` from [Releases](../../releases), then open Extensions → `…` → **Install from VSIX…**, or run `codium --install-extension paper-my-code-x.y.z.vsix`.

That's the theme.

### Accent colour

Set `paperMyCode.accentColor` to `beige`, `purple`, `green` or `blue` (*Settings → Paper my Code → Display → Accent Color*). It colours everything around the editor, strongest at the window's edge:

| Surface | Accent |
|---|---|
| Title bar, activity bar, status bar | full |
| Sidebar, tabs | 60 % |
| Menus, command palette, popups | 45 % |
| Panel, terminal | 15 %, nearly paper |
| Editor | none, plain paper |

The themes are rewritten when it changes; reload the window when it asks you to.

### Paper texture

Run **Paper my Code: Turn On Paper** from the command palette and reload the window. The first time, each paper takes a few seconds to generate; it's cached after that. **Turn Off Paper** removes it again.

### Ink effects

**Paper my Code: Toggle Ink Spread and Light Scattering** turns both effects on the editor's text on or off together. If either one is on, it turns both off. When the paper is on, reload the window when it asks you to.

### Print font

Themes can't set fonts. Install [IBM Plex Mono](https://github.com/IBM/plex), [Courier Prime](https://quoteunquoteapps.com/courierprime/) or [iA Writer Mono](https://github.com/iaolo/iA-Fonts), all free under the SIL Open Font License. Then run **Paper my Code: Use Print Font**:

```bash
sudo apt install fonts-ibm-plex        # Debian, Ubuntu
sudo dnf install ibm-plex-mono-fonts   # Fedora
```

## Settings

All under *Settings → Paper my Code*. Defaults are Paper my Shell's.

| Setting | Default | |
|---|---|---|
| `paperMyCode.paper` | `drawing` | Which paper |
| `paperMyCode.accentColor` | `beige` | `beige`, `purple`, `green` or `blue` around the editor |
| `paperMyCode.texture.intensity` | `0.05` | Strength of the relief, subtle on purpose |
| `paperMyCode.texture.darkBalance` | `0.4` | Strength on dark surfaces relative to light ones |
| `paperMyCode.texture.grain` | `0.5` | Pixel-fine fibres and grain |
| `paperMyCode.mottle.strength` | `0.04` | Ink mottle |
| `paperMyCode.printColors.strength` | `1` | How far colours move into the print gamut |
| `paperMyCode.matte.strength` | `0.2` | Black lift; `1` is the black of uncoated paper |
| `paperMyCode.brightness.level` | `0.9`, off | Dims the themes |
| `paperMyCode.inkSpread.strength` | `0.4` | Ink spread on the editor's text |
| `paperMyCode.lightScatter.strength` | `0.6` | Light scattering on the editor's text |
| `paperMyCode.scope` | `window` | `window` or `editor` |
| `paperMyCode.resolution` | `1x` | `2x` for HiDPI displays |
| `paperMyCode.scale` | `1` | Feature size; for true size, use dpi ÷ (110 × display scaling) |

Every effect also has an `….enabled` switch.

The texture is meant to be barely noticeable, as in Paper my Shell; you feel it more than see it. If you want it plainly visible, raise `texture.intensity` to two or three times the default.

## How it works

The themes are ordinary colour themes. `src/theme.js` takes the palette in `src/palette.js` and puts every colour through Paper my Shell's print shader steps, in its order: print colour table, matte, paper tint, brightness.

The texture is two layers over the window:

- **Shadows**: black tiles whose alpha is the relief's shadows.
- **Highlights and mottle**: white tiles.

Normal alpha blending gives exactly what Paper my Shell's shader does. Black at alpha *a* multiplies what's below by (1−*a*), and white lightens it like `screen`. Each layer's CSS `opacity` carries the strength, so the GPU applies it in floating point and the subtle default strengths don't band.

Ink spread and light scattering are an SVG filter on the editor's text area. It is the one place a web page can read its own pixels.

## Limitations

- **Images and webviews:** print colours, matte and brightness apply to the themes' colours, not to images, icons and webviews as in Paper my Shell.
- **True size** has to be entered by hand, because VSCodium can't read the monitor's physical size.

## Development

```
src/palette.js       the themes' colours before printing
src/theme.js         print colours, matte, brightness → themes/
src/print-lut.bin    Paper my Shell's print-lut.png as raw RGB
src/paper.js         texture cache, layer baking, PNG writer
src/filters.js       ink spread and light scattering (SVG filter)
src/patcher.js       workbench.html and its checksum in product.json
src/worker.mjs       runs the texture generator off the main thread
src/extension.js     commands and settings
src/uninstall.js     restores workbench.html after uninstalling
vendor/papergen.mjs  Paper my Shell's texture generator, unchanged
```

No dependencies. Node 20 or later for the scripts:

```bash
npm run themes        # rebuild themes/ and print the contrast report
npm run package       # build the .vsix
```

To try changes, open the folder in VSCodium and press `F5` for an Extension Development Host.

## Credits

The paper textures, print gamut table and effect formulas are from [Paper my Shell](https://github.com/coffeebowl/paper-my-shell) by coffeebowl. Its texture generator is included unchanged in `vendor/`.

## License

[GPL-3.0-or-later](LICENSE), as Paper my Shell, whose code this contains.
