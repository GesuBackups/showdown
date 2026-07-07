/**
 * @file      makehtml/escapeSpecialCharsWithinTagAttributes.js
 * @summary   Escapes Markdown-magic characters inside raw HTML tags/comments so they don't trigger inline parsing.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Within tags — between `<` and `>` — encodes `` \ ` * _ ~ = | `` so they don't conflict with their
 * Markdown meanings. Skipped in cmSpec mode (where raw HTML is recognized/hashed strictly). A
 * `showdown.helper.*` mechanism, not a construct; emits no events.
 */

// Mechanism (not a construct): a character-level escaping pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.escapeSpecialCharsWithinTagAttributes = function (text, options) {
  'use strict';

  // In CommonMark raw-HTML mode this escaping is skipped: inline raw HTML is instead
  // recognized with the strict grammar and hashed in spanGamut (makehtml.hashCmRawHTML),
  // after backslash escapes and link/image destinations have been resolved. Escaping
  // `=`/`_`/etc. here would corrupt that later strict tag recognition.
  if (!options.cmSpec) {
    // Build a regex to find HTML tags.
    let tags     = /<\/?[a-z\d_:-]+(?:\s+[\s\S]+?)?>/gi,
        comments = /<!(--(([^>-]|-[^>])([^-]|-[^-])*)--)>/gi;

    text = text.replace(tags, function (wholeMatch) {
      return wholeMatch
        .replace(/(.)<\/?code>(?=.)/g, '$1`')
        .replace(/([\\`*_~=|])/g, showdown.helper.escapeCharactersCallback);
    });

    text = text.replace(comments, function (wholeMatch) {
      return wholeMatch
        .replace(/([\\`*_~=|])/g, showdown.helper.escapeCharactersCallback);
    });
  }

  return text;
};
