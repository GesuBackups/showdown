showdown.subParser('makeMarkdown.input', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.input.onStart', input, options, globals, {_node: node});

  // A checkbox input maps to a `[ ]`/`[x]` task marker only when the `tasklists` option is
  // enabled, the checkbox lives inside a list item, AND it is followed by some content.
  // The list-item context matters: in Markdown a `[ ]`/`[x]` marker is only a task when it
  // leads a list item, so a naked checkbox (top level, or inside a `<p>`/`<div>`) would
  // degrade into meaningless literal bracket text that no longer round-trips back to a
  // checkbox. The following-content check matters for the same reason: a bare
  // `<li><input type="checkbox"></li>` has no task text, and `- [ ]` on its own does not
  // round-trip to a checkbox, so it is kept as the raw `<input>` instead. Detection
  // deliberately keys on the `<li>` ancestry rather than the `task-list-item` class (which
  // `makeHtml` only emits under `moreStyling`), so checkboxes in hand-written or unstyled
  // list HTML are still recognised. Anything that fails these checks passes through as raw
  // HTML. A `checked` attribute (any value, including empty) marks it done; its absence open.
  let isTask = node.getAttribute('type') === 'checkbox' && options.tasklists &&
        isInsideListItem(node) && hasFollowingContent(node),
      checked = node.getAttribute('checked') !== null;

  // this construct renders a task marker rather than inner content, so its capture carries no
  // `text` key; the checked state is exposed (and honored) under `checked`
  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.input.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, checked: checked},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else if (!isTask) {
    result = node.outerHTML;
  } else {
    result = captureEvent.matches.checked ? '[x]' : '[ ]';
  }

  return showdown.Event.dispatchEnd('makeMarkdown.input.onEnd', result, options, globals, {_node: node}).output;

  // Walks up the ancestor chain looking for an enclosing `<li>` (covers both tight
  // `<li><input>` items and loose `<li><p><input>` ones).
  function isInsideListItem (n) {
    let parent = n.parentNode;
    while (parent && typeof parent.tagName !== 'undefined') {
      if (parent.tagName.toLowerCase() === 'li') {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  }

  // True when the checkbox is followed by actual task text — an element sibling, or a text
  // node that is not just whitespace. A checkbox with nothing meaningful after it is not a
  // task list item (`- [ ]` alone does not round-trip back to a checkbox).
  function hasFollowingContent (n) {
    let sibling = n.nextSibling;
    while (sibling) {
      if (sibling.nodeType === 1) {
        return true;
      }
      if (sibling.nodeType === 3 && sibling.nodeValue.trim() !== '') {
        return true;
      }
      sibling = sibling.nextSibling;
    }
    return false;
  }
});
