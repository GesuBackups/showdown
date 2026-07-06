showdown.subParser('makeMarkdown.links', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.links.onStart', input, options, globals, {_node: node});

  // render the link text (children) and gather the descriptive pieces
  let hasChildren = node.hasChildNodes(),
      innerTxt = '';
  if (hasChildren) {
    let children = node.childNodes,
        childrenLength = children.length;
    for (let i = 0; i < childrenLength; ++i) {
      innerTxt += showdown.subParser('makeMarkdown.node')(children[i], options, globals);
    }
  }
  let href  = node.hasAttribute('href') ? node.getAttribute('href') : '',
      title = node.hasAttribute('title') ? node.getAttribute('title') : null;

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.links.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: innerTxt, url: href, title: title},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    innerTxt = captureEvent.matches.text;
    href = captureEvent.matches.url;
    title = captureEvent.matches.title;
    result = (function () {
      if (!hasChildren) {
        return '';
      }

      // anchors without an href (e.g. named anchors) lose their link semantics but keep their text
      if (!node.hasAttribute('href')) {
        return innerTxt;
      }

      // special case for mentions
      // to simplify (and not make stuff really complicated) mentions will only work in this circumstance:
      // <a class="user-mention" href="https://github.com/user">@user</a>
      // that is, if there's a "user-mention" class and option ghMentions is true
      // otherwise is ignored
      let classes = node.getAttribute('class');
      if (options.ghMentions && /(?:^| )user-mention\b/.test(classes)) {
        return innerTxt;
      }

      // autolink: when the link text is identical to the href and there's no title,
      // emit the compact <href> form instead of [href](<href>)
      if (!node.hasAttribute('title') && innerTxt === href) {
        return '<' + showdown.helper.escapeMarkdownDestination(href) + '>';
      }

      let txt = '[' + innerTxt + '](<' + showdown.helper.escapeMarkdownDestination(href) + '>';
      if (node.hasAttribute('title')) {
        txt += ' "' + showdown.helper.escapeMarkdownTitle(title) + '"';
      }
      txt += ')';
      return txt;
    })();
  }

  return showdown.Event.dispatchEnd('makeMarkdown.links.onEnd', result, options, globals, {_node: node}).output;
});
