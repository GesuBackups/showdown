/**
 * @file      helpers/escapes.js
 * @summary   Character escaping and showdown's internal escape/sentinel placeholder plumbing.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `escapeCharactersCallback`, the `¨E<code>E` escape-placeholder scheme
 * (`escapePlaceholder`/`unescapePlaceholders`), the `$`/`¨` sentinel restore
 * (`restoreDollarsAndTremas`) and HTML entity (un)escaping. Load-order safe: no
 * other-helper reads happen at load time.
 */

function escapeCharactersCallback (wholeMatch, m1) {
  'use strict';
  return showdown.helper.escapePlaceholder(m1);
}

/**
 * Callback used to escape characters when passing through String.replace
 * @static
 * @param {string} wholeMatch
 * @param {string} m1
 * @returns {string}
 */
showdown.helper.escapeCharactersCallback = escapeCharactersCallback;

// --- Internal escape-placeholder scheme (single source of truth) ------------------------
// A protected character X (e.g. a backslash-escaped punctuation mark) is stored as the
// placeholder `¨E<charCode>E` so later passes don't treat it as markup; it is restored to
// the literal character at the end of the pipeline (showdown.helper.unescapePlaceholders) or
// wherever a bare/backslashed form is needed.

/**
 * Produce the escape placeholder for a single character.
 * @param {string} chr
 * @returns {string}
 */
showdown.helper.escapePlaceholder = function (chr) {
  return '¨E' + chr.charCodeAt(0) + 'E';
};

/**
 * Restore every `¨E<code>E` placeholder in a string. Without `transform` each placeholder
 * becomes its literal character; `transform` (given that character) can customize the
 * replacement (e.g. re-adding a leading backslash inside raw HTML).
 * @param {string} text
 * @param {function(string):string} [transform]
 * @returns {string}
 */
showdown.helper.unescapePlaceholders = function (text, transform) {
  return text.replace(/¨E(\d+)E/g, function (wholeMatch, code) {
    let chr = String.fromCharCode(parseInt(code, 10));
    return transform ? transform(chr) : chr;
  });
};

// `$` and `¨` are swapped for the two-char sentinels `¨D`/`¨T` at the very start of
// makeHtml (see the converter's hashDollarsAndTremas) so they survive the pipeline
// without being read as regex-replacement metacharacters or as showdown's `¨` escape
// marker; they are restored verbatim at the end. The restorer reverses in the opposite
// order to the producer (which replaces `¨` first).

/**
 * Restore the `¨D`/`¨T` sentinels back to literal `$` and `¨`.
 * @param {string} text
 * @returns {string}
 */
showdown.helper.restoreDollarsAndTremas = function (text) {
  return text.replace(/¨D/g, function () { return '$'; })
    .replace(/¨T/g, function () { return '¨'; });
};

/**
 * Unescape HTML entities
 * @param txt
 * @returns {string}
 */
showdown.helper.unescapeHTMLEntities = function (txt) {
  'use strict';

  return txt
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

/**
 * HTML-escape the characters that are significant in element and (double-quoted)
 * attribute contexts: `&`, `<`, `>`, `"`. Ampersand is escaped unconditionally,
 * so callers must pass a decoded/plain string (not one that already contains
 * entities they wish to preserve). Used to harden values that are concatenated
 * straight into generated markup (e.g. document metadata).
 * @param {string} str
 * @returns {string}
 */
showdown.helper.escapeHTMLEntities = function (str) {
  'use strict';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
