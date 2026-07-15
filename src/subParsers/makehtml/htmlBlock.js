/**
 * @file      makehtml/htmlBlock.js
 * @summary   Recognizes raw HTML blocks in the Markdown source and shields them from Markdown parsing.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The subparser that owns HTML-block *syntax* (specs: original.md / showdown.md "HTML blocks",
 * CommonMark §4.6). Two recognition strategies are gated on the one documented divergence:
 *  - `cmSpec` — CommonMark's seven typed HTML blocks (line-based scanner); each block is stored
 *    verbatim under a `¨R` placeholder (`gHtmlRawBlocks`), restored late so its entities are not
 *    decoded.
 *  - otherwise — Original/Showdown's balanced-tag model plus the `markdown="1"` attribute and the
 *    standalone HR / comment / processor-instruction cases; blocks are stored under `¨K`
 *    (`gHtmlBlocks`). (Unifying legacy blocks onto `¨R` is deferred — it entangles with the
 *    markdown-attribute case, whose stored content is generated HTML, not raw source.)
 *
 * The complementary MECHANISM — hashing the block-level markup the block parsers *generate* (to keep
 * `paragraphs` from wrapping it in `<p>`) — is `showdown.helper.hashHTMLBlocks`, a plain helper with
 * no source-recognition role and no events.
 *
 * Emits the `makehtml.htmlBlock.*` event family: `onStart`/`onEnd` lifecycle plus, per recognized
 * block, `onCapture` (`matches.text` = the raw block source; a listener may rewrite it or set
 * `output` to replace/suppress the block) and `onHash`.
 */
