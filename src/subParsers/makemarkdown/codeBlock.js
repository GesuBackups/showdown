/**
 * @file      makemarkdown/codeBlock.js
 * @summary   Renders a `<pre><code>` block back to a fenced code block, or raw HTML when `ghCodeBlocks` is off.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `makeMarkdown.*` DOM-node subparser (HTML→Markdown): pulls the stashed code from `globals.preList`
 * and re-escapes special chars when emitting raw HTML. Emits `makeMarkdown.codeBlock.onStart`/`onCapture`/`onEnd`.
 */
showdown.subParser('makeMarkdown.codeBlock', function (node, options, globals) {
  'use strict';

  let input = node.outerHTML;
  showdown.Event.dispatchStart('makeMarkdown.codeBlock.onStart', input, options, globals, {_node: node});

  let lang = node.getAttribute('language'),
      num  = node.getAttribute('precodenum'),
      code = globals.preList[num];

  let captureEvent = showdown.Event.dispatchCapture('makeMarkdown.codeBlock.onCapture', input, {
    regexp: null,
    matches: {_wholeMatch: input, _node: node, text: code, language: lang},
    attributes: null
  }, options, globals);

  let result;
  if (captureEvent.output && captureEvent.output !== '') {
    result = captureEvent.output;
  } else {
    code = captureEvent.matches.text;
    lang = captureEvent.matches.language;
    if (options.ghCodeBlocks) {
      result = '```' + lang + '\n' + code + '\n```';
    } else {
      // fenced code blocks disabled -> emit raw HTML (re-escape the special chars that
      // substitutePreCodeTags decoded when it stashed the content)
      let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
          langClass = lang ? ' class="' + lang + '"' : '';
      result = '<pre><code' + langClass + '>' + escaped + '</code></pre>';
    }
  }

  return showdown.Event.dispatchEnd('makeMarkdown.codeBlock.onEnd', result, options, globals, {_node: node}).output;
});
