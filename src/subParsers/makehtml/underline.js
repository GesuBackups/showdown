/**
 * @file      makehtml/underline.js
 * @summary   Converts `__`/`___` runs into `<u>` when the `underline` option is enabled.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Runs before the unified inline scan (as the first pipeline step in spanGamut.js) so it claims the
 * underscores first and escapes the remaining `_`; honors `literalMidWordUnderscores`. Emits the
 * `makehtml.underline.*` event family.
 */

showdown.subParser('makehtml.underline', function (text, options, globals) {
  'use strict';

  if (!options.underline) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.underline.onStart', text, options, globals);
  text = startEvent.output;

  // Resolve an escaped underscore (`\_`) to its escape placeholder, consuming the
  // backslash, so it is neither underlined nor left with a stray `\`. Needed because under
  // cmSpec underline runs before backslash escapes are resolved; a no-op in the legacy
  // path, where `\_` is already a placeholder before this runs.
  text = text.replace(/\\_/g, showdown.helper.escapePlaceholder('_'));

  if (options.literalMidWordUnderscores) {

    const rgx1 = /\b___(\S[\s\S]*?)___\b/g;
    text = text.replace(rgx1, function (wm, txt) {
      return parse(rgx1, wm, txt);
    });

    const rgx2 = /\b__(\S[\s\S]*?)__\b/g;
    text = text.replace(rgx2, function (wm, txt) {
      return parse(rgx2, wm, txt);
    });
  } else {

    const rgx3 = /___(\S[\s\S]*?)___/g;
    text = text.replace(rgx3, function (wm, txt) {
      if (!(/\S$/.test(txt))) {
        return wm;
      }
      return parse(rgx3, wm, txt);
    });

    const rgx4 = /__(\S[\s\S]*?)__/g;
    text = text.replace(rgx4, function (wm, txt) {
      if (!(/\S$/.test(txt))) {
        return wm;
      }
      return parse(rgx4, wm, txt);
    });
  }

  // escape remaining underscores to prevent them being parsed by italic and bold
  text = text.replace(/(_)/g, showdown.helper.escapeCharactersCallback);

  let afterEvent = showdown.Event.dispatchEnd('makehtml.underline.onEnd', text, options, globals);
  return afterEvent.output;


  function parse (pattern, wholeMatch, txt) {
    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.underline.onCapture', txt, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        text: txt
      },
      attributes: {}
    }, options, globals);
    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      otp = '<u' + showdown.helper._populateAttributes(captureStartEvent.attributes) + '>' +
        showdown.subParser('makehtml.hardLineBreaks')(captureStartEvent.matches.text, options, globals) +
        '</u>';
    }
    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.underline.onHash', otp, options, globals);
    return beforeHashEvent.output;
  }


});