showdown.subParser('makehtml.htmlBlock', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.htmlBlock.onStart', text, options, globals);
  text = startEvent.output;

  if (options.backslashEscapesHTMLTags) {
    // encode backslash escaped HTML tags
    text = text.replace(/\\<(\/?[^>]+?)>/g, function (wm, inside) {
      return '&lt;' + inside + '&gt;';
    });
  }

  if (options.cmSpec) {
    text = parseCmHTMLBlocks(text);
  } else {
    text = hashLegacyHTMLBlocks(text);
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.htmlBlock.onEnd', text, options, globals);
  return afterEvent.output;

  /**
   * Dispatch the per-block capture/hash lifecycle for one recognized source block and return
   * what should replace it in the text (a placeholder, or a listener-provided override).
   * @param {string} rawBlock the raw HTML block source (the capture's `matches.text`)
   * @param {function(string): string} buildPlaceholder given the (possibly listener-rewritten)
   *        raw block, returns the placeholder that stores it
   * @param {boolean} [processed] true when the stored content is generated (markdown-attribute
   *        blocks) rather than the raw block, so a `matches.text` rewrite is not re-applied
   * @param {string} [processedPlaceholder] the placeholder to use when `processed` and no rewrite
   * @returns {string}
   */
  function captureBlock (rawBlock, buildPlaceholder, processed, processedPlaceholder) {
    let captureEvent = showdown.Event.dispatchCapture('makehtml.htmlBlock.onCapture', rawBlock, {
      regexp: null,
      matches: {
        _wholeMatch: rawBlock,
        text: rawBlock
      },
      attributes: {}
    }, options, globals);

    let otp;
    // a listener may replace or suppress the whole block via output precedence
    if (captureEvent.output && captureEvent.output !== '') {
      otp = captureEvent.output;
    } else if (processed) {
      otp = processedPlaceholder;
    } else {
      // honor a listener that rewrote the raw block text
      otp = buildPlaceholder(captureEvent.matches.text);
    }

    let hashEvent = showdown.Event.dispatchHash('makehtml.htmlBlock.onHash', otp, options, globals);
    return hashEvent.output;
  }

  /**
   * Store a raw block under a `¨K` placeholder (`gHtmlBlocks`).
   * @param {string} content
   * @returns {string}
   */
  function hashK (content) {
    return '\n\n¨K' + (globals.gHtmlBlocks.push(content) - 1) + 'K\n\n';
  }

  /**
   * Original/Showdown HTML-block recognition: balanced open/close tag matching over a fixed set
   * of block-level tag names, the `markdown="1"` attribute, and the standalone HR / comment /
   * processor-instruction cases. Blocks are hashed into `gHtmlBlocks` (`¨K`).
   * @param {string} str
   * @returns {string}
   */
  function hashLegacyHTMLBlocks (str) {
    let blockTags = [
          'pre', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'dl', 'ol',
          'ul', 'script', 'noscript', 'form', 'fieldset', 'iframe', 'math', 'style', 'section',
          'header', 'footer', 'nav', 'article', 'aside', 'address', 'audio', 'canvas', 'figure',
          'hgroup', 'output', 'video', 'details', 'p'
        ],
        repFunc = function (wholeMatch, match, left, right) {
          let markdownAttr = left.search(/\bmarkdown\b/) !== -1,
              txt = wholeMatch;
          // an element marked as markdown has its contents parsed as markdown
          if (markdownAttr) {
            txt = left + globals.converter.makeHtml(match) + right;
          }
          return captureBlock(wholeMatch, hashK, markdownAttr, hashK(txt));
        };

    // hash HTML Blocks
    for (let i = 0; i < blockTags.length; ++i) {
      let opTagPos,
          rgx1     = new RegExp('^ {0,3}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
          patLeft  = '<' + blockTags[i] + '\\b[^>]*>',
          patRight = '</' + blockTags[i] + '>';
      // 1. Look for the first position of the first opening HTML tag in the text
      while ((opTagPos = showdown.helper.regexIndexOf(str, rgx1)) !== -1) {
        //2. Split the text in that position
        let subTexts = showdown.helper.splitAtIndex(str, opTagPos),
            //3. Match recursively
            newSubText1 = showdown.helper.replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, 'im');
        // prevent an infinite loop
        if (newSubText1 === subTexts[1]) {
          break;
        }
        str = subTexts[0].concat(newSubText1);
      }
    }
    // HR SPECIAL CASE
    str = str.replace(/(\n {0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g, hashHrOrPi);

    // Special case for standalone HTML comments
    // A comment is terminated by either `-->` or `--!>` (the HTML "comment end
    // bang" state). Matching only `-->` lets content an author believes is
    // commented-out leak through to the browser as live HTML (js/bad-tag-filter).
    str = showdown.helper.replaceRecursiveRegExp(str, function (txt) {
      return captureBlock(txt, hashK, false, null);
    }, '^ {0,3}<!--', '--!?>', 'gm');

    // PHP and ASP-style processor instructions (<?...?> and <%...%>)
    str = str.replace(/\n\n( {0,3}<([?%])[^\r]*?\2>[ \t]*(?=\n{2,}))/g, hashHrOrPi);

    return str;

    // wraps the (cleaned) standalone-element text in the capture/hash lifecycle before hashing
    function hashHrOrPi (wholeMatch, m1) {
      let blockText = m1;
      blockText = blockText.replace(/\n\n/g, '\n');
      blockText = blockText.replace(/^\n/, '');
      blockText = blockText.replace(/\n+$/g, '');
      return captureBlock(wholeMatch, hashK, true, hashK(blockText));
    }
  }

  /**
   * CommonMark HTML blocks (spec section 4.6): a line-based scanner implementing the
   * 7 block types, each with its own start and end condition. Block content is hashed
   * verbatim (not parsed as Markdown) under a `¨R` placeholder. Types 1-6 may interrupt
   * a paragraph; type 7 may only start at a block boundary (document start or after a
   * blank line).
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
        // Deliberate deviation from CommonMark (which recognizes only `-->`): `--!>` — the
        // HTML "comment end bang" state — also terminates a comment, matching what browsers
        // do with the output. Recognizing only `-->` lets content the parser believes is
        // commented out leak through as live HTML (js/bad-tag-filter). Documented in
        // specs/showdown.md and specs/comparison.md.
        type2End   = /--!?>/,
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

      // wrap the placeholder in blank lines so later block parsing treats it as its own
      // block. A CommonMark HTML block is raw verbatim source: its content (including any
      // entities) must NOT be decoded, so it gets a distinct `¨R` marker and a separate
      // store, restored late (after decodeEntities) rather than unhashed in paragraphs like
      // generated `¨K`/`¨G` blocks (which legitimately decode).
      let raw = blockLines.join('\n');
      out.push(captureBlock(raw, function (content) {
        return '\n¨R' + (globals.gHtmlRawBlocks.push(content) - 1) + 'R\n';
      }, false, null));
      prevBlank = false;
    }

    return out.join('\n');
  }
});
