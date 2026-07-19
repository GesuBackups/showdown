/**
 * @file      makehtml/emoji.js
 * @summary   Replaces `:code:` emoji shortcodes with their emoji glyphs (or images), gated by the `emoji` option.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Matches `:shortcode:` and looks it up in `showdown.helper.emojis`, leaving unknown codes
 * untouched. See https://github.com/showdownjs/showdown/wiki/Emojis for the supported set. Emits the
 * `makehtml.emoji.*` event family.
 *
 * This file owns both forms of the construct: the whole-text `makehtml.emoji` pass (which substitutes
 * the glyph) and the `makehtml.inline.emoji` scan handler below, which consumes a known `:name:` as one
 * atomic text node during the single-pass inline scan in spanGamut.js (see entity.js for the
 * scan-convention explanation).
 */


showdown.subParser('makehtml.emoji', function (text, options, globals) {
  'use strict';

  if (!options.emoji) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.emoji.onStart', text, options, globals);
  text = startEvent.output;

  let pattern = /:(\S+?):/g;

  text = text.replace(pattern, function (wholeMatch, emojiCode) {
    if (!Object.prototype.hasOwnProperty.call(showdown.helper.emojis, emojiCode)) {
      return wholeMatch;
    }
    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.emoji.onCapture', emojiCode, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        text: emojiCode
      },
      attributes: {}
    }, options, globals);

    // if something was passed as output, it takes precedence and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      // honor a listener that rewrote the emoji code via matches.text
      otp = showdown.helper.emojis[captureStartEvent.matches.text];
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.emoji.onHash', otp, options, globals);
    otp = beforeHashEvent.output;

    // Image-based emoji (e.g. :octocat:) render as an <img> tag. Hash it so later
    // HTML-escaping passes don't turn its `<`/`>` into entities - under cmSpec the
    // generic span hashing skips void tags (it is meant to escape malformed raw HTML),
    // so the generated markup must protect itself here. Unicode emoji are returned as-is.
    if (/^\s*</.test(otp)) {
      otp = showdown.helper._hashHTMLSpan(otp, globals);
    }
    return otp;
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.emoji.onEnd', text, options, globals);
  return afterEvent.output;
});

// Recognize a known `:name:` emoji shortcode at `i` (called only when options.emoji). Matches
// the makehtml.emoji pass's `:(\S+?):` semantics (shortest run of non-whitespace between two
// colons) and only fires for a code registered in showdown.helper.emojis, so non-emoji `:...:`
// is left to normal parsing. Returns {text, end} or null.
function consumeEmoji (str, i) {
  let close = str.indexOf(':', i + 1);
  if (close <= i + 1) { return null; }
  let name = str.slice(i + 1, close);
  if (/\s/.test(name)) { return null; }
  if (!Object.prototype.hasOwnProperty.call(showdown.helper.emojis, name)) { return null; }
  return {text: str.slice(i, close + 1), end: close + 1};
}

// The `:` scan handler for the unified inline scanner in spanGamut.js. Consumes a known `:name:` as
// one atomic text node (so `_`/`*` inside an emoji name never become emphasis delimiters), or declines
// (returns null) — on decline the engine falls through to its plain-text run.
// eslint-disable-next-line no-unused-vars -- `options`/`globals` are unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.emoji', function (scan, options, globals) {
  'use strict';

  let e = consumeEmoji(scan.str, scan.pos);
  if (e) { scan.appendText(e.text); return e.end; }
  return null;
});
