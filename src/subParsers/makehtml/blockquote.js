/**
 * @file      makehtml/blockquote.js
 * @summary   Converts `>`-prefixed Markdown blockquotes into `<blockquote>` blocks.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes email-style blockquote syntax, recursing through `blockGamut` for inner content, and
 * has a separate cmSpec container parser (`parseCmBlockquotes`); guards against pathological nesting
 * (bails past depth 25). Emits the `makehtml.blockquote.*` event family.
 */


showdown.subParser('makehtml.blockquote', function (text, options, globals) {
  'use strict';

  // Pathologically nested block quotes (e.g. `> > > …` thousands deep) recurse once per
  // level through blockGamut, which exhausts the call stack in the default path and blows
  // up super-linearly under cmSpec. Refuse to descend past a sane nesting depth; beyond it
  // the surplus `>` markers simply render as literal text. The deepest nesting in the whole
  // test corpus is 3, so this bound never affects real documents.
  const maxNestingDepth = 25;
  if ((globals.blockquoteDepth || 0) >= maxNestingDepth) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.blockquote.onStart', text, options, globals);
  text = startEvent.output;

  if (options.cmSpec) {
    text = parseCmBlockquotes(text);
  } else {
    let pattern = /(^ {0,3}>[ \t]?.+\n(.+\n)*\n*)+/gm;

    if (options.splitAdjacentBlockquotes) {
      pattern = /^ {0,3}>[\s\S]*?\n\n/gm;
    }

    text = text.replace(pattern, function (bq) {
      let wholeMatch = bq;
      bq = bq.replace(/^[ \t]*>[ \t]?/gm, ''); // trim one level of quoting
      bq = bq.replace(/^[ \t]+$/gm, ''); // trim whitespace-only lines
      return renderBlockquote(bq, wholeMatch, pattern);
    });
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.blockquote.onEnd', text, options, globals);
  return afterEvent.output;

  /**
   * Render one block quote's already-stripped content into a hashed
   * `<blockquote>` element, dispatching the capture/hash lifecycle events.
   * @param {string} bq the block-quote content with markers already removed
   * @param {string} wholeMatch the original matched text (for the capture event)
   * @param {RegExp|null} pattern the matching pattern (event metadata only)
   * @returns {string}
   */
  function renderBlockquote (bq, wholeMatch, pattern) {
    let otp,
        attributes;

    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.blockquote.onCapture', bq, {
      regexp: pattern || null,
      matches: {
        _wholeMatch: wholeMatch,
        text: bq
      },
      attributes: {}
    }, options, globals);
    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;

    } else {
      bq = captureStartEvent.matches.text;
      bq = showdown.subParser('makehtml.githubCodeBlock')(bq, options, globals);
      // CommonMark container mode: run the source-level leaf-block passes on the quote's
      // own (marker-stripped) content, mirroring the converter pipeline, so an HTML block
      // or a link reference definition nested inside the block quote is recognized in the
      // quote's context instead of only at the top level.
      if (options.cmSpec) {
        bq = showdown.helper.hashHTMLBlocks(bq, options, globals, true);
        bq = showdown.subParser('makehtml.stripLinkDefinitions')(bq, options, globals);
      }
      globals.blockquoteDepth = (globals.blockquoteDepth || 0) + 1;
      bq = showdown.subParser('makehtml.blockGamut')(bq, options, globals); // recurse
      bq = showdown.subParser('makehtml.paragraphs')(bq, options, globals);
      globals.blockquoteDepth--;
      bq = bq.replace(/(^|\n)/g, '$1  ');
      // These leading spaces screw with <pre> content, so we need to fix that:
      bq = bq.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm, function (wm, m1) {
        return m1.replace(/^ {2}/mg, '');
      });
      attributes = captureStartEvent.attributes;
      otp = '<blockquote' + showdown.helper._populateAttributes(attributes) + '>\n' +  bq + '\n</blockquote>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.blockquote.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    return showdown.helper.hashBlock(otp, options, globals);
  }

  /**
   * CommonMark block-quote container parsing (spec section 5.1). Scans line by
   * line: a block quote consumes consecutive lines that carry the `>` marker
   * (an optional single space after `>` is stripped), plus lazy paragraph
   * continuation lines (markerless non-blank text that follows a paragraph line).
   * A blank line, or a markerless line that cannot lazily continue a paragraph,
   * ends the block quote; two block quotes separated by a blank line are distinct.
   * @param {string} str
   * @returns {string}
   */
  function parseCmBlockquotes (str) {
    let marker = /^ {0,3}>/,
        lines = str.split('\n'),
        out = [],
        i = 0,
        n = lines.length;

    // a markerless line that can lazily continue a paragraph: non-blank text that
    // does not itself begin a block which would interrupt the paragraph
    function isLazyParagraph (line) {
      if (line.trim() === '') { return false; }
      return !(
        marker.test(line) ||                                // block quote
        /^ {0,3}#{1,6}(?:[ \t]|$)/.test(line) ||             // ATX heading
        /^ {0,3}(?:```|~~~)/.test(line) ||                   // fenced code
        /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/.test(line) ||// thematic break
        /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]/.test(line)       // list item
      );
    }

    // true if, after peeling nested block-quote/list markers, the innermost block
    // on this line is an open paragraph - so a following markerless line may lazily
    // continue it (laziness propagates through container nesting)
    function isParagraphLine (stripped) {
      let s = stripped,
          indentedCode = /^ {4}/.test(stripped),
          m;
      while ((m = s.match(/^ {0,3}>[ \t]?/) || s.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]/))) {
        s = s.slice(m[0].length);
        indentedCode = false; // leading spaces after a marker are container indent
      }
      if (s.trim() === '' || indentedCode) { return false; }
      return !(
        /^ {0,3}(?:```|~~~)/.test(s) ||
        /^ {0,3}#{1,6}(?:[ \t]|$)/.test(s) ||
        /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/.test(s)
      );
    }

    while (i < n) {
      if (!marker.test(lines[i])) {
        out.push(lines[i]);
        i++;
        continue;
      }
      let bqLines = [],
          prevParagraph = false;
      while (i < n) {
        let line = lines[i];
        if (marker.test(line)) {
          let stripped = line.replace(/^ {0,3}>[ \t]?/, '');
          bqLines.push(stripped);
          prevParagraph = isParagraphLine(stripped);
          i++;
        } else if (prevParagraph && isLazyParagraph(line)) {
          // CommonMark: a setext underline may not be a lazy continuation line. Escape the
          // leading marker so the recursive setext parser can't claim it as an underline;
          // encodeBackslashEscapes restores the literal `=`/`-` downstream.
          if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) {
            line = line.replace(/^( {0,3})([=-])/, '$1\\$2');
          }
          bqLines.push(line);
          prevParagraph = isParagraphLine(line);
          i++;
        } else {
          break; // blank line or non-continuing line ends the block quote
        }
      }
      // trailing newline mirrors the original regex match (which ended in \n) so the
      // recursive block parsers see a complete final line
      let content = bqLines.join('\n') + '\n';
      out.push(renderBlockquote(content, content, null));
    }
    return out.join('\n');
  }
});
