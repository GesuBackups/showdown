////
// makehtml/codeBlock.js
// Copyright (c) 2022 ShowdownJS
//
// Process Markdown `<pre><code>` blocks.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.codeBlock', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.codeBlock.onStart', text, options, globals);
  text = startEvent.output;

  // sentinel workarounds for lack of \A and \Z, safari\khtml bug
  text += '¨0';

  let pattern = /(?:\n\n|^)((?:(?: {4}|\t).*\n+)+)(\n* {0,3}[^ \t\n]|(?=¨0))/g;
  text = text.replace(pattern, function (wholeMatch, m1, m2) {
    let codeblock = m1,
        nextChar = m2,
        end = '\n',
        otp,
        attributes = {
          pre: {},
          code: {}
        };

    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.codeBlock.onCapture', codeblock, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        text: codeblock
      },
      attributes: attributes
    }, options, globals);

    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      codeblock = captureStartEvent.matches.text;
      codeblock = showdown.helper.outdent(codeblock);
      codeblock = showdown.helper.encodeCode(codeblock, options, globals);
      //codeblock = showdown.subParser('makehtml.detab')(codeblock, options, globals);
      codeblock = codeblock.replace(/^\n+/g, ''); // trim leading newlines
      codeblock = codeblock.replace(/\n+$/g, ''); // trim trailing newlines
      attributes = captureStartEvent.attributes;

      otp = '<pre><code>';
      if (!showdown.helper.isUndefined(attributes)) {
        otp = '<pre' + showdown.helper._populateAttributes(attributes.pre) + '>';
        otp += '<code' + showdown.helper._populateAttributes(attributes.code) + '>';
      }
      if (options.omitExtraWLInCodeBlocks) {
        end = '';
      }
      otp += codeblock + end + '</code></pre>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.codeBlock.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    return showdown.helper.hashBlock(otp, options, globals) + nextChar;
  });

  // strip sentinel
  text = text.replace(/¨0/, '');

  let afterEvent = showdown.Event.dispatchEnd('makehtml.codeBlock.onEnd', text, options, globals);
  return afterEvent.output;
});
