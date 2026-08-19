/**
 * @file      makehtml/rawHtml.js
 * @summary   Raw inline HTML in the unified inline scan (CommonMark spec §6.6) plus the Showdown-only whole-`<a>` swallow.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Two `makehtml.inline.*` construct subparsers triggered by `<` in the single-pass inline scanner
 * (spanGamut.js), both hashing the matched HTML to a `¨C<n>C` span placeholder so later passes leave
 * it intact:
 *   - `makehtml.inline.rawHtml.wholeAnchor` — Showdown flavors only: swallow a whole raw
 *     `<a ...>...</a>` atomically so the simplifiedAutoLink post-pass cannot re-link its inner text.
 *   - `makehtml.inline.rawHtml` — recognize a single CommonMark inline HTML tag/comment/PI/decl/CDATA.
 *
 * Both follow the scan-state convention — (scan, options, globals) — consuming (returning the new
 * cursor) or declining (returning null); see entity.js for the fuller scan-convention explanation.
 */

// Showdown flavors only (see the `!cmSpec` gate inside the handler): a whole raw inline
// `<a ...>...</a>` is consumed atomically so its inner text is never re-linked by the
// simplifiedAutoLink naked-URL post-pass (mirrors the "hash the whole <a>" step legacy
// link.js ran before naked links). Sticky + anchored at the scan cursor; a single
// `[\s\S]*` (linear backtrack to the last `</a>`) keeps it ReDoS-safe. cmSpec keeps the
// CommonMark behavior (open/close tags recognized separately, inner content parsed).
const reWholeAnchor = /<a\s[^>]*>[\s\S]*<\/a>/y;

// The inline raw-HTML recognizer, built from the shared CommonMark HTML-tag source. This read of
// showdown.helper.regexes.cmHTMLTagSource happens at LOAD time (file-level const): cmHTMLTagSource
// is defined in a src/helpers file (helpers/regexes.js), and helpers load before subParsers in the
// concat ORDER, so a load-time read from a subParsers file is safe. Sticky + anchored at the scan
// cursor so it never slices the tail of the string.
const reRawHtml = new RegExp('(?:' + showdown.helper.regexes.cmHTMLTagSource + ')', 'y');

// Productions whose content class matches newlines and which only end at a required terminator:
// the sticky regex above scans to end-of-input before failing whenever the terminator is missing,
// and the engine dispatches at EVERY `<`, so an opener run costs one full scan each — O(n^2)
// (`'<!DOCTYPE x '.repeat(8000)` took ~3.2s). None of the other productions can match at these
// prefixes (an open tag needs `<` + letter, a close tag `</`, and `-`/`[` are not letters), so
// when the terminator is absent the whole attempt is skipped. Same reasoning as the whole-anchor
// guard above: a production that cannot close cannot match.
//
// NOTE `scan.str` is the current block's text, not the document, so "no terminator ahead" is
// scoped to this block — which is exactly the scope the match would have had.
const rawHtmlEndings = [
  {prefix: '<![CDATA[', memo: 'cdata',       ends: [']]>']},
  {prefix: '<?',        memo: 'pi',          ends: ['?>']},
  {prefix: '<!',        memo: 'declaration', ends: ['>'], letterAfter: true}
];

/**
 * Length of the HTML comment starting at `i`, or -1 if there is none.
 *
 * Recognizes exactly the language of the `cmHTMLComment` production in helpers/regexes.js —
 * including the `<!-->`/`<!--->` literals and Showdown's deliberate `--!>` terminator — but as a
 * cursor scan, and so is used in place of that alternative. A terminator-presence guard cannot
 * cover this production: its content loop consumes dashes in threes, so it steps over a `-->`
 * whose preceding dash run is the wrong length and then runs on to end-of-input
 * (`'z <!--a---> '.repeat(8000)` took ~900ms, quadratic, with a terminator present throughout).
 *
 * The grammar is deterministic with at most four characters of lookahead, so the walk from a
 * given cursor is fixed. `failed` caches the cursors already known to run out of input, which is
 * what keeps a RUN of openers linear: two walks that meet at the same cursor have the same fate,
 * so a later opener stops as soon as it merges into an earlier failed walk. Without it each
 * opener would still pay a full scan — the scan is linear, the run of them was not.
 *
 * Equivalence with the regex verified by differential fuzzing over ~36M positions.
 *
 * Note the dash-run parity is CommonMark's actual comment language (content may not end in `-`),
 * verified against the reference implementation — it must be preserved exactly, not "simplified"
 * to a lazy `[\s\S]*?` scan, which would wrongly accept `<!--a--->`.
 */
