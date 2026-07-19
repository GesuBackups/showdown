/**
 * @file      makehtml/backslash.js
 * @summary   Backslash escapes in the unified inline scan (CommonMark spec §2.4).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes a `\`-escape at the scan cursor: `\`+newline is a hard `<br />`, `\`+`¨D` is an escaped
 * `$`, and any escapable punctuation becomes an HTML-special literal or a Showdown escape placeholder.
 *
 * This is a `makehtml.inline.*` construct subparser called from the single-pass inline scanner in
 * spanGamut.js with the scan state — (scan, options, globals) — consuming (returning the new cursor)
 * or declining (returning null); see entity.js for the fuller scan-convention explanation.
 */

// Backslash-escapable set for the Showdown flavors (vanilla/original): the historic large
// set, reused verbatim from the char class in helpers/encodeBackslashEscapes.js. CommonMark
// (cmSpec) uses the wider isAsciiPunct instead (see isEscapable). File-level const; it is only
// tested (no lastIndex state), so reuse across invocations is safe.
const reShowdownEscapable = /[!#%'()*+,\-./:;=?@[\]\\^_`{|}~]/;

// Gate 1 (backslash escapes, 2-way). CommonMark escapes all ASCII punctuation; the Showdown
// flavors escape the historic large set plus the shared HTML-special chars (& < > ") that the
// `\`-branch entity arm handles. The two sets coincide except for those special chars and `$`
// (pre-hashed to ¨D before inline parsing), so cmSpec output is byte-identical either way.
function isEscapable (ch, options) {
  if (ch === undefined) { return false; }
  if (options.cmSpec) { return showdown.helper.isAsciiPunct(ch); }
  return reShowdownEscapable.test(ch) || ch === '&' || ch === '<' || ch === '>' || ch === '"';
}

// eslint-disable-next-line no-unused-vars -- `globals` is unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.backslash', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos;
  let next = str.charAt(i + 1);
  if (next === '\n') {
    scan.appendRaw(scan.hashSpan('<br />') + '\n');
    return i + 2;
  } else if (next === '¨' && str.charAt(i + 2) === 'D') {
    // escaped `$` (the converter hashes `$` to the `¨D` placeholder early)
    scan.appendText('¨D');
    return i + 3;
  } else if (isEscapable(next, options)) {
    // Emit ordinary escaped punctuation as a Showdown escape placeholder (¨E<code>E)
    // so the later passes (ghMentions, simplifiedAutoLink, emoji, strikethrough,
    // ellipsis, ...) don't treat the char as markup - e.g. `\@user` must not become a
    // mention. unescapeSpecialChars restores the literal char at the end of the
    // pipeline. HTML-special chars stay literal so the render-time escape
    // (showdown.helper.escapeHTMLEntities) turns them into entities
    // (&amp; &lt; &gt; &quot;); placeholders would otherwise round-trip to raw `<`/`&`.
    if (next === '&' || next === '<' || next === '>' || next === '"') {
      scan.appendText(next);
    } else {
      scan.appendText(showdown.helper.escapePlaceholder(next));
    }
    return i + 2;
  }
  // Decline: the char after `\` is not escapable. The scanner falls through to its literal-`\`
  // handling — exactly the case the inline `\`-branch used to fall to its trailing appendText('\\').
  return null;
});
