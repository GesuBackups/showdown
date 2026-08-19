/**
 * @file      makehtml/ellipsis.js
 * @summary   Replaces literal `...` with the ellipsis character `…` when the `ellipsis` option is on.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A scan-native per-match transform. The construct is recognized directly by the single-pass inline
 * scan in spanGamut.js — there is no whole-text pass form. It emits capture/hash per occurrence
 * (`makehtml.ellipsis.onCapture` / `.onHash`); the onStart/onEnd lifecycle is retired per the
 * event-contract amendment (the inline-pass lifecycle belongs to spanGamut, which owns
 * `makehtml.spanGamut.onStart/onEnd`). Because the scan consumes `...` before link/image bracket
 * resolution, the substitution now applies inside resolving link/image labels for every flavor
 * (the former cmSpec literal-label behavior was a pipeline artifact of running after link hashing,
 * not a rule).
 */

// The scan handler for the unified inline scanner in spanGamut.js. Recognizes a literal `...` at the
// scan cursor (capture/hash per occurrence; no onStart/onEnd — the inline-pass lifecycle belongs to
// spanGamut). On a match it appends the substituted output RAW so a listener that produced markup
// flows to the later passes; the default `…` contains no HTML-special chars, so raw vs escaped is
// byte-identical. Declines (returns null) on a lone `.` or `..`, letting the scanner's plain-text run
// take it.
showdown.subParser('makehtml.inline.ellipsis', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos;
  if (str.charAt(i) !== '.' || str.charAt(i + 1) !== '.' || str.charAt(i + 2) !== '.') {
    return null;
  }

  const wholeMatch = '...';
  let otp;
  let captureStartEvent = showdown.Event.dispatchCapture('makehtml.ellipsis.onCapture', wholeMatch, {
    regexp: null,
    matches: {
      _wholeMatch: wholeMatch,
      text: wholeMatch
    },
    attributes: {}
  }, options, globals);
  // if something was passed as output, it takes precedence and will be used as output
  if (captureStartEvent.output && captureStartEvent.output !== '') {
    otp = captureStartEvent.output;
  } else {
    // honor a listener that rewrote matches.text: the ellipsis substitution is applied
    // to the (possibly edited) captured text, so the default `...` still yields `…`.
    otp = captureStartEvent.matches.text.replace(/\.\.\./g, '…');
  }

  let beforeHashEvent = showdown.Event.dispatchHash('makehtml.ellipsis.onHash', otp, options, globals);
  scan.appendRaw(beforeHashEvent.output);
  return i + 3;
});
