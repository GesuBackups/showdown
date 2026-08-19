/**
 * @file      makehtml/codeSpan.js
 * @summary   Converts backtick-delimited inline code into `<code>` spans.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes backtick code spans, including multi-backtick delimiters and edge-space trimming, and
 * encodes the interior with `encodeCode` so its characters lose Markdown meaning. Emits the
 * `makehtml.codeSpan.*` event family.
 *
 * This file owns both forms of the construct: the whole-text `makehtml.codeSpan` pass (still used by
 * table.js) and the `makehtml.inline.codeSpan` scan handler below (called from the single-pass inline
 * scanner in spanGamut.js; see entity.js for the scan-convention explanation).
 */


showdown.subParser('makehtml.codeSpan', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.codeSpan.onStart', text, options, globals);

  text = startEvent.output;

  if (showdown.helper.isUndefined((text))) {
    text = '';
  }

  // Cursor scan over the same `parseBacktick` the inline engine uses, rather than a whole-text
  // regex: the old pattern (`(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)`) backtracked quadratically on a
  // long unbroken backtick run, which table cells feed it straight from the document (~8s for
  // 4k backticks in one cell). Routing both forms through one matcher also makes a table cell
  // and a paragraph render a code span identically.
  let out = [],
      last = 0,
      i = 0,
      n = text.length,
      // per-invocation: table.js may run this pass twice over the same lines
      noCloser = {};

  while (i < n) {
    let ch = text.charAt(i);
    if (ch === '\\') {
      // an escaped character cannot open a span (what the pattern's `[^\\]` lead-in guarded)
      i += 2;
      continue;
    }
    if (ch !== '`') {
      i++;
      continue;
    }
    let res = parseBacktick(text, i, noCloser, options, globals);
    if (res) {
      out.push(text.slice(last, i), res.html);
      last = res.end;
      i = res.end;
    } else {
      // no closer for this run length: emit it literally and keep scanning
      i = skipRun(text, i, '`');
    }
  }
  out.push(text.slice(last));
  text = out.join('');

  let afterEvent = showdown.Event.dispatchEnd('makehtml.codeSpan.onEnd', text, options, globals);
  return afterEvent.output;
});

// advance past a run of identical `ch` characters starting at `i`, returning the run end index
function skipRun (str, i, ch) {
  let j = i;
  while (j < str.length && str.charAt(j) === ch) { j++; }
  return j;
}

function parseBacktick (str, i, noCloser, options, globals) {
  let openEnd = skipRun(str, i, '`'),
      runLen = openEnd - i,
      n = str.length,
      j = openEnd;
  if (noCloser[runLen]) { return null; }
  // find a closing run of backticks of exactly runLen (not part of a longer run)
  while (j < n) {
    if (str.charAt(j) === '`') {
      let runStart = j,
          runEnd = skipRun(str, j, '`');
      if (runEnd - runStart === runLen) {
        let raw = str.slice(openEnd, runStart), content;
        // Gate 3 (code spans). cmSpec: collapse newlines to spaces, then strip exactly one
        // leading+trailing space (only when the content is not all spaces). Showdown flavors:
        // strip all leading/trailing spaces & tabs first (on the raw content, before collapsing
        // newlines), then collapse newlines — mirroring legacy codeSpan.js. Both encode the
        // interior with encodeCode (which already encodes `"` -> `&quot;` for every flavor).
        if (options.cmSpec) {
          content = raw.replace(/\n/g, ' ');
          if (content.length >= 2 && content.charAt(0) === ' ' && content.charAt(content.length - 1) === ' ' && /[^ ]/.test(content)) {
            content = content.slice(1, -1);
          }
        } else {
          content = raw.replace(/^[ \t]*/, '').replace(/[ \t]*$/, '').replace(/\n/g, ' ');
        }
        // Event parity (D3): mirror makehtml.codeSpan.* so listeners work identically across
        // flavors. Byte-identical for listener-free conversions.
        let wholeMatch = str.slice(i, runEnd);
        let capture = showdown.Event.dispatchCapture('makehtml.codeSpan.onCapture', content, {
          regexp: null,
          matches: {_wholeMatch: wholeMatch, text: content},
          attributes: {}
        }, options, globals);
        let otp;
        if (capture.output && capture.output !== '') {
          otp = capture.output;
        } else {
          otp = '<code>' + showdown.helper.encodeCode(capture.matches.text, options, globals) + '</code>';
        }
        let hash = showdown.Event.dispatchHash('makehtml.codeSpan.onHash', otp, options, globals);
        return {html: showdown.helper._hashHTMLSpan(hash.output, globals), end: runEnd};
      }
      j = runEnd;
    } else {
      j++;
    }
  }
  noCloser[runLen] = true; // no closer of this length anywhere after here
  return null;
}

// The backtick scan handler for the unified inline scanner in spanGamut.js. Always consumes (the
// engine's backtick dispatch is unconditional): parseBacktick builds the hashed `<code>` span, or —
// when no closer exists — the run is emitted as literal text (what the engine's old decline arm did).
// The no-closer memo lives on scan.memos so future opens of the same run length fail immediately.
showdown.subParser('makehtml.inline.codeSpan', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos;
  let noCloser = scan.memos.backtickNoCloser || (scan.memos.backtickNoCloser = {});
  let res = parseBacktick(str, i, noCloser, options, globals);
  if (res) {
    scan.appendRaw(res.html);
    return res.end;
  }
  let e = skipRun(str, i, '`');
  scan.appendText(str.slice(i, e));
  return e;
});