function scanHTMLComment (str, i, failed) {
  'use strict';
  let n = str.length;
  if (str.charAt(i) !== '<' || str.charAt(i + 1) !== '!' ||
      str.charAt(i + 2) !== '-' || str.charAt(i + 3) !== '-') { return -1; }
  // the two literal forms have no content section at all
  if (str.charAt(i + 4) === '>') { return 5; }
  if (str.charAt(i + 4) === '-' && str.charAt(i + 5) === '>') { return 6; }

  let j = i + 4,
      path = [];
  while (j < n) {
    if (failed[j] === 1) { break; }
    path.push(j);
    if (str.charAt(j) !== '-') { j++; continue; }
    if (j + 1 >= n) { break; }
    if (str.charAt(j + 1) !== '-') { j += 2; continue; }
    // at `--`: either a terminator, or content that consumes the pair plus what follows
    if (j + 2 >= n) { break; }
    let c2 = str.charAt(j + 2);
    if (c2 === '>') { return j + 3 - i; }
    if (c2 !== '!') { j += 3; continue; }
    if (j + 3 >= n) { break; }
    if (str.charAt(j + 3) === '>') { return j + 4 - i; }
    j += 4;
  }
  // no terminator reachable from any cursor on this walk
  for (let p = 0; p < path.length; ++p) { failed[path[p]] = 1; }
  return -1;
}

/**
 * True when the production that could start at `i` has no terminator ahead of it, so the regex
 * attempt is guaranteed to fail. Terminator positions are found once per production per scan and
 * memoized on `scan.memos` (fresh per scan object, and `scan.str` never changes under it).
 */
function cannotClose (scan, str, i) {
  'use strict';
  let memo = scan.memos.rawHtmlEnds || (scan.memos.rawHtmlEnds = {});
  for (let k = 0; k < rawHtmlEndings.length; ++k) {
    let e = rawHtmlEndings[k];
    if (str.slice(i, i + e.prefix.length) !== e.prefix) { continue; }
    if (e.letterAfter && !/[A-Za-z]/.test(str.charAt(i + e.prefix.length))) { continue; }
    if (memo[e.memo] === undefined) {
      let last = -1;
      for (let t = 0; t < e.ends.length; ++t) {
        last = Math.max(last, str.lastIndexOf(e.ends[t]));
      }
      memo[e.memo] = last;
    }
    return memo[e.memo] < i;
  }
  return false;
}

// eslint-disable-next-line no-unused-vars -- `globals` is unused here (scan.hashSpan closes over it) but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.rawHtml.wholeAnchor', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos;
  // Showdown flavors: swallow a whole raw `<a ...>...</a>` as one hashed span so the
  // simplifiedAutoLink post-pass cannot re-link the anchor's inner text (double-link).
  // cmSpec keeps CommonMark's per-tag recognition.
  if (!options.cmSpec && (str.charAt(i + 1) === 'a' || str.charAt(i + 1) === 'A')) {
    // Lazily-computed position of the LAST `</a>` (case-insensitive) in the string, memoized on
    // scan.memos across the scan; -2 = not yet computed, -1 = none. The whole-anchor swallow below
    // can only match when a `</a>` lies ahead of the cursor, so this guard caps its cost on
    // `</a>`-free input (each failed regex attempt would otherwise scan to EOF -> O(n^2) on
    // `'<a '.repeat(n)`).
    if (scan.memos.lastAnchorClose === undefined) { scan.memos.lastAnchorClose = -2; }
    if (scan.memos.lastAnchorClose === -2) { scan.memos.lastAnchorClose = str.toLowerCase().lastIndexOf('</a>'); }
    if (scan.memos.lastAnchorClose > i) {
      reWholeAnchor.lastIndex = i;
      let a = reWholeAnchor.exec(str);
      if (a) { scan.appendRaw(scan.hashSpan(a[0])); return i + a[0].length; }
    }
  }
  // Decline: cmSpec, not an `<a`, no `</a>` ahead, or no whole-anchor match at the cursor.
  return null;
});

showdown.subParser('makehtml.inline.rawHtml', function (scan, options, globals) {
  'use strict';

  // Active for every flavor (the blanket `!cmSpec` bail is gone) so inline raw-HTML
  // recognition works under the Showdown flavors too.
  let str = scan.str,
      i = scan.pos;

  // A comment is the one production the terminator guard cannot cover, so it gets the scanner;
  // nothing else in the grammar can match at a `<!--` prefix, hence the unconditional return.
  if (str.charAt(i + 2) === '-' && str.slice(i, i + 4) === '<!--') {
    let failed = scan.memos.commentFail || (scan.memos.commentFail = new Uint8Array(str.length));
    let len = scanHTMLComment(str, i, failed);
    if (len === -1) { return null; }
    scan.appendRaw(showdown.helper._hashHTMLSpan(str.substr(i, len), globals));
    return i + len;
  }
  if (cannotClose(scan, str, i)) { return null; }

  // `reRawHtml` is shared and sticky, so `lastIndex` is stale after the early returns above —
  // harmless only because it is assigned here before every use.
  reRawHtml.lastIndex = i;
  let m = reRawHtml.exec(str);
  if (m === null) { return null; }
  scan.appendRaw(showdown.helper._hashHTMLSpan(m[0], globals));
  return i + m[0].length;
});
