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
  reRawHtml.lastIndex = i;
  let m = reRawHtml.exec(str);
  if (m === null) { return null; }
  scan.appendRaw(showdown.helper._hashHTMLSpan(m[0], globals));
  return i + m[0].length;
});
