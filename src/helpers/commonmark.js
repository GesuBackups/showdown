/**
 * @file      helpers/commonmark.js
 * @summary   CommonMark-specific text processing: entity decoding, URL/title normalization, label folding and scanners.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `cmDecodeEntities`, `cmEncodeURI`, `cmNormalizeURL`, `cmEscapeTitle`, `cmNormalizeLabel` and the
 * link-destination/title scanners (`cmScanDestination`/`cmScanTitle`). Load-order safe: every
 * reference to another helper (`htmlEntities`, `caseFold`, `unescapePlaceholders`) happens inside
 * function bodies (call time), never at load time.
 */

// Guarded ampersand: a bare `&` that does NOT already begin an entity reference. Shared by
// cmNormalizeURL and cmEscapeTitle (both HTML-escape residual bare ampersands the same way).
// File-local const (load-order safe: only read inside function bodies below, at call time).
const cmGuardedAmpersand = /&(?![a-zA-Z#0-9]+;)/g;

/**
 * The single character-reference decoder backing both `cmDecodeEntities` (raw output) and the
 * `makehtml.decodeEntities` subparser (HTML-re-escaped output). Resolves HTML5 named (`&ouml;`),
 * decimal (`&#246;`) and hexadecimal (`&#xf6;`) references. The `escapeOutput` policy flag is the
 * only difference between the two public surfaces:
 *  - `false` (CommonMark helper): emit the raw decoded character; leave an invalid reference verbatim.
 *  - `true` (subparser): HTML-escape the decoded character (so e.g. `&lt;` -> `&lt;`, not a live `<`)
 *    and rewrite an invalid reference's leading `&` to `&amp;`.
 * @param {string} str
 * @param {boolean} escapeOutput
 * @returns {string}
 */
showdown.helper.decodeCharacterReferences = function (str, escapeOutput) {
  let entities = showdown.helper.htmlEntities || {};
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
  function emit (ch) {
    return escapeOutput ? showdown.helper.escapeHTMLEntities(ch) : ch;
  }
  return str.replace(/&([#0-9a-zA-Z]+);/g, function (wholeMatch, body) {
    let m;
    if ((m = /^#([0-9]{1,7})$/.exec(body))) {
      return emit(fromCodePoint(parseInt(m[1], 10)));
    }
    if ((m = /^#[xX]([0-9a-fA-F]{1,6})$/.exec(body))) {
      return emit(fromCodePoint(parseInt(m[1], 16)));
    }
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(body) && Object.prototype.hasOwnProperty.call(entities, body)) {
      return emit(entities[body]);
    }
    // not a valid reference
    return escapeOutput ? ('&amp;' + body + ';') : wholeMatch;
  });
};

/**
 * Resolve HTML5 named (`&ouml;`), decimal (`&#246;`) and hexadecimal (`&#xf6;`)
 * character references to their corresponding characters (CommonMark behavior).
 * Unlike makehtml.decodeEntities, this returns the raw decoded characters (no
 * HTML re-escaping) so the result can be percent-encoded for a URL or further
 * processed. Invalid references are left verbatim.
 * @param {string} str
 * @returns {string}
 */
showdown.helper.cmDecodeEntities = function (str) {
  return showdown.helper.decodeCharacterReferences(str, false);
};

/**
 * CommonMark URL percent-encoding: percent-encode every character outside the
 * "safe" set, while preserving sequences that are already percent-encoded.
 * Mirrors mdurl.encode's default behavior.
 * @param {string} uri
 * @returns {string}
 */
showdown.helper.cmEncodeURI = function (uri) {
  const safe = ';/?:@&=+$,-_.!~*\'()#';
  let out = '';
  for (let i = 0; i < uri.length; ++i) {
    let ch = uri.charAt(i),
        code = uri.charCodeAt(i);
    if (ch === '%' && /^[0-9a-fA-F]{2}$/.test(uri.slice(i + 1, i + 3))) {
      out += uri.slice(i, i + 3);
      i += 2;
    } else if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) ||
               (code >= 97 && code <= 122) || safe.indexOf(ch) !== -1) {
      out += ch;
    } else {
      out += encodeURIComponent(ch);
    }
  }
  return out;
};

/**
 * Full CommonMark URL normalization for a link/image destination:
 * 1. restore showdown's `¨E<code>E` backslash-escape placeholders to their literal
 *    characters (so escaped punctuation is treated literally, not re-processed);
 * 2. resolve raw backslash escapes of ASCII punctuation (`\*` -> `*`); a backslash
 *    before a non-punctuation character stays literal (and is later percent-encoded);
 * 3. resolve HTML character references (`&ouml;` -> `ö`);
 * 4. percent-encode the result;
 * 5. HTML-escape any residual bare `&` so the href stays valid HTML.
 * @param {string} url
 * @returns {string}
 */
showdown.helper.cmNormalizeURL = function (url) {
  url = showdown.helper.unescapePlaceholders(url);
  url = url.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  url = showdown.helper.cmDecodeEntities(url);
  url = showdown.helper.cmEncodeURI(url);
  return url.replace(cmGuardedAmpersand, '&amp;');
};

/**
 * CommonMark link/image title processing: resolve character references, then
 * HTML-escape the significant characters so the title attribute is valid HTML.
 * @param {string} title
 * @returns {string}
 */
showdown.helper.cmEscapeTitle = function (title) {
  return showdown.helper.cmDecodeEntities(title)
    .replace(cmGuardedAmpersand, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Normalize a CommonMark link label for reference matching: restore showdown's
 * `¨E<code>E` escape placeholders to their literal character, collapse internal
 * whitespace runs to a single space, trim and case-fold. The same normalization
 * must be applied to both the definition label and the use label so that they
 * compare equal.
 * @param {string} label
 * @returns {string}
 */
showdown.helper.cmNormalizeLabel = function (label) {
  // CommonMark matches labels by case-fold + whitespace collapse only; raw backslash
  // escapes are NOT resolved (`[foo\!]` does not match a `[foo!]` definition), which is
  // why cmInline passes the raw source label. The `¨E<code>E` replace below only restores
  // placeholders produced earlier in the pipeline, so definition and use labels that went
  // through the same escaping normalize identically.
  return showdown.helper.caseFold(showdown.helper.unescapePlaceholders(label)
    .replace(/\s+/g, ' ')
    .trim());
};

/**
 * Scan a CommonMark link destination starting at index `j`. Handles both
 * `<...>` destinations (no raw newline or unescaped `<`) and bare destinations
 * with balanced parentheses. Returns `{url, end, angle}` (url may be empty for
 * `<>`) or `null` when the destination is malformed.
 * @param {string} str
 * @param {number} j
 * @returns {{url: string, end: number, angle: boolean}|null}
 */
showdown.helper.cmScanDestination = function (str, j) {
  let n = str.length;
  if (str.charAt(j) === '<') {
    j++;
    let buf = '';
    while (j < n && str.charAt(j) !== '>') {
      let c = str.charAt(j);
      if (c === '\n' || c === '<') { return null; }
      if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
      buf += c; j++;
    }
    if (j >= n || str.charAt(j) !== '>') { return null; }
    return {url: buf, end: j + 1, angle: true};
  }
  let depth = 0, buf = '';
  while (j < n) {
    let c = str.charAt(j),
        code = str.charCodeAt(j);
    if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
    if (c === ' ' || c === '\t' || c === '\n') { break; }
    if (code < 0x20 || code === 0x7f) { break; }
    if (c === '(') { depth++; buf += c; j++; continue; }
    if (c === ')') {
      if (depth === 0) { break; }
      depth--; buf += c; j++; continue;
    }
    buf += c; j++;
  }
  if (depth !== 0) { return null; }
  return {url: buf, end: j, angle: false};
};

/**
 * Scan a CommonMark link title starting at index `j` (which must point at the
 * opening delimiter `"`, `'` or `(`). The title may span multiple lines but not
 * contain a blank line. Returns `{title, end}` or `null` if malformed.
 * @param {string} str
 * @param {number} j
 * @returns {{title: string, end: number}|null}
 */
showdown.helper.cmScanTitle = function (str, j) {
  let n = str.length,
      open = str.charAt(j),
      close = (open === '(') ? ')' : open;
  if (open !== '"' && open !== '\'' && open !== '(') { return null; }
  j++;
  let buf = '';
  while (j < n) {
    let c = str.charAt(j);
    if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
    if (open === '(' && c === '(') { return null; }
    if (c === close) {
      if (/\n[ \t]*\n/.test(buf)) { return null; }
      return {title: buf, end: j + 1};
    }
    buf += c; j++;
  }
  return null;
};
