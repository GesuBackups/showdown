/**
 * @file      makehtml/encodeAmpsAndAngles.js
 * @summary   Encodes stray `&`, `<`, `>`, `"` to HTML entities (leaving real entity references intact).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A character-level encoding pass attached as a `showdown.helper.*` mechanism, not a construct;
 * emits no events.
 */

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeAmpsAndAngles = function (text) {
  'use strict';

  // Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
  // http://bumppo.net/projects/amputator/
  text = text.replace(/&(?!#?[xX]?(?:[\da-fA-F]+|\w+);)/g, '&amp;');

  // Encode naked <'s
  text = text.replace(/<(?![a-z/?$!])/gi, '&lt;');

  // Encode <
  text = text.replace(/</g, '&lt;');

  // Encode >
  text = text.replace(/>/g, '&gt;');

  // encode "
  text = text.replace(/"/g, '&quot;');

  return text;
};
