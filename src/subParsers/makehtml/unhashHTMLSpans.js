////
// makehtml/unhashHTMLSpans.js
// Copyright (c) 2018 ShowdownJS
//
// Unhash HTML spans
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.unhashHTMLSpans', function (text, options, globals) {
  'use strict';
  let startEvent = new showdown.Event('makehtml.unhashHTMLSpans.onStart', text);
  startEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  startEvent = globals.converter.dispatch(startEvent);
  text = startEvent.output;

  // Resolve one span placeholder to its stored HTML, expanding any nested placeholders it
  // contains (bounded depth, mirrors the historical "assume 20 as limit for recurse").
  function resolveSpan (num) {
    let repText = globals.gHtmlSpans[num],
        limit = 0;
    while (/¨C(\d+)C/.test(repText)) {
      let n2 = repText.match(/¨C(\d+)C/)[1];
      repText = repText.replace('¨C' + n2 + 'C', globals.gHtmlSpans[n2]);
      if (limit === 10) {
        console.error('maximum nesting of 20 spans reached!!!');
        break;
      }
      ++limit;
    }
    return repText;
  }

  // Single pass over the document (was: one String.replace per span, i.e. O(spans × text) —
  // quadratic when the input produces many spans, e.g. `'a_'.repeat(n)`).
  text = text.replace(/¨C(\d+)C/g, function (whole, num) {
    return resolveSpan(num);
  });

  let afterEvent = new showdown.Event('makehtml.unhashHTMLSpans.onEnd', text);
  afterEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  afterEvent = globals.converter.dispatch(afterEvent);
  return afterEvent.output;
});
