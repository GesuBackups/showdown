/**
 * @file      makehtml/codeSpan.js
 * @summary   Converts backtick-delimited inline code into `<code>` spans.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes backtick code spans, including multi-backtick delimiters and edge-space trimming, and
 * encodes the interior with `encodeCode` so its characters lose Markdown meaning. Not used in cmSpec
 * mode, where `cmInline` handles code spans. Emits the `makehtml.codeSpan.*` event family.
 */


showdown.subParser('makehtml.codeSpan', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.codeSpan.onStart', text, options, globals);

  text = startEvent.output;

  if (showdown.helper.isUndefined((text))) {
    text = '';
  }

  let pattern = /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm;

  text = text.replace(pattern, function (wholeMatch, m1, m2, c) {
    let otp,
        attributes = {};

    c = c.replace(/^([ \t]*)/g, '');	// leading whitespace
    c = c.replace(/[ \t]*$/g, '');	// trailing whitespace
    // remove newlines
    c = c.replace(/\n/g, ' ');

    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.codeSpan.onCapture', c, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        text: c
      },
      attributes: {}
    }, options, globals);

    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = m1 + captureStartEvent.output;
    } else {
      c = captureStartEvent.matches.text;
      c = showdown.helper.encodeCode(c, options, globals);
      otp = m1 + '<code' + showdown.helper._populateAttributes(attributes) + '>' +  c + '</code>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.codeSpan.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    return showdown.helper.hashHTMLSpans(otp, options, globals);
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.codeSpan.onEnd', text, options, globals);
  return afterEvent.output;
});
