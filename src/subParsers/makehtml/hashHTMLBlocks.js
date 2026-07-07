/**
 * @file      makehtml/hashHTMLBlocks.js
 * @summary   Replaces top-level raw HTML block elements (`pre`, `div`, `table`, `script`, …) with placeholders.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Shields raw HTML blocks from Markdown parsing by hashing them. A `showdown.helper.*` mechanism,
 * not a construct; emits no events.
 */

// Mechanism (not a construct): hash plumbing. Attached as a showdown.helper
// (no events) rather than registered as a subparser.
showdown.helper.hashHTMLBlocks = function (text, options, globals, sourceMode) {
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

  // Replace a matched element (captured in group 1) with a `¨KxK` placeholder. Folded in
  // from the former makehtml.hashElement subparser (its only consumer was this file); this
  // is also the single remaining copy of the `¨K` placeholder builder used for standalone
  // HR / processor-instruction blocks below.
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

  if (options.backslashEscapesHTMLTags) {
    // encode backslash escaped HTML tags
    text = text.replace(/\\<(\/?[^>]+?)>/g, function (wm, inside) {
      return '&lt;' + inside + '&gt;';
    });
  }

  // The CommonMark block scanner only applies to the original Markdown source
  // (the converter-level pass). blockGamut re-invokes this subparser on the markup
  // it has just generated to prevent <p>-wrapping; there the existing balanced-tag
  // hashing is correct (and must not over-consume generated block tags).
  if (options.cmSpec && sourceMode) {
    text = parseCmHTMLBlocks(text);

    return text;
  }

  // hash HTML Blocks
  for (let i = 0; i < blockTags.length; ++i) {

    let opTagPos,
        rgx1     = new RegExp('^ {0,3}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
        patLeft  = '<' + blockTags[i] + '\\b[^>]*>',
        patRight = '</' + blockTags[i] + '>';
    // 1. Look for the first position of the first opening HTML tag in the text
    while ((opTagPos = showdown.helper.regexIndexOf(text, rgx1)) !== -1) {

      // if the HTML tag is \ escaped, we need to escape it and break


      //2. Split the text in that position
      let subTexts = showdown.helper.splitAtIndex(text, opTagPos),
          //3. Match recursively
          newSubText1 = showdown.helper.replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, 'im');

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
  text = text.replace(/\n\n( {0,3}<([?%])[^\r]*?\2>[ \t]*(?=\n{2,}))/g, hashElement);

  return text;

  /**
   * CommonMark HTML blocks (spec section 4.6): a line-based scanner implementing the
   * 7 block types, each with its own start and end condition. Block content is hashed
   * verbatim (not parsed as Markdown). Types 1-6 may interrupt a paragraph; type 7
   * may only start at a block boundary (document start or after a blank line).
   * @param {string} str
   * @returns {string}
   */
  function parseCmHTMLBlocks (str) {
    const blockNames = 'address|article|aside|base|basefont|blockquote|body|caption|' +
      'center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|' +
      'footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|' +
      'li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|' +
      'summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

    let type1Start = /^ {0,3}<(?:script|pre|style|textarea)(?:[ \t>]|$)/i,
        type1End   = /<\/(?:script|pre|style|textarea)>/i,
        type2Start = /^ {0,3}<!--/,
        type2End   = /-->/,
        type3Start = /^ {0,3}<\?/,
        type3End   = /\?>/,
        type4Start = /^ {0,3}<![A-Za-z]/,
        type4End   = />/,
        type5Start = /^ {0,3}<!\[CDATA\[/,
        type5End   = /]]>/,
        type6Start = new RegExp('^ {0,3}</?(?:' + blockNames + ')(?:[ \\t/>]|$)', 'i'),
        type7Start = new RegExp('^ {0,3}(?:' + showdown.helper.regexes.cmOpenTagSource + '|' +
                      showdown.helper.regexes.cmCloseTagSource + ')[ \\t]*$'),
        isBlank    = /^[ \t]*$/;

    function startType (line, prevBlank) {
      if (type1Start.test(line)) { return 1; }
      if (type2Start.test(line)) { return 2; }
      if (type3Start.test(line)) { return 3; }
      if (type5Start.test(line)) { return 5; }
      if (type4Start.test(line)) { return 4; }
      if (type6Start.test(line)) { return 6; }
      // type 7 cannot interrupt a paragraph
      if (prevBlank && type7Start.test(line)) { return 7; }
      return 0;
    }

    // a fenced-code opener (mirrors githubCodeBlock: an info string carries no backtick,
    // tilde or tab). A fenced code block takes precedence over an HTML block start, so its
    // interior lines must not be scanned for HTML block starts.
    let fenceOpen = /^ {0,3}(```+|~~~+) *[^`~\t]*$/;

    let lines = str.split('\n'),
        out = [],
        i = 0,
        prevBlank = true; // document start behaves like "after a blank line"

    while (i < lines.length) {
      let type = startType(lines[i], prevBlank);
      if (type === 0) {
        let fence = lines[i].match(fenceOpen);
        if (fence) {
          // consume the whole fenced region verbatim (closing fence inclusive, or EOF) so
          // an HTML-block-like line inside the fence cannot open an HTML block. The fence
          // itself is hashed later by githubCodeBlock.
          let closeRe = new RegExp('^ {0,3}[' + fence[1][0] + ']{' + fence[1].length + ',}[ \\t]*$');
          out.push(lines[i]);
          i++;
          while (i < lines.length) {
            out.push(lines[i]);
            if (closeRe.test(lines[i])) { i++; break; }
            i++;
          }
          prevBlank = false;
          continue;
        }
        out.push(lines[i]);
        prevBlank = isBlank.test(lines[i]);
        i++;
        continue;
      }

      let blockLines = [];
      if (type >= 1 && type <= 5) {
        // ends on (and includes) the line matching the end condition; may be the
        // start line itself
        let endRe = [null, type1End, type2End, type3End, type4End, type5End][type];
        while (i < lines.length) {
          let l = lines[i];
          blockLines.push(l);
          i++;
          if (endRe.test(l)) { break; }
        }
      } else {
        // types 6 and 7 end before the first following blank line (or at EOF)
        while (i < lines.length && !isBlank.test(lines[i])) {
          blockLines.push(lines[i]);
          i++;
        }
      }

      // wrap the placeholder in blank lines so later block parsing treats it as its
      // own block. A CommonMark HTML block is raw verbatim source: its content (including
      // any entities) must NOT be decoded, so it gets a distinct `¨R` marker and a separate
      // store, and is restored late - after decodeEntities - rather than being unhashed in
      // paragraphs like generated `¨K`/`¨G` blocks (which legitimately decode).
      out.push('\n¨R' + (globals.gHtmlRawBlocks.push(blockLines.join('\n')) - 1) + 'R\n');
      prevBlank = false;
    }

    return out.join('\n');
  }
};
