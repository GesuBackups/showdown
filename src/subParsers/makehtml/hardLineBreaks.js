////
// makehtml/hardLineBreaks.js
// Copyright (c) 2022 ShowdownJS
//
// Transforms hard line breaks (trailing spaces / backslash) into `<br />` tags.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

showdown.subParser('makehtml.hardLineBreaks', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.hardLineBreaks.onStart', text, options, globals);
  text = startEvent.output;

  // Do hard breaks
  if (options.simpleLineBreaks) {
    // GFM style hard breaks
    // only add line breaks if the text does not contain a block (special case for lists)
    if (!/\n\n¨K/.test(text)) {
      text = text.replace(/\n+/gm, function (wholeMatch) { return parseBreak(/\n+/gm, wholeMatch); });
    }
  } else {
    // Vanilla hard breaks
    text = text.replace(/  +\n/g, function (wholeMatch) { return parseBreak(/  +\n/g, wholeMatch); });
  }
  text = text.replace(/\\\n/g, function (wholeMatch) { return parseBreak(/\\\n/g, wholeMatch); });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.hardLineBreaks.onEnd', text, options, globals);
  return afterEvent.output;

  /**
   * Render one hard break. A break has no inner content (like a horizontal rule), so `matches`
   * carries only the read-only `_wholeMatch` context - no `text` key. `attributes` are applied
   * to the emitted `<br>`, so a listener can tag/style individual breaks; a listener may also
   * override `output` entirely. The trailing newline that separated the source lines is kept.
   * @param {RegExp} pattern
   * @param {string} wholeMatch
   * @returns {string}
   */
  function parseBreak (pattern, wholeMatch) {
    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.hardLineBreaks.onCapture', wholeMatch, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch
      },
      attributes: {}
    }, options, globals);

    // if something was passed as output, it takes precedence and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      otp = '<br' + showdown.helper._populateAttributes(captureStartEvent.attributes) + ' />';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.hardLineBreaks.onHash', otp, options, globals);
    return beforeHashEvent.output + '\n';
  }

});
