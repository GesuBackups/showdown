/**
 * @file      makemarkdown/paragraph.js
 * @summary   Renders a `<p>` element back to a Markdown paragraph, converting its inline children.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown). Emits `makeMarkdown.paragraph.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.paragraph', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.paragraph.onStart', input, options, globals, {_node: node});

  let text = '';
  if (node.hasChildNodes()) {
    let children = node.childNodes,
        childrenLength = children.length;
    for (let i = 0; i < childrenLength; ++i) {
      text += showdown.subParser('makeMarkdown.node')(children[i], options, globals);
    }
  }
  // some text normalization
  text = text.trim();

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.paragraph.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: text},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    result = captureEvent.matches.text;
  }

  return showdown.Event.dispatchEnd('makeMarkdown.paragraph.onEnd', result, options, globals, {_node: node}).output;
});
