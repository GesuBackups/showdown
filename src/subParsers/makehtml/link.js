/**
 * @file      makehtml/link.js
 * @summary   Markdown links (`[..](..)` + reference forms) in the unified inline scan (CommonMark spec §6.3–6.5).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * This file owns the shared bracket machinery: the `]` close-bracket resolution and the `<a>`
 * builder. The bracket PUSHES (`[`, `![`) stay in the inline engine (spanGamut.js) — it records each
 * open bracket on the scan.brackets stack; this file resolves the matching `]`. A `![` opener builds
 * an image instead (image.js owns what an image renders as), invoked from here at close-bracket
 * time.
 *
 * This is a `makehtml.inline.*` construct subparser (scan-state convention — (scan, options,
 * globals) instead of (text, options, globals); see entity.js for the scan convention). The scanner
 * sets scan.pos to the `]` and dispatches `makehtml.inline.link`; it ALWAYS returns a cursor index
 * (mirroring the resolution's every-path return), so the scanner never stalls on a `]`. The scan
 * state carries everything the resolution needs: the string (scan.str), the entry index (scan.pos),
 * the bracket stack head (scan.brackets, read AND written), emphasis resolution
 * (scan.processEmphasis), node rendering (scan.renderNodes), node-list surgery (scan.list.removeFrom
 * / scan.appendRaw / scan.list.pruneDelimiters) and the shared link services (scan.normalizeDest,
 * scan.buildTitleAttr, scan.hashSpan).
 */

/* jshint esnext: false, esversion: 9 */

// Sticky regex anchored at the scan cursor (lastIndex) so it never slices the tail of the
// string - keeps the tokenizer linear on `<`-heavy input. Reused across calls; it sets
// lastIndex before exec and the parse is not re-entrant within a single string.
// Showdown flavors only (see the `!cmSpec` gate at its call site in the resolution below): a
// `data:...;base64,` inline-image destination may be split across newlines. Legacy image.js
// matched base64 image URLs with a char class that allowed `\n` and then stripped all whitespace
// out of the URL, so a payload wrapped across lines still resolves to one `src`.
// cmScanDestination stops at the first newline (CommonMark forbids newlines in destinations), so
// the Showdown flavors scan the base64 body with this recognizer instead and strip the embedded
// whitespace. Sticky + anchored at the scan cursor; a single greedy class is linear / ReDoS-safe.
const reInlineBase64Dest = /<?(data:[^\s<>]+?\/[^\s<>]+?;base64,[A-Za-z\d+/=\n]+)>?/y;

