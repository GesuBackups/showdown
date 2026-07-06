showdown.subParser('makeMarkdown.header', function (node, options, globals, headerLevel) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.header.onStart', input, options, globals, {_node: node});

  // render the header's inner content (the `#` marker is assembled below from `level`)
  let hasChildren = node.hasChildNodes(),
      text = '';
  if (hasChildren) {
    let children = node.childNodes,
        childrenLength = children.length;
    for (let i = 0; i < childrenLength; ++i) {
      text += showdown.subParser('makeMarkdown.node')(children[i], options, globals);
    }
  }

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.header.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: text, level: headerLevel},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    text = captureEvent.matches.text;
    let level = captureEvent.matches.level;
    result = hasChildren ? new Array(level + 1).join('#') + ' ' + text : '';
  }

  return showdown.Event.dispatchEnd('makeMarkdown.header.onEnd', result, options, globals, {_node: node}).output;
});
