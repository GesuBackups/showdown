// Shared implementation for the four "wrap the rendered children in a marker" inline
// constructs — emphasis (`*`), strong (`**`), strikethrough (`~~`) and underline (`__`).
// They are identical apart from the wrap marker and their event family, so they collapse
// onto one parametrized factory. It is declared here because emphasis.js is concatenated
// before its three siblings (strikethrough/strong/underline), which register through it.
// Each construct keeps its own subparser registration and full three-phase event family
// (onStart -> onCapture -> onEnd); the marker is exposed on the capture event as the
// read-only `_marker` context key and the rendered child markdown under the mutable,
// honored `text` key.
function makeMarkdownWrapMarkerSubParser (name, marker) {
  'use strict';
  return function (node, options, globals) {
    let input = node.outerHTML;
    showdown.Event.dispatchStart('makeMarkdown.' + name + '.onStart', input, options, globals, {_node: node});

    // an empty element produces no output at all (the markers are only emitted when the
    // element has children — mirrors the pre-factory behavior)
    let hasChildren = node.hasChildNodes(),
        text = '';
    if (hasChildren) {
      let children = node.childNodes,
          childrenLength = children.length;
      for (let i = 0; i < childrenLength; ++i) {
        text += showdown.subParser('makeMarkdown.node')(children[i], options, globals);
      }
    }

    let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.' + name + '.onCapture', input, {
      regexp: null,
      matches: {_wholeMatch: input, _node: node, _marker: marker, text: text},
      attributes: null
    }, options, globals);

    let result;
    if (captureEvent.output && captureEvent.output !== '') {
      result = captureEvent.output;
    } else {
      text = captureEvent.matches.text;
      result = hasChildren ? marker + text + marker : '';
    }

    return showdown.Event.dispatchEnd('makeMarkdown.' + name + '.onEnd', result, options, globals, {_node: node}).output;
  };
}

showdown.subParser('makeMarkdown.emphasis', makeMarkdownWrapMarkerSubParser('emphasis', '*'));
