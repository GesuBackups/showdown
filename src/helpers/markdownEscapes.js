/**
 * @file      helpers/markdownEscapes.js
 * @summary   Backslash-escaping for makeMarkdown emitters (destination/title/text) to prevent round-trip injection.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The `escapeMarkdownDestination`/`escapeMarkdownTitle`/`escapeMarkdownText` helpers used by the HTML->Markdown converters. Load-order safe: no other-helper reads at load time.
 */

/**
 * makeMarkdown emitters: backslash-escape the characters that would otherwise let
 * an attribute value break out of the generated Markdown syntax and inject new
 * constructs when the Markdown is re-rendered (round-trip injection).
 *
 * - Destination: emitted inside `<...>`, so `\`, `<` and `>` must be escaped.
 * - Title: emitted inside `"..."`, so `\` and `"` must be escaped.
 * - Text (link/image alt): emitted inside `[...]`, so `\`, `[` and `]` must be escaped.
 */
showdown.helper.escapeMarkdownDestination = function (url) {
  'use strict';
  return String(url).replace(/([\\<>])/g, '\\$1');
};
showdown.helper.escapeMarkdownTitle = function (title) {
  'use strict';
  return String(title).replace(/([\\"])/g, '\\$1');
};
showdown.helper.escapeMarkdownText = function (text) {
  'use strict';
  return String(text).replace(/([\\[\]])/g, '\\$1');
};
