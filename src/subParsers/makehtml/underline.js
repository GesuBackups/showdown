/**
 * @file      makehtml/underline.js
 * @summary   Converts `__`/`___` runs into `<u>` when the `underline` option is enabled.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Scan-native: underline is recognized directly by the single-pass inline scan in spanGamut.js —
 * there is no whole-text pass form any more, and the onStart/onEnd lifecycle is retired per the
 * event-contract amendment (the inline-pass lifecycle belongs to spanGamut, which owns
 * `makehtml.spanGamut.onStart/onEnd`). The construct emits only capture/hash per claimed `__`/`___`
 * region (`makehtml.underline.onCapture` / `.onHash`) and honors `literalMidWordUnderscores`.
 *
 * Moving off the whole-text pass sharpens two behaviors, both intended:
 *   - a boundary-crossing construct (a code span, autolink, raw-HTML tag, `*`-emphasis or an
 *     underscore run that opens inside `__..__` and closes outside) now yields well-formed output —
 *     the pass used to inject a bare `</u>` that a later construct could swallow, producing crossed
 *     or nested markup;
 *   - underscores inside a protected construct are no longer escaped. The old pass rewrote every `_`
 *     in the document before the scan, corrupting `_`-bearing emoji shortcodes, naked URLs, @mentions
 *     and code-span backslashes; the scan resolves those constructs before the `_` handler runs, so
 *     they survive intact.
 */

// ---- scan-native underline ---------------------------------------------------------------------
//
// The retired whole-text pass resolved underline as two SEQUENTIAL regex sweeps over the whole text:
// first the triple-underscore pattern, then the double-underscore pattern (each honoring
// `literalMidWordUnderscores`). Reproducing that faithfully from a single left-to-right cursor is
// subtle, because the second sweep re-examines regions the first sweep MATCHED-BUT-REJECTED (content
// not ending in `\S`) while NOT re-examining inside regions the first sweep CLAIMED. A naive
// per-cursor "try the sticky regex; on non-claim skip the run" would diverge (e.g. `__a __b__ c__`,
// where the double sweep's `lastIndex` skips past a rejected `__a __` so the inner `__b__` is never
// claimed). So the claim SET for a given string is computed once (cached on `scan.memos`) by
// replaying the two sweeps exactly, and the handler just looks up whether a claim opens at the
// cursor. Inner content is scanned by a nested `scan.subParse`, which re-runs this same machinery on
// the slice — so a `__x__` nested inside a claimed `___..___` is re-discovered there, matching the
// second sweep's ability to claim inside the first sweep's `<u>...</u>` content.

// Blank a claimed span with same-length filler that contains no `_` and whose edges are non-word
// (mirroring the opaque `<u>...</u>` the sequential pass left in place, whose `<`/`>` edges are
// non-word so an adjacent `\b`/flanking test in the second sweep decides identically). Used only for
// claim computation, never rendered.
function underlineBlank (n) {
  return new Array(n + 1).join('.');
}

// One regex sweep of the whole (masked/working) string, mirroring the pass's `String.replace(rgx, …)`:
// on a CLAIM record {start, innerStart, innerEnd, end} (indices into the ORIGINAL string, which the
// masked string is length-identical to) and blank the span so the next sweep can't re-match inside;
// on a normal-mode REJECT (`/\S$/` fails) leave the span intact for the next sweep, exactly as the
// pass's callback returned the whole match unchanged. `markerLen` is 3 (triple) or 2 (double).
function underlineRunPass (work, rgx, markerLen, literal, claims) {
  return work.replace(rgx, function (wm, inner, offset) {
    if (!literal && !(/\S$/.test(inner))) {
      return wm;
    }
    claims.push({
      start: offset,
      innerStart: offset + markerLen,
      innerEnd: offset + wm.length - markerLen,
      end: offset + wm.length
    });
    return underlineBlank(wm.length);
  });
}

// Compute the full ordered claim set for `masked` (the string with escaped `\_` already neutralized),
// replaying the triple sweep then the double sweep. The `\b` literal-mode prechecks live in the
// regexes themselves.
function computeUnderlineClaims (masked, literal) {
  let claims = [],
      p1 = literal ? /\b___(\S[\s\S]*?)___\b/g : /___(\S[\s\S]*?)___/g,
      p2 = literal ? /\b__(\S[\s\S]*?)__\b/g : /__(\S[\s\S]*?)__/g,
      work = underlineRunPass(masked, p1, 3, literal, claims);
  underlineRunPass(work, p2, 2, literal, claims);
  return claims;
}

// The claim (if any) that OPENS at the scan cursor, keyed on `scan.memos` so the sweeps run once per
// (sub)scan. The masked string swaps each escaped underscore `\_` for the length-preserving,
// edge-equivalent filler `¨E` so it can neither open nor close a claim and cursor indices still map
// 1:1 into the original string (the real `\_` is resolved by the scan's backslash handler at render).
function underlineClaimAt (scan, options) {
  let memos = scan.memos;
  if (!memos.underlineClaims) {
    let masked = scan.str.replace(/\\_/g, '¨E'),
        claims = computeUnderlineClaims(masked, !!options.literalMidWordUnderscores),
        byStart = {};
    for (let k = 0; k < claims.length; ++k) { byStart[claims[k].start] = claims[k]; }
    memos.underlineClaims = byStart;
  }
  return Object.prototype.hasOwnProperty.call(memos.underlineClaims, scan.pos) ?
    memos.underlineClaims[scan.pos] :
    null;
}

// The `_` scan handler for the unified inline scanner in spanGamut.js (scan-state convention — see
// entity.js). It never declines: on a claim it appends the hashed `<u>` span (inner rendered by a
// nested sub-scan) and returns the cursor past the claim; otherwise it consumes the whole `_` run as
// inert literal text (so an unmatched or single `_` is never handed to emphasis, reproducing the
// pass's rule 3). Fires the `makehtml.underline.*` capture/hash events with the RAW inner slice as
// `matches.text`, honoring a listener's output / rewritten text / attributes.
showdown.subParser('makehtml.inline.underline', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos,
      claim = underlineClaimAt(scan, options);

  if (!claim) {
    let j = i;
    while (j < str.length && str.charAt(j) === '_') { ++j; }
    scan.appendText(str.slice(i, j));
    return j;
  }

  let rawInner = str.slice(claim.innerStart, claim.innerEnd),
      otp;
  let captureStartEvent = showdown.Event.dispatchCapture('makehtml.underline.onCapture', rawInner, {
    regexp: null,
    matches: {
      _wholeMatch: str.slice(claim.start, claim.end),
      text: rawInner
    },
    attributes: {}
  }, options, globals);
  // a listener-supplied output takes precedence and is used verbatim; otherwise build the `<u>`
  // with the inner content rendered by a nested sub-scan (then hard-line-broken, matching the pass).
  if (captureStartEvent.output && captureStartEvent.output !== '') {
    otp = captureStartEvent.output;
  } else {
    otp = '<u' + showdown.helper._populateAttributes(captureStartEvent.attributes) + '>' +
      showdown.subParser('makehtml.hardLineBreaks')(scan.subParse(captureStartEvent.matches.text), options, globals) +
      '</u>';
  }

  let beforeHashEvent = showdown.Event.dispatchHash('makehtml.underline.onHash', otp, options, globals);
  scan.appendRaw(scan.hashSpan(beforeHashEvent.output));
  return claim.end;
});
