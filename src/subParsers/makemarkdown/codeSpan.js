/**
 * @file      makemarkdown/codeSpan.js
 * @summary   Renders a `<code>` inline element back to a backtick code span.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown): chooses a fence longer than any interior
 * backtick run. Emits `makeMarkdown.codeSpan.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.codeSpan', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.codeSpan.onStart', input, options, globals, {_node: node});

  let code = showdown.helper.unescapeHTMLEntities(node.innerHTML);

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.codeSpan.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: code},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    code = captureEvent.matches.text;
    // pick a backtick fence longer than the longest run of backticks inside the content
    let backtickRuns = code.match(/`+/g),
        longestRun = 0;
    if (backtickRuns) {
      for (let b = 0; b < backtickRuns.length; ++b) {
        if (backtickRuns[b].length > longestRun) {
          longestRun = backtickRuns[b].length;
        }
      }
    }
    let fence = new Array(longestRun + 2).join('`'),
        pad = (longestRun > 0) ? ' ' : '';
    result = fence + pad + code + pad + fence;
  }

  return showdown.Event.dispatchEnd('makeMarkdown.codeSpan.onEnd', result, options, globals, {_node: node}).output;
});
