/**
 * @file      makemarkdown/strikethrough.js
 * @summary   Renders `<del>`/`<s>` back to GFM `~~`-delimited strikethrough.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown), registered through the shared
 * `makeMarkdownWrapMarkerSubParser` factory. Emits `makeMarkdown.strikethrough.onStart`/`onCapture`/`onEnd`.
 */

// Registered through the shared makeMarkdownWrapMarkerSubParser factory (defined in
// emphasis.js): strikethrough differs from its siblings only in the `~~` wrap marker and
// its event family. Keeps its own registration and full three-phase event family.
showdown.subParser('makeMarkdown.strikethrough', makeMarkdownWrapMarkerSubParser('strikethrough', '~~'));
