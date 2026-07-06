showdown.subParser('makeMarkdown.pre', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.pre.onStart', input, options, globals, {_node: node});

  let num  = node.getAttribute('prenum'),
      text = globals.preList[num];

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.pre.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: text},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    result = '<pre>' + captureEvent.matches.text + '</pre>';
  }

  return showdown.Event.dispatchEnd('makeMarkdown.pre.onEnd', result, options, globals, {_node: node}).output;
});
