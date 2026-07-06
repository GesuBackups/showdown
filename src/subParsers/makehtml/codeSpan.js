////
// makehtml/codeSpan.js
// Copyright (c) 2018 ShowdownJS
//
// Transforms MD code spans into `<code>` html entities
//
// Backtick quotes are used for <code></code> spans.
//
// You can use multiple backticks as the delimiters if you want to
// include literal backticks in the code span. So, this input:
//
// Just type ``foo `bar` baz`` at the prompt.
//
// Will translate to:
//
// <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
//
// There's no arbitrary limit to the number of backticks you
// can use as delimters. If you need three consecutive backticks
// in your code, use four for delimiters, etc.
//
// You can use spaces to get literal backticks at the edges:
// ... type `` `bar` `` ...
//
// Turns to:
// ... type <code>`bar`</code> ...
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


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
      c = showdown.subParser('makehtml.encodeCode')(c, options, globals);
      otp = m1 + '<code' + showdown.helper._populateAttributes(attributes) + '>' +  c + '</code>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.codeSpan.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    return showdown.subParser('makehtml.hashHTMLSpans')(otp, options, globals);
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.codeSpan.onEnd', text, options, globals);
  return afterEvent.output;
});
