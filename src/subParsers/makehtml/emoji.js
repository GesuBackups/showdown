/**
 * @file      makehtml/emoji.js
 * @summary   Replaces `:code:` emoji shortcodes with their emoji glyphs (or images), gated by the `emoji` option.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Matches `:shortcode:` and looks it up in `showdown.helper.emojis`, leaving unknown codes
 * untouched. See https://github.com/showdownjs/showdown/wiki/Emojis for the supported set. Emits the
 * `makehtml.emoji.*` capture/hash events.
 *
 * Scan-native: emoji is recognized directly by the single-pass inline scan in spanGamut.js — there is
 * no whole-text pass form any more, and the onStart/onEnd lifecycle is retired per the event-contract
 * amendment (the inline-pass lifecycle belongs to spanGamut, which owns `makehtml.spanGamut.onStart/
 * onEnd`). The construct emits only capture/hash per substituted shortcode. Because the scan resolves
 * `:name:` before link/image bracket resolution and before emphasis/strikethrough pairing, the
 * substitution now applies inside resolving link/image labels for every flavor (the former cmSpec
 * literal-label behavior was a pipeline artifact of running after link hashing, not a rule).
 */


// Recognize a known `:name:` emoji shortcode at `i` (called only when options.emoji). Matches
// the retired makehtml.emoji pass's `:(\S+?):` semantics (shortest run of non-whitespace between two
// colons) and only fires for a code registered in showdown.helper.emojis, so non-emoji `:...:`
// is left to normal parsing. Returns {text, name, end} or null.
function consumeEmoji (str, i) {
  let close = str.indexOf(':', i + 1);
  if (close <= i + 1) { return null; }
  let name = str.slice(i + 1, close);
  if (/\s/.test(name)) { return null; }
  if (!Object.prototype.hasOwnProperty.call(showdown.helper.emojis, name)) { return null; }
  return {text: str.slice(i, close + 1), name: name, end: close + 1};
}

// The index one past the `:…:` span the whole-text pass's `/:(\S+?):/g` regex would match starting
// at the colon `i` (i.e. its lastIndex after that match), or -1 if the regex would find no match
// there. `\S+?` needs at least one non-whitespace char, so a colon immediately after `i` is part of
// the NAME rather than a closer (this is why `::smile:` matches as one invalid `:…:` with code
// `:smile`, shadowing the inner `:smile:`); a whitespace before any closing colon makes the regex
// fail at `i`. Used only by the scan-native substitution below, to reproduce the regex's shadowing.
function emojiRegexClose (str, i) {
  let n = str.length;
  for (let k = i + 1; k < n; k++) {
    let c = str.charAt(k);
    if (/\s/.test(c)) { return -1; }         // `\S+?` cannot cross whitespace
    if (c === ':' && k >= i + 2) { return k + 1; } // name is str[i+1..k-1] (length >= 1)
  }
  return -1;
}

// The scan-native substitution flow: mirror the (retired) whole-text pass's per-match handling.
// matches.text is the emoji CODE; a listener's output takes precedence, otherwise the code is looked
// up in showdown.helper.emojis (honoring a listener that rewrote matches.text). regexp is null: this
// is a scan-native construct, with no whole-text regex driving it (as with ellipsis/strikethrough).
function substituteEmoji (scan, options, globals, e) {
  let otp;
  let captureStartEvent = showdown.Event.dispatchCapture('makehtml.emoji.onCapture', e.name, {
    regexp: null,
    matches: {
      _wholeMatch: e.text,
      text: e.name
    },
    attributes: {}
  }, options, globals);
  if (captureStartEvent.output && captureStartEvent.output !== '') {
    otp = captureStartEvent.output;
  } else {
    otp = showdown.helper.emojis[captureStartEvent.matches.text];
  }

  let beforeHashEvent = showdown.Event.dispatchHash('makehtml.emoji.onHash', otp, options, globals);
  otp = beforeHashEvent.output;

  // Image-based emoji (e.g. :octocat:) render as an <img> tag. Hash it so the later
  // encodeAmpsAndAngles pass doesn't turn its `<`/`>` into entities — the same protection the
  // retired whole-text pass applied via _hashHTMLSpan. Unicode emoji contain no HTML-special
  // chars, so appending them raw is byte-identical to appending them as escaped text.
  if (/^\s*</.test(otp)) {
    scan.appendRaw(scan.hashSpan(otp));
  } else {
    scan.appendRaw(otp);
  }
  return e.end;
}

// The `:` scan handler for the unified inline scanner in spanGamut.js (scan-state convention — see
// entity.js). It performs the emoji SUBSTITUTION inline: on a known `:name:` it appends the glyph (or
// hash-protected image) and returns the new cursor; otherwise it declines (returns null) and the
// engine falls through to its plain-text run, so `_`/`*` inside an emoji name never reach the
// emphasis stack while a non-emoji `:...:` still parses normally.
//
// It reproduces the retired whole-text pass's global-regex left-to-right SHADOWING so output stays
// byte-identical. That pass used a single global `/:(\S+?):/g`; once it consumed a `:…:` span (valid
// OR invalid) its lastIndex skipped past it, so a valid emoji NESTED inside an already-consumed span
// was never re-matched (e.g. `::smile::` -> the regex matches the invalid `::smile:` and leaves the
// inner `:smile:` literal). scan._emojiShadowEnd is a raw-index high-water mark of that lastIndex
// (colons are never added/removed/reordered by the surrounding inline processing, so raw indices
// track the serialized-text shadowing faithfully).
showdown.subParser('makehtml.inline.emoji', function (scan, options, globals) {
  'use strict';

  let e = consumeEmoji(scan.str, scan.pos);

  let i = scan.pos,
      shadowEnd = scan._emojiShadowEnd || 0;

  // an unshadowed known emoji: substitute and advance the shadow boundary past it
  if (e && i >= shadowEnd) {
    scan._emojiShadowEnd = e.end;
    return substituteEmoji(scan, options, globals, e);
  }

  // No unshadowed emoji here. If this `:` opens a `:…:` span the regex would have consumed (valid
  // shadowed, or an invalid code), advance the shadow boundary so a valid emoji nested inside it is
  // not re-substituted. Then decline: the scanner's plain-text run / emphasis processes the `:` and
  // its interior, so e.g. the `_` in an invalid `:not_a_code:` still becomes emphasis — exactly as the
  // pass allowed, since it ran AFTER emphasis on the serialized text.
  if (i >= shadowEnd) {
    let close = emojiRegexClose(scan.str, i);
    if (close !== -1) { scan._emojiShadowEnd = close; }
  }
  return null;
});
