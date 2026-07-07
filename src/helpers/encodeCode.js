/**
 * @file      helpers/encodeCode.js
 * @summary   Entity-encodes and neutralizes Markdown-magic characters inside code spans/blocks.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Encodes `&`/`<`/`>`/`"` and escapes `*_{}[]\=~-` so code interiors render literally. A
 * character-level pass attached as a `showdown.helper.*` mechanism, not a construct; emits no events.
 */

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeCode = function (text) {
  'use strict';

  // Encode all ampersands; HTML entities are not
  // entities within a Markdown code span.
  text = text
    .replace(/&/g, '&amp;')
  // Do the angle bracket song and dance:
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // encode "
    .replace(/"/g, '&quot;')
  // Now, escape characters that are magic in Markdown:
    .replace(/([*_{}[\]\\=~-])/g, showdown.helper.escapeCharactersCallback);

  return text;
};
