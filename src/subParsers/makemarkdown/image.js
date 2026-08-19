/**
 * @file      makemarkdown/image.js
 * @summary   Renders `<img>` back to Markdown image syntax `![alt](src)`, reversing emoji images to `:code:` when `emoji` is on.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown). Emits `makeMarkdown.image.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.image', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.image.onStart', input, options, globals, {_node: node});

  // descriptive pieces exposed on the capture event (all mutable and honored by the
  // standard `![alt](url "title")` rendering below)
  let src   = node.hasAttribute('src') ? node.getAttribute('src') : '',
      alt   = node.getAttribute('alt') || '',
      title = node.hasAttribute('title') ? node.getAttribute('title') : null;

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.image.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: alt, url: src, title: title},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    alt = captureEvent.matches.text;
    src = captureEvent.matches.url;
    title = captureEvent.matches.title;
    result = (function () {
      let txt = '';

      // reverse the `emoji` option: "special" emoji render as an <img> whose src is known.
      // Map that back to its :code:. When emoji is off (or the src isn't an emoji) this falls
      // through to normal image handling, so a disabled feature degrades to plain image markdown.
      if (options.emoji && node.hasAttribute('src')) {
        let emojiImages = showdown.helper.emojiReverse().images,
            emojiSrc = node.getAttribute('src');
        if (Object.prototype.hasOwnProperty.call(emojiImages, emojiSrc)) {
          return ':' + emojiImages[emojiSrc] + ':';
        }
      }

      if (node.hasAttribute('src') && node.getAttribute('src') !== '') {
        let hasDimensions = node.hasAttribute('width') && node.hasAttribute('height');

        // image dimensions are a showdown-specific syntax; when the option is disabled but the
        // image carries dimensions, fall back to raw HTML so the size isn't silently lost
        if (hasDimensions && !options.parseImgDimensions) {
          return node.outerHTML;
        }

        txt += '![' + showdown.helper.escapeMarkdownText(alt) + '](';
        txt += '<' + showdown.helper.escapeMarkdownDestination(src) + '>';
        if (hasDimensions) {
          let width = node.getAttribute('width');
          let height = node.getAttribute('height');
          txt += ' =' + (width === 'auto' ? '*' : width) + 'x' + (height === 'auto' ? '*' : height);
        }

        if (node.hasAttribute('title')) {
          txt += ' "' + showdown.helper.escapeMarkdownTitle(title) + '"';
        }
        txt += ')';
      }
      return txt;
    })();
  }

  return showdown.Event.dispatchEnd('makeMarkdown.image.onEnd', result, options, globals, {_node: node}).output;
});
