/**
 * @file      makehtml/link.js
 * @summary   Converts Markdown links (inline, reference, autolinks) into `<a>` anchors.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Handles reference-style, inline (with a cmSpec balanced-paren path), angle-bracket and GFM
 * auto-links; short-circuits when no `]` is present and uses bracket-aware sub-patterns to stay
 * linear (ReDoS guards). Emits capture events per type — `.inline`/`.reference`/`.angleBrackets`/
 * `.autoLink` — exposing the anchor `attributes` (the documented hook for `target`/`rel`).
 */

showdown.subParser('makehtml.link', function (text, options, globals) {

  //
  // Parser starts here
  //
  let startEvent = showdown.Event.dispatchStart('makehtml.link.onStart', text, options, globals);
  text = startEvent.output;

  // Every markdown link/reference syntax requires a closing ']'. When there is none there is
  // nothing for the (backtracking-prone) reference/inline passes to match, so skip them. This
  // also neutralizes pathological inputs such as '['.repeat(n), which would otherwise cost
  // O(n^2) as each pass scans forward for a ']' that never appears. Autolinks (< >) below do
  // not need ']', so they stay outside this guard.
  if (text.indexOf(']') !== -1) {
  // 1. Handle reference-style links: [link text] [id]
    // The label sub-pattern excludes `[` from the inner negated class (`[^\][]` not `[^\]]`) so a
    // scan for the label's closing `]` cannot run across the `[` that starts the *next* bracket
    // group. This keeps matching linear on inputs like `'[^'.repeat(n) + ' ]'` (which contain a
    // stray `]` that defeats the earlier "no `]` at all" fast-path) without changing results.
    let referenceRegex = /\[((?:\[[^\][]*]|[^[\]])*)] ?(?:\n *)?\[(.*?)]/g;
    text = text.replace(referenceRegex, function (wholeMatch, text, linkId) {
    // bail if we find 2 newlines somewhere
      if (/\n\n/.test(wholeMatch)) {
        return wholeMatch;
      }
      return writeAnchorTag ('reference', referenceRegex, wholeMatch, text, linkId);
    });

    // 2. Handle inline-style links: [link text](url "optional title")
    if (options.cmSpec) {
    // CommonMark inline-link parsing: a manual scanner that handles balanced-paren
    // and `<...>` destinations, titles in "...", '...' or (...), and backslash escapes.
      text = parseCmInlineLinks(text);
    } else if (text.indexOf(')') !== -1) {
    // Every legacy inline-link syntax ends in ')'. Without one there is nothing to match, so
    // skip these passes — this neutralizes pathological inputs like '[a](' + 'a('.repeat(n),
    // whose destination scan would otherwise backtrack quadratically looking for a ')'.
    // 2.1. Look for empty cases: []() and [empty]() and []("title")
      // The link text and title captures exclude their own delimiters (`[^\]]*?` / `[^"']*`)
      // rather than the unbounded `.*?` / `.*`. Run as the first inline pass over raw text, the
      // old form re-scanned O(n) chars from every `[` on balanced nested input like
      // `'[x]('.repeat(n) + 'u' + ')'.repeat(n)`, giving O(n^2). This mirrors the bounding already
      // applied to the sibling inline/image regexes (the image parser likewise disallows `]` in alt).
      let inlineEmptyRegex = /\[([^\]]*?)]\(<? ?>? ?(["']([^"']*)["'])?\)/g;
      text = text.replace(inlineEmptyRegex, function (wholeMatch, text, m1, title) {
        return writeAnchorTag ('inline', inlineEmptyRegex, wholeMatch, text, null, null, title, true);
      });

      // 2.2. Look for cases with crazy urls like ./image/cat1).png
      // the url mus be enclosed in <>
      let inlineCrazyRegex = /\[((?:\[[^\][]*]|[^[\]])*)]\s?\([ \t]?<([^>]*)>(?:[ \t]*((["'])([^"]*?)\4))?[ \t]?\)/g;
      text = text.replace(inlineCrazyRegex, function (wholeMatch, text, url, m1, m2, title) {
        return writeAnchorTag ('inline', inlineCrazyRegex, wholeMatch, text, null, url, title);
      });

      // 2.3. inline links with no title or titles wrapped in ' or ":
      // [text](url.com) || [text](<url.com>) || [text](url.com "title") || [text](<url.com> "title")
      let inlineNormalRegex1 = /\[([\S ]*?)]\s?\( *<?([^\s'"]*?(?:\(\S{0,200}?\)\S{0,200}?)?)>?\s*(?:(['"])(.*?)\3)? *\)/g;
      text = text.replace(inlineNormalRegex1, function (wholeMatch, text, url, m1, title) {
        return writeAnchorTag ('inline', inlineNormalRegex1, wholeMatch, text, null, url, title);
      });

      // 2.4. inline links with titles wrapped in (): [foo](bar.com (title))
      let inlineNormalRegex2 = /\[([\S ]*?)]\s?\( *<?([^\s'"]*?(?:\(\S{0,200}?\)\S{0,200}?)?)>?\s+\((.*?)\) *\)/g;
      text = text.replace(inlineNormalRegex2, function (wholeMatch, text, url, title) {
        return writeAnchorTag ('inline', inlineNormalRegex2, wholeMatch, text, null, url, title);
      });
    }


    // 3. Handle reference-style shortcuts: [link text]
    // These must come last in case there's a [link text][1] or [link text](/foo)
    let referenceShortcutRegex = /\[([^[\]]+)]/g;
    text = text.replace(referenceShortcutRegex, function (wholeMatch, text) {
      return writeAnchorTag ('reference', referenceShortcutRegex, wholeMatch, text);
    });
  }

  // 4. Handle angle brackets links -> `<http://example.com/>`
  // Must come after links, because you can use < and > delimiters in inline links like [this](<url>).

  if (options.cmSpec) {
    // CommonMark autolinks: any scheme (2-32 chars) URI, and emails, with no entity encoding.
    // 4.1. URI autolinks: <scheme:rest>
    // eslint-disable-next-line no-control-regex -- CommonMark autolinks exclude control chars (\x00-\x20) per spec
    let cmUriAutolinkRegex = /<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\x00-\x20]*)>/g;
    text = text.replace(cmUriAutolinkRegex, function (wholeMatch, uri) {
      // backslash escapes do not work inside autolinks, so restore them to literal backslash + char
      let raw = showdown.helper.unescapePlaceholders(showdown.helper.backslashEscapePlaceholders(uri));
      // safeMode: neutralize dangerous autolink schemes but keep the visible text
      let href = (options.safeMode && !showdown.helper.isSafeUrl(raw)) ? '' : showdown.helper.escapeHTMLEntities(showdown.helper.cmEncodeURI(raw));
      let otp = '<a href="' + href + '">' + showdown.helper.escapeHTMLEntities(raw) + '</a>';
      return showdown.helper.hashHTMLSpans(otp, options, globals);
    });

    // 4.2. Email autolinks: <foo@bar.example.com>
    let cmEmailAutolinkRegex = /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/g;
    text = text.replace(cmEmailAutolinkRegex, function (wholeMatch, email) {
      let raw = showdown.helper.unescapePlaceholders(showdown.helper.backslashEscapePlaceholders(email));
      let otp = '<a href="' + showdown.helper.escapeHTMLEntities('mailto:' + raw) + '">' + showdown.helper.escapeHTMLEntities(raw) + '</a>';
      return showdown.helper.hashHTMLSpans(otp, options, globals);
    });

  } else {
    // 4.1. Handle links first
    let angleBracketsLinksRegex = /<(((?:https?|ftp):\/\/|www\.)[^'">\s]+)>/gi;
    text = text.replace(angleBracketsLinksRegex, function (wholeMatch, url, urlStart) {

      // backslash escaped characters do not work inside autolinks (according to commonmark spec... sure)
      // so let's unescape them (and add a backslash html entity before)
      url = showdown.helper.backslashEscapePlaceholders(url);
      url = showdown.helper.unescapePlaceholders(url);
      let text = url;

      // now let's replace some entities which should be properly url encoded
      url = showdown.helper.urlASCIIEncoding(url);

      // noinspection HttpUrlsUsage
      url = (urlStart === 'www.') ? (options.httpsAutoLinks ? 'https://' : 'http://') + url : url;
      return writeAnchorTag ('angleBrackets', angleBracketsLinksRegex, wholeMatch, text, null, url);
    });

    // 4.2. Then mail adresses
    let angleBracketsMailRegex = /<(?:mailto:)?([-.\w]+@[-a-z\d]+(\.[-a-z\d]+)*\.[a-z]+)>/gi;
    text = text.replace(angleBracketsMailRegex, function (wholeMatch, mail) {
      const m = parseMail(mail);
      return writeAnchorTag ('angleBrackets', angleBracketsMailRegex, wholeMatch, m.mail, null, m.url);
    });
  }

  // 5. Handle GithubMentions (if option is enabled)
  text = showdown.helper.applyGhMentions(text, options, globals, showdown.helper.LEGACY_ANCHOR_URL_POLICY);

  // 6 and 7 have to come here to prevent naked links to catch html
  // 6. Handle <a> tags
  text = text.replace(/<a\s[^>]*>[\s\S]*<\/a>/g, function (wholeMatch) {
    return showdown.helper._hashHTMLSpan(wholeMatch, globals);
  });

  // 7. Handle <img> tags
  text = text.replace(/<img\s[^>]*\/?>/g, function (wholeMatch) {
    return showdown.helper._hashHTMLSpan(wholeMatch, globals);
  });

  // 8. Handle naked links (if option is enabled)
  if (options.simplifiedAutoLink) {
    // 8.1. Check for naked URLs
    // we also include leading markdown magic chars [_*~] for cases like __https://www.google.com/foobar__
    let nakedUrlRegex = /([_*~]*?)(((?:https?|ftp):\/\/|www\.)[^\s<>"'`´.-][^\s<>"'`´]*?\.[a-z\d.]+[^\s<>"']*)\1/gi;
    text = text.replace(nakedUrlRegex, function (wholeMatch, leadingMDChars, url, urlPrefix) {
      // trim trailing punctuation / unbalanced brackets off the URL into a suffix
      let trimmed = showdown.helper.trimUrlPunctuation(url);
      url = trimmed.url;
      let suffix = trimmed.suffix;

      // we copy the treated url to the text variable
      let txt = url;
      // finally, if it's a www shortcut, we prepend http(s)
      // noinspection HttpUrlsUsage
      url = (urlPrefix === 'www.') ? (options.httpsAutoLinks ? 'https://' : 'http://') + url : url;

      // url part is done so let's take care of text now
      // we need to escape the text (because of links such as www.example.com/foo__bar__baz)
      txt = txt.replace(showdown.helper.regexes.asteriskDashTildeAndColon, showdown.helper.escapeCharactersCallback);

      // and return the link tag, with the leadingMDChars and  suffix. The leadingMDChars are added at the end too because
      // we consumed those characters in the regexp
      return leadingMDChars +
        writeAnchorTag ('autoLink', nakedUrlRegex, wholeMatch, txt, null, url) +
        suffix +
        leadingMDChars;
    });

    // 8.2. Now check for naked mail
    let nakedMailRegex = /(^|\s)(?:mailto:)?([A-Za-z\d!#$%&'*+-/=?^_`{|}~.]+@[-a-z\d]+(\.[-a-z\d]+)*\.[a-z]+)(?=$|\s)/gmi;
    text = text.replace(nakedMailRegex, function (wholeMatch, leadingChar, mail) {
      const m = parseMail(mail);
      return leadingChar + writeAnchorTag ('autoLink', nakedMailRegex, wholeMatch, m.mail, null, m.url);
    });
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.link.onEnd', text, options, globals);
  return afterEvent.output;



  /**
   * CommonMark inline-link scanner. Finds `[label](destination "title")` spans,
   * parsing the destination and title with a hand-written cursor so that balanced
   * parentheses, `<...>` destinations, the three title delimiters and backslash
   * escapes are handled per the spec. Anything that does not parse as a valid
   * inline link is left untouched (to be handled by the reference/shortcut passes).
   * @param {string} str
   * @returns {string}
   */
  function parseCmInlineLinks (str) {
    let inlineLinkRegexp = /\[[\s\S]*?]\([\s\S]*?\)/, // representative pattern (for event metadata only)
        n = str.length,
        out = '',
        last = 0,
        i = 0;
    while (i < n) {
      if (str.charAt(i) !== '[') { i++; continue; }
      // find the matching `]`, counting nested brackets and honoring backslash escapes
      let depth = 1, k = i + 1, labelEnd = -1;
      while (k < n) {
        let c = str.charAt(k);
        if (c === '\\' && k + 1 < n) { k += 2; continue; }
        if (c === '[') { depth++; } else if (c === ']') {
          depth--;
          if (depth === 0) { labelEnd = k; break; }
        }
        k++;
      }
      if (labelEnd !== -1 && str.charAt(labelEnd + 1) === '(') {
        let parsed = parseCmDestTitle(str, labelEnd + 2);
        if (parsed) {
          let label = str.slice(i + 1, labelEnd);
          out += str.slice(last, i);
          out += writeAnchorTag('inline', inlineLinkRegexp, str.slice(i, parsed.end + 1), label, null, parsed.url, parsed.title, parsed.emptyCase);
          i = parsed.end + 1;
          last = i;
          continue;
        }
      }
      // not a valid inline link here; advance past this `[` so a nested `[...]( )`
      // still gets a chance to match
      i++;
    }
    out += str.slice(last);
    return out;
  }

  /**
   * Parse a CommonMark link destination and optional title starting just after the
   * opening `(`. Returns `{url, title, emptyCase, end}` where `end` is the index of
   * the closing `)`, or `null` if the span is not a valid destination/title.
   * @param {string} str
   * @param {number} j index right after the opening `(`
   * @returns {{url: string, title: (string|null), emptyCase: boolean, end: number}|null}
   */
  function parseCmDestTitle (str, j) {
    let n = str.length,
        isWs = function (c) { return c === ' ' || c === '\t' || c === '\n'; },
        url,
        emptyCase = false;

    // optional leading whitespace
    while (j < n && isWs(str.charAt(j))) { j++; }

    if (str.charAt(j) === '<') {
      // angle-bracket destination: up to an unescaped `>`, no raw newline or `<`
      j++;
      let buf = '';
      while (j < n && str.charAt(j) !== '>') {
        let c = str.charAt(j);
        if (c === '\n' || c === '<') { return null; }
        if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
        buf += c; j++;
      }
      if (j >= n || str.charAt(j) !== '>') { return null; }
      j++; // consume `>`
      url = buf;
      if (url === '') { emptyCase = true; }
    } else {
      // bare destination: balanced parentheses, ends at whitespace or an unbalanced `)`
      let depth = 0, buf = '';
      while (j < n) {
        let c = str.charAt(j);
        if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
        if (isWs(c)) { break; }
        if (c === '(') { depth++; buf += c; j++; continue; }
        if (c === ')') {
          if (depth === 0) { break; }
          depth--; buf += c; j++; continue;
        }
        buf += c; j++;
      }
      if (depth !== 0) { return null; } // unbalanced parens -> not a link
      url = buf;
      if (url === '') { emptyCase = true; }
    }

    // optional whitespace separating destination and title
    let hadWs = false;
    while (j < n && isWs(str.charAt(j))) { hadWs = true; j++; }

    let title = null,
        tc = str.charAt(j);
    if (j < n && (tc === '"' || tc === '\'' || tc === '(')) {
      // a title must be separated from the destination by whitespace
      if (!hadWs) { return null; }
      let close = (tc === '(') ? ')' : tc,
          buf = '';
      j++;
      let closed = false;
      while (j < n) {
        let c = str.charAt(j);
        if (c === '\\' && j + 1 < n) { buf += c + str.charAt(j + 1); j += 2; continue; }
        if (tc === '(' && c === '(') { return null; } // unescaped `(` invalid in (...) title
        if (c === close) { closed = true; j++; break; }
        buf += c; j++;
      }
      if (!closed) { return null; }
      title = buf;
    }

    // optional trailing whitespace, then the required closing `)`
    while (j < n && isWs(str.charAt(j))) { j++; }
    if (j >= n || str.charAt(j) !== ')') { return null; }
    return {url: url, title: title, emptyCase: emptyCase, end: j};
  }

  // Legacy anchor builder + mail parser: thin wrappers over the shared GFM anchor machinery
  // (showdown.helper.writeAnchorTag / parseMail), pinning this path's href policy (safeMode +
  // cmNormalizeURL + attribute escape all on).
  function writeAnchorTag (subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase) {
    return showdown.helper.writeAnchorTag(subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase,
      options, globals, showdown.helper.LEGACY_ANCHOR_URL_POLICY);
  }

  function parseMail (mail) {
    return showdown.helper.parseMail(mail, options);
  }
});
