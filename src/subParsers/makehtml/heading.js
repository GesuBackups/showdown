/**
 * @file      makehtml/heading.js
 * @summary   Converts ATX (`#`) and Setext (`===`/`---`) headings into `<h1>`–`<h6>`, generating id attributes.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * An IIFE registering the heading subparser; a shared `parseHeader` handles both styles, namespacing
 * events per style (`.atx`/`.setext`), each with its own lifecycle and capture. The heading-id
 * generator emits the capture-only `makehtml.heading.id.onCapture` hook so listeners can supply
 * custom slugs. The setext regex is the documented ReDoS-sensitive spot.
 */
(function () {

  /**
   *
   * @param {string} subEvtName Heading style ('atx' or 'setext'), used to namespace the dispatched events
   * @param {RegExp} pattern
   * @param {string} wholeMatch
   * @param {string} headingText
   * @param {string} headingLevel
   * @param {string} headingId
   * @param {{}} options
   * @param {{}} globals
   * @returns {string}
   */
  function parseHeader (subEvtName, pattern, wholeMatch, headingText, headingLevel, headingId, options, globals) {
    let otp,
        captureStartEvent = showdown.Event.dispatchCapture('makehtml.heading.' + subEvtName + '.onCapture', headingText, {
          regexp: pattern,
          matches: {
            _wholeMatch: wholeMatch,
            text: headingText
          },
          attributes: {
            id: headingId
          }
        }, options, globals);
    // if something was passed as output, it takes precedence
    // and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;

    } else {
      headingText = captureStartEvent.matches.text;
      let spanGamut = showdown.subParser('makehtml.spanGamut')(headingText, options, globals),
          attributes = captureStartEvent.attributes;
      otp = '<h' + headingLevel + showdown.helper._populateAttributes(attributes) + '>' + spanGamut + '</h' + headingLevel + '>';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.heading.' + subEvtName + '.onHash', otp, options, globals);
    otp = beforeHashEvent.output;

    return showdown.helper.hashBlock(otp, options, globals);
  }

  showdown.subParser('makehtml.heading', function (text, options, globals) {
    'use strict';

    let startEvent = showdown.Event.dispatchStart('makehtml.heading.onStart', text, options, globals);
    text = startEvent.output;

    text = showdown.subParser('makehtml.heading.setext')(text, options, globals);
    text = showdown.subParser('makehtml.heading.atx')(text, options, globals);

    let afterEvent = showdown.Event.dispatchEnd('makehtml.heading.onEnd', text, options, globals);
    return afterEvent.output;

  });

  // Normalize the `headerIds` option into {enabled, prefix, raw}. Accepts `false`
  // (no ids), an object `{prefix, raw}`, or `true`/undefined (github ids, no prefix).
  function resolveHeaderIds (opt) {
    if (opt === false) {
      return { enabled: false, prefix: '', raw: false };
    }
    if (showdown.helper.isObject(opt)) {
      return {
        enabled: true,
        prefix: showdown.helper.isString(opt.prefix) ? opt.prefix : '',
        raw: !!opt.raw
      };
    }
    // true / null / undefined / anything else: default github ids, no prefix
    return { enabled: true, prefix: '', raw: false };
  }

  // Generate a heading's `id` attribute from its text. A mechanism, not a construct, so it
  // is a showdown.helper rather than a registered subparser — but it keeps one event:
  // `makehtml.heading.id.onCapture`, whose `matches.text` is the generated id (mutable and
  // honored, so a listener can implement custom slug generation). It returns an id string
  // (or null when the headerIds option disables ids), not HTML, so there is no lifecycle or
  // onHash phase.
  showdown.helper.headingId = function (m, options, globals) {
    let title;

    let cfg = resolveHeaderIds(options.headerIds);
    // when ids are disabled the caller omits the attribute entirely
    if (!cfg.enabled) {
      return null;
    }

    // Prefix id to prevent causing inadvertent pre-existing style matches.
    title = cfg.prefix + m;

    if (cfg.raw) {
      // minimal sanitization: only spaces, ', ", > and < become dashes (the prefix is
      // included, so it gets the same treatment). WARNING: may produce malformed ids.
      title = title
        .replace(/ /g, '-')
        // replace previously escaped chars (&, ¨ and $)
        .replace(/&amp;/g, '&')
        .replace(/¨T/g, '¨')
        .replace(/¨D/g, '$')
        // replace ", ', > and <
        .replace(/["'><]/g, '-')
        .toLowerCase();
    } else {
      // default: GitHub-compatible ids (spaces become dashes, non-alphanumeric chars
      // are stripped). Borrowed from github's redcarpet so results are similar.
      title = title
        .replace(/ /g, '-')
        // replace previously escaped chars (&, ¨ and $)
        .replace(/&amp;/g, '')
        .replace(/¨T/g, '')
        .replace(/¨D/g, '')
        // replace rest of the chars (&~$ are repeated as they might have been escaped)
        .replace(/[&+$,/:;=?@"#{}|^¨¿？：~[\]`、゠＝…‥『』〝〟「」\\*()｛｝（）［］【】%.。，¡!！'<>]/g, '')
        .toLowerCase();
    }

    // capture hook: the generated id is exposed under matches.text (mutable + honored), so a
    // listener can supply a custom slug. The heading text is read-only context. No regexp and
    // no attributes apply (an id is a bare string, not an HTML fragment). Deduplication runs
    // after the hook so a listener-supplied slug is still made unique within the document.
    let captureEvent = showdown.Event.dispatchCapture('makehtml.heading.id.onCapture', title, {
      regexp: null,
      matches: {
        _wholeMatch: m,
        _headingText: m,
        text: title
      },
      attributes: {}
    }, options, globals);
    title = captureEvent.matches.text;

    if (globals.hashLinkCounts[title]) {
      title = title + '-' + (globals.hashLinkCounts[title]++);
    } else {
      globals.hashLinkCounts[title] = 1;
    }
    return title;
  };

  showdown.subParser('makehtml.heading.setext', function (text, options, globals) {

    let startEvent = showdown.Event.dispatchStart('makehtml.heading.setext.onStart', text, options, globals);
    text = startEvent.output;

    // NOTE: the first line is `[^ \t\n].*` (single leading non-space + rest) rather
    // than `[^ \t\n]+.*`. The latter has two overlapping greedy quantifiers that can
    // consume the same characters, causing O(n^2) backtracking on a long line with no
    // trailing underline (a DoS via any long whitespace-free input). The two forms
    // match the same set of lines and capture the same substring.
    const setextRegexH1 = /^( {0,3}([^ \t\n].*\n)(.+\n)?(.+\n)?)( {0,3}=+[ \t]*)$/gm,
        setextRegexH2 = /^( {0,3}([^ \t\n].*\n)(.+\n)?(.+\n)?)( {0,3}(-+)[ \t]*)$/gm;

    // CommonMark: a setext heading's text is a paragraph, so the line(s) before the
    // underline may not begin another kind of block. Since setext runs before the
    // list/block-quote parsers in blockGamut, a `-` underline would otherwise steal
    // list-item lines (e.g. `- foo\n-`). When commonmarkLists is enabled, skip the
    // match if the heading text starts a list item or block quote; the container
    // parsers then handle those lines (and any genuine underline inside an item).
    function cmSkipSetext (headingText) {
      let first = headingText.split('\n')[0];
      return /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/.test(first) ||
             /^ {0,3}>/.test(first) ||
             // a fenced-code opener is a leaf block, not setext paragraph text. In container
             // mode the converter-level fence pass leaves indent 1-3 fences for the block
             // parsers, so they can reach setext here; let the fence (and any container
             // marker below it) be claimed by the block/container parsers instead.
             /^ {0,3}(?:```|~~~)/.test(first);
    }

    text = text.replace(setextRegexH1, function (wholeMatch, headingText, line1, line2, line3, line4) {
      if (options.cmSpec && cmSkipSetext(headingText)) { return wholeMatch; }
      return parseSetextHeading(setextRegexH2, options.headerLevelStart, wholeMatch, headingText, line1, line2, line3, line4);
    });

    text = text.replace(setextRegexH2, function (wholeMatch, headingText, line1, line2, line3, line4) {
      if (options.cmSpec && cmSkipSetext(headingText)) { return wholeMatch; }
      return parseSetextHeading(setextRegexH2, options.headerLevelStart + 1, wholeMatch, headingText, line1, line2, line3, line4);
    });

    let afterEvent = showdown.Event.dispatchEnd('makehtml.heading.setext.onEnd', text, options, globals);

    return showdown.helper.hashHTMLBlocks(afterEvent.output, options, globals);


    function parseSetextHeading (pattern, headingLevel, wholeMatch, headingText, line1, line2, line3, line4) {

      // count lines
      let count = headingText.trim().split('\n').length;
      let prepend = '';
      let nPrepend;
      const hrCheckRgx = /^ {0,3}[-_*]([-_*] ?){2,}$/;

      // one liner edge cases
      if (count === 1) {
        // hr
        // let's find the hr edge case first
        if (showdown.helper.trimEnd(line1).match(hrCheckRgx)) {
          // it's the edge case, so it's a false positive
          prepend = showdown.subParser('makehtml.horizontalRule')(line1, options, globals);
          if (prepend !== line1) {
            // it's an oneliner list
            return prepend.trim() + '\n' + line4;
          }
        }

        // now check if it's an unordered list
        if (line1.match(/^ {0,3}[-*+][ \t]/)) {
          if (line4.trim().match(/^=+/)) {
            line1 += line4;
          }
          prepend = showdown.subParser('makehtml.list')(line1, options, globals);
          if (prepend !== line1) {
            // it's an oneliner list
            return prepend.trim() + '\n' + line4;
          }
        }

        // check if it's a blockquote
        if (line1.match(/^ {0,3}>[ \t]?[^ \t]/)) {
          if (line4.trim().match(/^=+/)) {
            line1 += line4;
          }
          prepend = showdown.subParser('makehtml.blockquote')(line1, options, globals);
          if (prepend !== line1) {
            // it's an oneliner blockquote
            return prepend.trim() + '\n' + line4;
          }
        }

        // no edge case let's proceed as usual
      } else {
        let multilineText;

        // multiline is a bit trickier
        // first we must take care of the edge cases of:
        // case1: |  case2:
        // ---    |  ---
        // foo    |  foo
        // ---    |  bar
        //        |  ---
        //
        if (showdown.helper.trimEnd(line1).match(hrCheckRgx)) {
          nPrepend  = showdown.subParser('makehtml.horizontalRule')(line1, options, globals);
          if (nPrepend !== line1) {
            line1 = '';
            // we add the parsed block to prepend
            prepend = nPrepend.trim();
            // and remove the line from the headingText, so it doesn't appear repeated
            headingText = line2 + ((line3) ? line3 : '');
          }
        }

        // now we take care of these cases:
        // case1: |  case2:
        // foo    |  foo
        // ***    |  ***
        // ---    |  bar
        //        |  ---
        //
        if (showdown.helper.trimEnd(line2).match(hrCheckRgx)) {
          // This case sucks, because the first line could be anything!!!
          // first let's make sure it's a hr
          nPrepend  = showdown.subParser('makehtml.horizontalRule')(line2, options, globals);
          if (nPrepend !== line2) {
            line2 = nPrepend;
            // it is, so now we must parse line1 also
            if (line1) {
              line1 = showdown.subParser('makehtml.blockGamut')(line1, options, globals);
              line1 = showdown.subParser('makehtml.paragraphs')(line1, options, globals);
              line1 = line1.trim() + '\n';
              prepend = line1;
              // and clear line1
              line1 = '';
            }
            // we add the parsed blocks to prepend
            prepend += line2.trim() + '\n';
            line2 = '';
            // and remove the lines from the headingText, so it doesn't appear repeated
            headingText = (line3) ? line3 : '';
          }
        }

        // all edge cases should be treated now
        multilineText = line1 + line2 + ((line3) ? line3 : '');
        //if (line4.trim().match(/^=+/)) {
        //  multilineText += line4;
        //}

        nPrepend = showdown.subParser('makehtml.blockGamut')(multilineText, options, globals, 'makehtml.heading.setext');
        if (nPrepend !== multilineText) {
          // we found one or more blocks, so we need to reparse (blocks should take precendence though)
          nPrepend = showdown.helper.trimEnd(nPrepend);
          // let's check if the last line is a parsed block
          let newLines = nPrepend.trim().split('\n');
          let nLastLine = newLines.pop().toString();

          if (/^¨K\d+K$/.test(nLastLine) || /^\s*$/gm.test(nLastLine)) {
            // everything before --- or === is a block or empty line, so it's a false positive
            prepend += nPrepend + '\n\n';
            headingText = '';
          } else {
            // the last line is something else... so let's look at the line before that
            let toHeading = nLastLine;
            nLastLine = newLines.pop().toString();
            if (/^¨K\d+K$/.test(nLastLine) === false && /^\s*$/gm.test(nLastLine) === false) {
              toHeading = nLastLine + '\n' + toHeading;
            }
            headingText = toHeading;
            prepend = newLines.join('\n').trim();
          }
        }
      }

      // trim stuff
      headingText = headingText.trim();

      // let's check if heading is empty
      // after looking for blocks, heading text might be empty which is a false positive
      if (!headingText) {
        return prepend + line4;
      }

      // after this, we're pretty sure it's a heading so let's proceed
      // (the id helper returns null when the headerIds option disables ids)
      let id = showdown.helper.headingId(headingText, options, globals);
      return prepend + parseHeader('setext', pattern, wholeMatch, headingText, headingLevel, id, options, globals);
    }


  });

  // Strip a trailing ATX closing sequence — `[ \t]*#*[ \t]*` — from a heading's text, computed
  // right-to-left in linear time (a regex `/[ \t]*#*[ \t]*$/` would itself backtrack quadratically
  // while searching for the match position). If the whole text is strippable (e.g. `# ###`), the
  // legacy lazy regex kept the first character, so we do the same.
  function stripAtxClosingSequence (str) {
    let end = str.length;
    while (end > 0 && (str.charAt(end - 1) === ' ' || str.charAt(end - 1) === '\t')) { end--; }
    while (end > 0 && str.charAt(end - 1) === '#') { end--; }
    while (end > 0 && (str.charAt(end - 1) === ' ' || str.charAt(end - 1) === '\t')) { end--; }
    let stripped = str.slice(0, end);
    return stripped === '' ? str.charAt(0) : stripped;
  }

  showdown.subParser('makehtml.heading.atx', function (text, options, globals) {

    let startEvent = showdown.Event.dispatchStart('makehtml.heading.atx.onStart', text, options, globals);
    text = startEvent.output;

    // The default variant captures the heading text greedily (`(.+)$`) and strips the optional
    // trailing closing-hash sequence (of ANY length, per CommonMark) in code below. The old
    // `(.+?)[ \t]*#*[ \t]*$` form backtracked quadratically on a line of many `#` followed by
    // text (e.g. `'#'.repeat(n) + ' h'`), because the lazy text capture re-scanned the `#` run
    // at every position. The cmSpec variant already can't backtrack that way (its `[ \t]+`
    // after the opening hashes fails fast on a pure/`#`-prefixed line), so it is left unchanged.
    // cmSpec (CommonMark) requires a space between the opening `#`s and the heading text; the
    // legacy path does not.
    const atxRegex = (options.cmSpec) ? /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm : /^ {0,3}(#{1,6})[ \t]*(.+)$/gm;
    const stripClosing = !options.cmSpec;
    text = text.replace(atxRegex, function (wholeMatch, m1, m2) {
      let headingText = stripClosing ? stripAtxClosingSequence(m2) : m2,
          headingLevel = options.headerLevelStart - 1 + m1.length,
          // the id helper returns null when the headerIds option disables ids
          id = showdown.helper.headingId(headingText, options, globals);
      return parseHeader('atx', atxRegex, wholeMatch, headingText, headingLevel, id, options, globals);
    });

    let afterEvent = showdown.Event.dispatchEnd('makehtml.heading.atx.onEnd', text, options, globals);

    return showdown.helper.hashHTMLBlocks(afterEvent.output, options, globals);

  });

})();
