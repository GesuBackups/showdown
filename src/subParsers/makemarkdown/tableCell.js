/**
 * @file      makemarkdown/tableCell.js
 * @summary   Renders a single `<th>`/`<td>` cell's inline content for the table row builder.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown). Emits `makeMarkdown.tableCell.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.tableCell', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.tableCell.onStart', input, options, globals, {_node: node});

  let text = '';
  if (node.hasChildNodes()) {
    let children = node.childNodes,
        childrenLength = children.length;
    for (let i = 0; i < childrenLength; ++i) {
      text += showdown.subParser('makeMarkdown.node')(children[i], options, globals, true);
    }
    text = text.trim();
  }

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.tableCell.onCapture', input, {
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

  return showdown.Event.dispatchEnd('makeMarkdown.tableCell.onEnd', result, options, globals, {_node: node}).output;
});
