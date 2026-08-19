/**
 * @file      makemarkdown/strong.js
 * @summary   Renders `<strong>`/`<b>` back to `**`-delimited strong.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown), registered through the shared
 * `makeMarkdownWrapMarkerSubParser` factory. Emits `makeMarkdown.strong.onStart`/`onCapture`/`onEnd`.
 */

// Registered through the shared makeMarkdownWrapMarkerSubParser factory (defined in
// emphasis.js): strong differs from its siblings only in the `**` wrap marker and its
// event family. Keeps its own registration and full three-phase event family.
showdown.subParser('makeMarkdown.strong', makeMarkdownWrapMarkerSubParser('strong', '**'));
