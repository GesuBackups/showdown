/**
 * @file      makemarkdown/underline.js
 * @summary   Renders `<u>` back to `__`-delimited underline (round-trips cleanly only with the `underline` option on).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown), registered through the shared
 * `makeMarkdownWrapMarkerSubParser` factory. Emits `makeMarkdown.underline.onStart`/`onCapture`/`onEnd`.
 */

// Registered through the shared makeMarkdownWrapMarkerSubParser factory (defined in
// emphasis.js): showdown's forward parser emits <u> for the `underline` option (e.g.
// __text__), so we mirror that here with the `__` wrap marker so <u> round-trips. Note:
// __ is standard-Markdown strong, so this only round-trips cleanly through a converter
// that has the `underline` option enabled. Keeps its own registration and full
// three-phase event family.
showdown.subParser('makeMarkdown.underline', makeMarkdownWrapMarkerSubParser('underline', '__'));
