showdown.subParser('makehtml.strikethrough', function (text, options, globals) {
  'use strict';
  if (!options.strikethrough) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.strikethrough.onStart', text, options, globals);
  text = startEvent.output;

  // GFM strikethrough: a run of one or two tildes, matched in length, with flanking
  // (the run must hug non-whitespace on the inside) and rejecting runs of three or more.
  // Group 1 captures the character before the opening run (or the string start) so it can
  // be restored; group 3 is the struck-through content.
  const strikethroughRegex = /(^|[^~])(~{1,2})(?=[^\s~])([\s\S]*?[^\s~])\2(?!~)/g;
  text = text.replace(strikethroughRegex, function (wholeMatch, prefix, run, txt) {

    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.strikethrough.onCapture', txt, {
      regexp: strikethroughRegex,
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
      otp = '<del' + showdown.helper._populateAttributes(captureStartEvent.attributes) + '>' +
            showdown.subParser('makehtml.hardLineBreaks')(captureStartEvent.matches.text, options, globals) +
            '</del>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.strikethrough.onHash', otp, options, globals);
    // restore the character that preceded the opening run
    return prefix + beforeHashEvent.output;
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.strikethrough.onEnd', text, options, globals);
  return afterEvent.output;
});
