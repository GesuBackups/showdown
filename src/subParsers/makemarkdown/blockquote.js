/**
 * @file      makemarkdown/blockquote.js
 * @summary   Renders a `<blockquote>` element back into `>`-prefixed Markdown.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown): recurses into the blockquote's children and
 * prefixes each rendered line with `>`. Emits `makeMarkdown.blockquote.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.blockquote', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.blockquote.onStart', input, options, globals, {_node: node});

  // render child content
  let text = '';
  if (node.hasChildNodes()) {
    const children = node.childNodes,
        childrenLength = children.length;
    for (let i = 0; i < childrenLength; ++i) {
      text += showdown.subParser('makeMarkdown.node')(children[i], options, globals);
    }
  }
  text = text.trim();

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.blockquote.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: text},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    text = captureEvent.matches.text;
    result = '> ' + text.split('\n').join('\n> ');
  }

  return showdown.Event.dispatchEnd('makeMarkdown.blockquote.onEnd', result, options, globals, {_node: node}).output;
});
