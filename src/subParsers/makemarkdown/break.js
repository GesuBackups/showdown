/**
 * @file      makemarkdown/break.js
 * @summary   Renders a `<br>` element as a hard line break.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown). Emits `makeMarkdown.break.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.break', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.break.onStart', input, options, globals, {_node: node});

  // a hard break has no inner content, so its capture carries no `text` key
  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.break.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    result = '  \n';
  }

  return showdown.Event.dispatchEnd('makeMarkdown.break.onEnd', result, options, globals, {_node: node}).output;
});
