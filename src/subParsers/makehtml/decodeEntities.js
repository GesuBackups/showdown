/**
 * @file      makehtml/decodeEntities.js
 * @summary   Resolves HTML named/decimal/hex character references to their characters, per CommonMark; gated by `decodeEntities`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Diverges from Showdown's default (which preserves entities verbatim), so it is gated behind the
 * `decodeEntities` option (enabled by the `commonmark` flavor). It runs late — after inline parsing
 * and while code spans/blocks are still hashed — so decoded characters are not re-parsed as Markdown
 * and entities inside code stay escaped. Registered as a subparser for flavor-gating but deliberately
 * emits no events.
 */

// Deliberate exception to the "spec-chapter chapter ⇒ construct with events" rule: this pass
// decodes character references to bare characters, so per-entity capture events would be noise.
// It stays a registered subparser (flavor-gated conversion logic) but emits NO events.
showdown.subParser('makehtml.decodeEntities', function (text, options, globals) {
  'use strict';

  if (!options.decodeEntities) {
    return text;
  }

  const entities = showdown.helper.htmlEntities;

  // Map a code point to its character, replacing disallowed values with U+FFFD.
  function fromCodePoint (cp) {
    if (cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) {
      return '�';
    }
    try {
      return String.fromCodePoint(cp);
    } catch {
      return '�';
    }
  }

  // Match any `&…;` candidate that survived encodeAmpsAndAngles (which already escaped
  // bare ampersands and `&name`/`&name?;` non-references). We classify each candidate here.
  // Decoded characters are re-escaped (escapeHTMLEntities) so a decoded char (e.g.
  // `&lt;` -> `<`) stays a literal in the HTML output rather than being read as markup.
  text = text.replace(/&([#0-9a-zA-Z]+);/g, function (wholeMatch, body) {
    let m;
    // decimal numeric reference: 1-7 digits
    if ((m = /^#([0-9]{1,7})$/.exec(body))) {
      return showdown.helper.escapeHTMLEntities(fromCodePoint(parseInt(m[1], 10)));
    }
    // hexadecimal numeric reference: 1-6 hex digits
    if ((m = /^#[xX]([0-9a-fA-F]{1,6})$/.exec(body))) {
      return showdown.helper.escapeHTMLEntities(fromCodePoint(parseInt(m[1], 16)));
    }
    // named reference (must be a known HTML5 entity name)
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(body) && Object.prototype.hasOwnProperty.call(entities, body)) {
      return showdown.helper.escapeHTMLEntities(entities[body]);
    }
    // not a valid reference - escape the ampersand and leave the rest intact
    return '&amp;' + body + ';';
  });

  return text;
});
