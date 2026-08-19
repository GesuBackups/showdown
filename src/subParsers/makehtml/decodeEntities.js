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

  // Same character-reference classifier as showdown.helper.cmDecodeEntities, but with the
  // HTML-re-escaping output policy: candidates that survived encodeAmpsAndAngles (which already
  // escaped bare ampersands and `&name`/`&name?;` non-references) are decoded and then re-escaped
  // (escapeHTMLEntities) so a decoded char (e.g. `&lt;` -> `<`) stays a literal in the HTML output
  // rather than being read as markup; an invalid reference has its `&` rewritten to `&amp;`.
  return showdown.helper.decodeCharacterReferences(text, true);
});
