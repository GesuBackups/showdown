/**
 * @file      makehtml/emphasisAndStrong.js
 * @summary   Converts `*`/`_` emphasis and strong markers into `<em>`/`<strong>` (default, non-cmSpec path).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Implements Markdown emphasis/strong with a CommonMark-style delimiter-stack/flanking-rule path
 * (using `\p{...}` Unicode property escapes). Emits capture events under the `.emphasis`, `.strong`
 * and `.emphasisAndStrong` sub-namespaces plus the top-level lifecycle. In cmSpec mode emphasis is
 * handled by `cmInline` instead.
 */

/* jshint esnext: false, esversion: 9 */
// (esversion 9 enables the \p{...} Unicode property escapes used for CommonMark flanking rules)

showdown.subParser('makehtml.emphasisAndStrong', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.emphasisAndStrong.onStart', text, options, globals);
  text = startEvent.output;

  /**
   * @param {string} txt
   * @param {string} tags
   * @param {string} wholeMatch
   * @param {RegExp} pattern
   * @returns {string}
   */
  function parseInside (txt, tags, wholeMatch, pattern) {
    let otp = 'ERROR',
        attributes,
        subEventName;

    switch (tags) {
      case '<em>':
        attributes = {
          em: {}
        };
        subEventName = 'emphasis';
        break;
      case '<strong>':
        attributes = {
          strong: {}
        };
        subEventName = 'strong';
        break;
      case '<strong><em>':
        attributes = {
          em: {},
          strong: {}
        };
        subEventName = 'emphasisAndStrong';
        break;
      default:
        attributes = {};
        subEventName = 'emphasisAndStrong';
        break;
    }

    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.emphasisAndStrong.' + subEventName + '.onCapture', txt, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        text: txt
      },
      attributes: attributes
    }, options, globals);
    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      attributes = captureStartEvent.attributes;
      // honor a listener that rewrote the wrapped text via matches.text
      txt = captureStartEvent.matches.text;
      if (showdown.helper.isUndefined(attributes.em)) {
        attributes.em = {};
      }
      if (showdown.helper.isUndefined(attributes.strong)) {
        attributes.strong = {};
      }

      switch (tags) {
        case '<em>':
          otp = '<em' + showdown.helper._populateAttributes(attributes.em) + '>' +
                showdown.subParser('makehtml.hardLineBreaks')(txt, options, globals) +
                '</em>';
          break;
        case '<strong>':
          otp = '<strong' + showdown.helper._populateAttributes(attributes.strong) + '>' +
                showdown.subParser('makehtml.hardLineBreaks')(txt, options, globals) +
                '</strong>';
          break;
        case '<strong><em>':
          otp = '<strong' + showdown.helper._populateAttributes(attributes.strong) + '>' +
                '<em' + showdown.helper._populateAttributes(attributes.em) + '>' +
                showdown.subParser('makehtml.hardLineBreaks')(txt, options, globals) +
                '</em>' +
                '</strong>';
          break;
      }
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.emphasisAndStrong.' + subEventName + '.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    otp = showdown.helper.hashHTMLSpans(otp, options, globals);
    return otp;
  }

  // CommonMark-compliant emphasis/strong parsing (delimiter-run algorithm).
  // Gated behind the `commonmarkEmphasis` option (enabled by the commonmark flavor) because
  // it diverges from Showdown's default behavior (e.g. intraword underscores, flanking rules).
  if (options.cmSpec) {
    text = parseCommonmarkEmphasis(text);

    let cmAfterEvent = showdown.Event.dispatchEnd('makehtml.emphasisAndStrong.onEnd', text, options, globals);
    return cmAfterEvent.output;
  }

  /**
   * Parse emphasis and strong emphasis using the CommonMark delimiter-run algorithm.
   * Runs on the shared delimiter-stack engine (showdown.helper.DelimiterStack); the only
   * path-specific behavior is the inner-render/hash strategy in `buildWrapped` below (no
   * sentinel fix-up, non-raw wrap nodes — this path runs before the converter's `$`/`¨`
   * swap semantics matter to flanking).
   * @param {string} str
   * @returns {string}
   */
  function parseCommonmarkEmphasis (str) {
    let stack = new showdown.helper.DelimiterStack();

    // 1. Tokenize into a doubly-linked list of nodes; collect a delimiter stack.
    const len = str.length;
    let i = 0;
    while (i < len) {
      let ch = str.charAt(i);
      if (ch === '*' || ch === '_') {
        let start = i;
        while (i < len && str.charAt(i) === ch) {
          ++i;
        }
        stack.pushDelim(str, start, i, ch, false);
      } else {
        // accumulate a literal text run up to the next delimiter
        let start = i;
        while (i < len && str.charAt(i) !== '*' && str.charAt(i) !== '_') {
          ++i;
        }
        stack.appendText(str.slice(start, i));
      }
    }

    // 2. Process emphasis (CommonMark reference algorithm).
    stack.processEmphasis(null, buildWrapped, false);

    // 3. Render remaining nodes back to a string.
    return stack.renderList(function (n) { return n.literal; });

    // Render + hash a single emphasis/strong span for this (non-cmSpec) path: emphasis
    // content is hashed here, before the rest of the span gamut runs, so apply hard line
    // breaks and encode double quotes now (CommonMark renders quotes as &quot;).
    function buildWrapped (tagOpen, tagClose, opener, closer) {
      let inner = stack.renderRange(opener.next, closer, function (n) { return n.literal; });
      inner = showdown.subParser('makehtml.hardLineBreaks')(inner, options, globals);
      inner = inner.replace(/"/g, '&quot;');
      return showdown.helper.hashHTMLSpans(tagOpen + inner + tagClose, options, globals);
    }
  }

  // it's faster to have separate regexes for each case than have just one
  // because of backtracking, in some cases, it could lead to an exponential effect
  // called "catastrophic backtrace". Ominous!
  const lmwuStrongEmRegex         = /\b___(\S[\s\S]*?)___\b/g,
      lmwuStrongRegex             = /\b__(\S[\s\S]*?)__\b/g,
      lmwuEmRegex                 = /\b_(\S[\s\S]*?)_\b/g,
      underscoreStrongEmRegex     = /___(\S[\s\S]*?)___/g,
      unserscoreStrongRegex       = /__(\S[\s\S]*?)__/g,
      unserscoreEmRegex           = /_([^\s_][\s\S]*?)_/g,

      asteriskStrongEm            = /\*\*\*(\S[\s\S]*?)\*\*\*/g,
      asteriskStrong              = /\*\*(\S[\s\S]*?)\*\*/g,
      asteriskEm                  = /\*([^\s*][\s\S]*?)\*/g;


  // Parse underscores
  if (options.literalMidWordUnderscores) {
    text = text.replace(lmwuStrongEmRegex, function (wm, txt) {
      return parseInside (txt, '<strong><em>', wm, lmwuStrongEmRegex);
    });
    text = text.replace(lmwuStrongRegex, function (wm, txt) {
      return parseInside (txt, '<strong>', wm, lmwuStrongRegex);
    });
    text = text.replace(lmwuEmRegex, function (wm, txt) {
      return parseInside (txt, '<em>', wm, lmwuEmRegex);
    });
  } else {
    text = text.replace(underscoreStrongEmRegex, function (wm, m) {
      return (/\S$/.test(m)) ? parseInside (m, '<strong><em>', wm, underscoreStrongEmRegex) : wm;
    });
    text = text.replace(unserscoreStrongRegex, function (wm, m) {
      return (/\S$/.test(m)) ? parseInside (m, '<strong>', wm, unserscoreStrongRegex) : wm;
    });
    text = text.replace(unserscoreEmRegex, function (wm, m) {
      // !/^_[^_]/.test(m) - test if it doesn't start with __ (since it seems redundant, we removed it)
      return (/\S$/.test(m)) ? parseInside (m, '<em>', wm, unserscoreEmRegex) : wm;
    });
  }

  // Now parse asterisks
  text = text.replace(asteriskStrongEm, function (wm, m) {
    return (/\S$/.test(m)) ? parseInside (m, '<strong><em>', wm, asteriskStrongEm) : wm;
  });
  text = text.replace(asteriskStrong, function (wm, m) {
    return (/\S$/.test(m)) ? parseInside (m, '<strong>', wm, asteriskStrong) : wm;
  });
  text = text.replace(asteriskEm, function (wm, m) {
    // !/^\*[^*]/.test(m) - test if it doesn't start with ** (since it seems redundant, we removed it)
    return (/\S$/.test(m)) ? parseInside (m, '<em>', wm, asteriskEm) : wm;
  });
  //}
  let afterEvent = showdown.Event.dispatchEnd('makehtml.emphasisAndStrong.onEnd', text, options, globals);
  return afterEvent.output;
});
