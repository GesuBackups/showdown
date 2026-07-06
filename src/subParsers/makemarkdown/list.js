showdown.subParser('makeMarkdown.list', function (node, options, globals, type) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.list.onStart', input, options, globals, {_node: node});

  // assemble the list body (bullet + rendered item, per <li>)
  let text = '';
  if (node.hasChildNodes()) {
    let listItems      = node.childNodes,
        listItemsLength = listItems.length,
        listNum = node.getAttribute('start') || 1;

    for (let i = 0; i < listItemsLength; ++i) {
      if (typeof listItems[i].tagName === 'undefined' || listItems[i].tagName.toLowerCase() !== 'li') {
        continue;
      }

      // define the bullet to use in list
      let bullet;
      if (type === 'ol') {
        bullet = listNum.toString() + '. ';
      } else {
        bullet = '- ';
      }

      // parse list item
      text += bullet + showdown.subParser('makeMarkdown.listItem')(listItems[i], options, globals);
      ++listNum;
    }
  }

  // the list kind is read-only context (`_ordered`/`_listType`); the assembled body is the
  // mutable, honored `text`
  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.list.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, _ordered: type === 'ol', _listType: type, text: text},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    result = captureEvent.matches.text.trim();
  }

  return showdown.Event.dispatchEnd('makeMarkdown.list.onEnd', result, options, globals, {_node: node}).output;
});
