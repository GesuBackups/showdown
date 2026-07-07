/**
 * @file      makehtml/ellipsis.js
 * @summary   Replaces literal `...` with the ellipsis character `…` when the `ellipsis` option is on.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A simple gated per-match transform. Emits the `makehtml.ellipsis.*` event family.
 */


showdown.subParser('makehtml.ellipsis', function (text, options, globals) {
  'use strict';

  if (!options.ellipsis) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.ellipsis.onStart', text, options, globals);
  text = startEvent.output;

  const ellipsisRegex = /\.\.\./g;
  text = text.replace(ellipsisRegex, function (wholeMatch) {

    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.ellipsis.onCapture', wholeMatch, {
      regexp: ellipsisRegex,
      matches: {
        _wholeMatch: wholeMatch,
        text: wholeMatch
      },
      attributes: {}
    }, options, globals);
    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      // honor a listener that rewrote matches.text: the ellipsis substitution is applied
      // to the (possibly edited) captured text, so the default `...` still yields `…`.
      otp = captureStartEvent.matches.text.replace(/\.\.\./g, '…');
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.ellipsis.onHash', otp, options, globals);
    return beforeHashEvent.output;
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.ellipsis.onEnd', text, options, globals);
  return afterEvent.output;
});
