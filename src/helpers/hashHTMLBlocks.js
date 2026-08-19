/**
 * @file      helpers/hashHTMLBlocks.js
 * @summary   Hashes block-level HTML that the block parsers GENERATED, so `paragraphs` won't wrap it in `<p>`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A `showdown.helper.*` MECHANISM (no events, not a construct): it protects the markup the block
 * parsers just produced from a spurious `<p>` wrap. It has NO source-recognition role — recognizing
 * raw HTML blocks in the Markdown *source* is the job of the `makehtml.htmlBlock` subparser. Called
 * by `blockGamut` and `list` on generated markup. Uses the shared `¨K`/`gHtmlBlocks` placeholder
 * store (see `hashBlock`).
 */

showdown.helper.hashHTMLBlocks = function (text, options, globals) {
  'use strict';

  let blockTags = [
        'pre',
        'div',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'table',
        'dl',
        'ol',
        'ul',
        'script',
        'noscript',
        'form',
        'fieldset',
        'iframe',
        'math',
        'style',
        'section',
        'header',
        'footer',
        'nav',
        'article',
        'aside',
        'address',
        'audio',
        'canvas',
        'figure',
        'hgroup',
        'output',
        'video',
        'details',
        'p'
      ],
      repFunc = function (wholeMatch, match, left, right) {
        let txt = wholeMatch;
        // check if this html element is marked as markdown
        // if so, it's contents should be parsed as markdown
        if (left.search(/\bmarkdown\b/) !== -1) {
          txt = left + globals.converter.makeHtml(match) + right;
        }
        return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
      };

  // Replace a standalone element (captured in group 1) with a `¨KxK` placeholder — the shared
  // `¨K` placeholder builder for standalone HR / processor-instruction generated markup below.
  function hashElement (wholeMatch, m1) {
    let blockText = m1;

    // Undo double lines
    blockText = blockText.replace(/\n\n/g, '\n');
    blockText = blockText.replace(/^\n/, '');

    // strip trailing blank lines
    blockText = blockText.replace(/\n+$/g, '');

    // Replace the element text with a marker ("¨KxK" where x is its key)
    blockText = '\n\n¨K' + (globals.gHtmlBlocks.push(blockText) - 1) + 'K\n\n';

    return blockText;
  }

  // hash HTML Blocks
  for (let i = 0; i < blockTags.length; ++i) {

    let opTagPos,
        rgx1     = new RegExp('^ {0,3}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
        patLeft  = '<' + blockTags[i] + '\\b[^>]*>',
        patRight = '</' + blockTags[i] + '>',
        closeRe  = new RegExp(patRight, 'im');
    // 1. Look for the first position of the first opening HTML tag in the text
    while ((opTagPos = showdown.helper.regexIndexOf(text, rgx1)) !== -1) {

      //2. Split the text in that position
      let subTexts = showdown.helper.splitAtIndex(text, opTagPos);
      // Absent-close-tag guard (ReDoS). replaceRecursiveRegExp -> rgxFindMatchPos restarts its
      // scan once per unbalanced opener, so a run of openers with no matching closer ahead is
      // O(n^2). If no closing tag follows the opener no balanced block can form, so skip the
      // recursive scan — its result would be the text unchanged, exactly the `break` below, so
      // this is byte-identical (mirrors the same guard in the makehtml.htmlBlock subparser).
      if (!closeRe.test(subTexts[1])) {
        break;
      }
      //3. Match recursively
      let newSubText1 = showdown.helper.replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, 'im');

      // prevent an infinite loop
      if (newSubText1 === subTexts[1]) {
        break;
      }
      text = subTexts[0].concat(newSubText1);
    }
  }
  // HR SPECIAL CASE
  text = text.replace(/(\n {0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g, hashElement);

  // Special case for standalone HTML comments
  // A comment is terminated by either `-->` or `--!>` (the HTML "comment end
  // bang" state). Matching only `-->` lets content an author believes is
  // commented-out leak through to the browser as live HTML (js/bad-tag-filter).
  text = showdown.helper.replaceRecursiveRegExp(text, function (txt) {
    return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
  }, '^ {0,3}<!--', '--!?>', 'gm');

  // PHP and ASP-style processor instructions (<?...?> and <%...%>)
  text = showdown.helper.replaceProcessorInstructions(text, hashElement);

  return text;
};