showdown.subParser('makehtml.inline.link', function (scan, options, globals) {
  'use strict';

  let s = scan.str,
      idx = scan.pos;

  let opener = scan.brackets;
  if (opener === null) { scan.appendText(']'); return idx + 1; }
  if (!opener.active) { scan.brackets = opener.prev; scan.appendText(']'); return idx + 1; }

  // try to parse the destination/title or a reference that follows the `]`
  // variant mirrors link.js/image.js: `inline` for `[..](..)`, `reference` for the
  // reference-style forms (full/collapsed/shortcut) - drives the capture event name.
  let dest = null, title = null, width = null, height = null, matched = false, endIdx = idx + 1,
      variant = 'inline';

  if (s.charAt(idx + 1) === '(') {
    let j = idx + 2, n2 = s.length, isWs = function (c) { return c === ' ' || c === '\t' || c === '\n'; };
    while (j < n2 && isWs(s.charAt(j))) { j++; }
    let d = null;
    // Showdown flavors (legacy image.js base64 parity): a `data:...;base64,` destination may
    // be split across newlines. cmScanDestination stops at the first newline, so scan the
    // base64 body here (newlines tolerated) and strip the embedded whitespace, the way legacy's
    // base64 image regex did. cmSpec keeps CommonMark's strict scan (no newlines in a URL).
    if (!options.cmSpec) {
      reInlineBase64Dest.lastIndex = j;
      let b64 = reInlineBase64Dest.exec(s);
      if (b64) { d = {url: b64[1].replace(/\s/g, ''), end: j + b64[0].length}; }
    }
    if (!d) { d = showdown.helper.cmScanDestination(s, j); }
    if (d) {
      j = d.end;
      // parseImgDimensions (Showdown extension, not CommonMark): an optional
      // ` =WxH` between destination and title. The `=WxH` is always consumed here so
      // it never leaks into the output; buildImage only renders it when the option is
      // on. Regex fragment copied from the inline image regex in image.js.
      let dimStart = j;
      while (dimStart < n2 && isWs(s.charAt(dimStart))) { dimStart++; }
      if (dimStart > j && s.charAt(dimStart) === '=') {
        let dim = /^=([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4})/.exec(s.slice(dimStart));
        if (dim) {
          width = dim[1];
          height = dim[2];
          j = dimStart + dim[0].length;
        }
      }
      let hadWs = false;
      while (j < n2 && isWs(s.charAt(j))) { hadWs = true; j++; }
      let tc = s.charAt(j), t = null;
      if (hadWs && (tc === '"' || tc === '\'' || tc === '(')) {
        t = showdown.helper.cmScanTitle(s, j);
        if (t) { j = t.end; }
      }
      while (j < n2 && isWs(s.charAt(j))) { j++; }
      if (s.charAt(j) === ')') {
        dest = d.url;
        title = t ? t.title : null;
        matched = true;
        endIdx = j + 1;
      }
    }
  }

  if (!matched) {
    // reference: full [label], collapsed [] or shortcut. Use the RAW source label
    // (backslash escapes intact) - CommonMark matches labels by case-fold +
    // whitespace only, so `[foo\!]` must not match a `[foo!]` definition.
    variant = 'reference';
    let labelText = s.slice(opener.sourceStart, idx),
        refKey = null,
        bracketPos = idx + 1;
    // Gate B (reference-with-space). The Showdown flavors honor Original-Markdown's
    // space-tolerant references — `[an example] [id]` — allowing optional whitespace (a
    // space/tab run and at most one newline) between the `]` that closes the link text and
    // the `[` that opens the label. cmSpec keeps CommonMark's strict no-space rule (a space
    // there makes the first `[..]` a shortcut reference). Only the position of the `[` moves;
    // the whitespace itself is not part of the label.
    if (!options.cmSpec) {
      let k = idx + 1, sawNewline = false;
      while (k < s.length) {
        let c = s.charAt(k);
        if (c === ' ' || c === '\t') {
          k++;
        } else if (c === '\n' && !sawNewline) {
          sawNewline = true;
          k++;
        } else {
          break;
        }
      }
      if (s.charAt(k) === '[') { bracketPos = k; }
    }
    if (s.charAt(bracketPos) === '[') {
      let close = findRefClose(s, bracketPos + 1);
      if (close !== -1) {
        let inner = s.slice(bracketPos + 1, close);
        refKey = inner.trim() === '' ? labelText : inner;
        endIdx = close + 1;
      }
    } else {
      refKey = labelText; // shortcut
      endIdx = idx + 1;
    }
    if (refKey !== null) {
      let key = showdown.helper.cmNormalizeLabel(refKey);
      if (key !== '' && !showdown.helper.isUndefined(globals.gUrls[key])) {
        dest = globals.gUrls[key];
        title = globals.gTitles[key];
        // parseImgDimensions: reference-style dimensions stored by stripLinkDefinitions
        if (globals.gDimensions[key]) {
          width = globals.gDimensions[key].width;
          height = globals.gDimensions[key].height;
        }
        matched = true;
      }
    }
  }

  if (!matched) { scan.brackets = opener.prev; scan.appendText(']'); return idx + 1; }

  // process emphasis on the delimiters inside the brackets
  scan.processEmphasis(opener.prevDelim);

  // collect and render the inner nodes
  let innerHTML = scan.renderNodes(opener.node.next, null),
      wholeMatch = s.slice(opener.matchStart, endIdx);

  let otpHTML;
  if (opener.image) {
    otpHTML = showdown.subParser('makehtml.inline.image.build')(scan, options, globals, innerHTML, dest, title, width, height, variant, wholeMatch, s.slice(opener.sourceStart, idx));
  } else {
    otpHTML = buildLink(innerHTML, dest, title, variant, wholeMatch);
  }

  // drop the opener node and everything after it, append the built span
  scan.list.removeFrom(opener.node);
  scan.appendRaw(otpHTML);
  // remove any emphasis delimiters that belonged to the consumed range
  scan.list.pruneDelimiters(opener.prevDelim);

  if (!opener.image) {
    // a link cannot be nested in another link
    for (let b = opener.prev; b !== null; b = b.prev) {
      if (!b.image) { b.active = false; }
    }
  }
  scan.brackets = opener.prev;
  return endIdx;

  // Real CommonMark links (`[..](..)` + reference forms). This dispatches the same
  // event family the retired standalone link.js did — `makehtml.link.<variant>.*` (variant
  // `inline`/`reference`) — so listener extensions work identically across flavors. The
  // rendered output for listener-free conversions is unchanged: the attribute strings are
  // rebuilt from the same values via _populateAttributes.
  function buildLink (innerHTML, dest, title, variant, wholeMatch) {
    // safeMode: neutralize dangerous URL schemes (javascript:, vbscript:, data:, ...)
    let href = (options.safeMode && !showdown.helper.isSafeUrl(dest)) ? '' : scan.normalizeDest(dest);
    // The link span is hashed below, so the Showdown-only extras that run after the inline scan
    // in spanGamut (emoji, strikethrough, ellipsis) never see the link text. Apply them here so
    // e.g. `[:apple:](url)` renders the emoji in the anchor text (mirrors buildEmphasis). The
    // GFM link passes (applyGfmInlineLinks) are deliberately NOT run on link text — a link
    // cannot be nested inside another link. Gated off cmSpec so its output stays byte-identical
    // (under cmSpec these extras have always run only on the non-hashed text around spans).
    if (!options.cmSpec) {
      innerHTML = showdown.subParser('makehtml.emoji')(innerHTML, options, globals);
      innerHTML = showdown.subParser('makehtml.strikethrough')(innerHTML, options, globals);
      innerHTML = showdown.subParser('makehtml.ellipsis')(innerHTML, options, globals);
    }
    innerHTML = showdown.subParser('makehtml.hardLineBreaks')(innerHTML, options, globals);
    let attributes = {href: href};
    scan.buildTitleAttr(attributes, title);

    let capture = showdown.Event.dispatchCapture('makehtml.link.' + variant + '.onCapture', wholeMatch, {
      regexp: null,
      matches: {_wholeMatch: wholeMatch, _url: dest, _title: title, text: innerHTML},
      attributes: attributes
    }, options, globals);

    let otp;
    if (capture.output && capture.output !== '') {
      otp = capture.output;
    } else {
      attributes = capture.attributes;
      otp = '<a' + showdown.helper._populateAttributes(attributes) + '>' + capture.matches.text + '</a>';
    }
    let hash = showdown.Event.dispatchHash('makehtml.link.' + variant + '.onHash', otp, options, globals);
    return scan.hashSpan(hash.output);
  }
});

// find the closing `]` of a reference label, honoring backslash escapes
function findRefClose (str, j) {
  let n = str.length;
  while (j < n) {
    let c = str.charAt(j);
    if (c === '\\' && j + 1 < n) { j += 2; continue; }
    if (c === ']') { return j; }
    if (c === '[') { return -1; }
    j++;
  }
  return -1;
}
