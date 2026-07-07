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
