/**
 * @file      makehtml/encodeBackslashEscapes.js
 * @summary   Resolves Markdown backslash escapes (`\*`, `\_`, …) into placeholder escapes so those characters lose Markdown meaning.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Uses a hand-optimized replace chain that sidesteps the slow `RegExp` constructor (this runs very
 * frequently). A character-level pass attached as a `showdown.helper.*` mechanism, not a construct;
 * emits no events.
 */

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeBackslashEscapes = function (text) {
  'use strict';

  text = text
    .replace(/\\(\\)/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\([!#%'()*+,\-./:;=?@[\]\\^_`{|}~])/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\¨D/g, '¨D') // escape $ (which was already escaped as ¨D) (charcode is 36)
    .replace(/\\&/g, '&amp;') // escape &
    .replace(/\\"/g, '&quot;') // escaping "
    .replace(/\\</g, '&lt;') // escaping <
    .replace(/\\>/g, '&gt;'); // escaping >

  return text;
};
