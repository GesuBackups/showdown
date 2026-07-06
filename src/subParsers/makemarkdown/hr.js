showdown.subParser('makeMarkdown.hr', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.hr.onStart', input, options, globals, {_node: node});

  // a horizontal rule has no inner content, so its capture carries no `text` key
  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.hr.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    result = '---';
  }

  return showdown.Event.dispatchEnd('makeMarkdown.hr.onEnd', result, options, globals, {_node: node}).output;
});
