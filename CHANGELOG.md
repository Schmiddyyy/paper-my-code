# Changelog

## 0.6.0
- **Fix**: the paper texture, mottle and ink effects stayed when switching to another colour theme. They now show only while Paper or Paper Night is active, and go away at once without a reload. Run **Turn On Paper** once to update them.
- **Accent colour** (`paperMyCode.accentColor`): beige, purple, green or blue paper around the editor, strongest on the outer bars and fading inwards through sidebar, tabs and popups to a panel and terminal close to paper. The editor stays plain paper.
- The icon has a transparent background.

## 0.5.0
- **Fix**: ink spread, light scattering, mottle, print colours, matte and brightness could switch themselves off once their strength was changed, because each strength shared its name with its switch. The strengths are now `….strength` (`brightness.level`), and existing values move over on start.
- **Toggle Ink Spread and Light Scattering**: turns both effects on the editor's text on or off in one command.
- The paper is drawn only by Paper my Code itself. **Use Paper in the Background Extension** and `tools/make-backgrounds.js` are removed, so shalldie's background extension is no longer used.
- If you used that command, Paper my Code removes its image from `background.fullscreen` and offers to turn the built-in paper back on.

## 0.3.0
- **Use Paper in the Background Extension**: renders the chosen paper as one seamless image and sets it up in shalldie's background extension.
- `tools/make-backgrounds.js` writes all seven papers as background images.

## 0.2.0
- Themes **Paper** and **Paper Night**, in print colours with matte blacks.
- Ink spread and light scattering on the editor's text.
- Brightness, hide in fullscreen, random texture position.
- **Use Print Font** command.

## 0.1.0
- Paper texture overlay with the seven papers of Paper my Shell, ink mottle, window or editor scope.
