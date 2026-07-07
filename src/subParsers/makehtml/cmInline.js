/**
 * @file      makehtml/cmInline.js
 * @summary   Unified CommonMark inline parser (spec §6).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Invoked only when the `commonmarkInline` option is enabled. Resolves code spans, backslash
 * escapes, character references, autolinks, raw HTML, links, images and emphasis together on a
 * single delimiter stack, so the cross-construct precedence rules CommonMark requires — a link
 * cannot contain a link; code spans / autolinks / raw HTML bind before links; emphasis interleaves
 * with link brackets — are expressible, which the sequential per-construct passes could not.
 *
 * Built on the same doubly-linked node list + delimiter stack + processEmphasis design used by
 * makehtml.emphasisAndStrong's CommonMark path.
 */

/* jshint esnext: false, esversion: 9 */

showdown.subParser('makehtml.cmInline', function (text, options, globals) {
  'use strict';

  // Sticky regexes anchored at the scan cursor (lastIndex) so the recognizers never
  // slice the tail of the string - keeps the tokenizer linear on `<`/`&`-heavy input.
  // Reused across calls; each recognizer sets lastIndex before exec and the parse is
  // not re-entrant within a single string.
  const reEntity = /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]*);/y;
  // eslint-disable-next-line no-control-regex -- CommonMark autolinks exclude control chars (\x00-\x20) per spec
  const reAutoUri = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\x00-\x20]*>/y;
  // Showdown extension: <www...> angle autolinks (cmark-gfm does not autolink these, but the
  // explicit <> is unambiguous user intent). Single variable class → linear / ReDoS-safe.
  // eslint-disable-next-line no-control-regex -- same control-char exclusion as reAutoUri
  const reAutoWww = /<www\.[^<>\x00-\x20]+>/y;
  const reAutoEmail = /<[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*>/y;
  const reRawHtml = new RegExp('(?:' + showdown.helper.regexes.cmHTMLTagSource + ')', 'y');

  let startEvent = showdown.Event.dispatchStart('makehtml.cmInline.onStart', text, options, globals);
  text = startEvent.output;

  text = parseCmInline(text);

  // ghMentions and simplifiedAutoLink (GFM extensions) are applied to the serialized
  // inline output and to emphasis inner content (see parseCmInline) so URLs and mentions
  // inside emphasis are linked too. Real links, images and code spans are hashed by
  // parseCmInline, so they are protected from these regexes. The anchor emission (ghMentions,
  // writeAnchorTag, parseMail, the naked-URL trim loop) is shared with link.js via
  // showdown.helper.* — the GFM naked-URL/mail extras below are the CommonMark-only additions.
  text = applyGfmInlineLinks(text);

  function applyGfmInlineLinks (text) {
    // 5. Handle GithubMentions (if option is enabled)
    text = showdown.helper.applyGhMentions(text, options, globals, showdown.helper.CM_GFM_ANCHOR_URL_POLICY);

    // 8. Handle naked links (if option is enabled)
    if (options.simplifiedAutoLink) {
      // 8.1. Check for naked URLs
      // we also include leading markdown magic chars [_*~] for cases like __https://www.google.com/foobar__
      // An explicit scheme (http/https/ftp) does not require the host to contain a dot;
      // a `www.` shortcut does (and is domain-validated below).
      let nakedUrlRegex = /([_*~]*?)((?:(?:https?|ftp):\/\/[^\s<>"'`´]+|www\.[^\s<>"'`´.-][^\s<>"'`´]*?\.[a-z\d.]+[^\s<>"']*))\1/gi;
      text = text.replace(nakedUrlRegex, function (wholeMatch, leadingMDChars, url, offset, fullText) {
        let isWww = /^www\./i.test(url);
        // GFM boundary rule: a "www." autolink (unlike a scheme URL) is not recognized when
        // preceded by "<". By this pass "<" has been escaped to "&lt;", so a www match sitting
        // right after it (e.g. the interior of a malformed <www.x.com foo> the angle recognizer
        // could not consume) is left untouched — matching cmark-gfm, which links <https://x bim>
        // but not <www.x bim>.
        let urlStart = offset + leadingMDChars.length;
        if (isWww && fullText.substring(urlStart - 4, urlStart) === '&lt;') { return wholeMatch; }
        // trim trailing punctuation / unbalanced brackets off the URL into a suffix (shared
        // with link.js); the GFM-specific trimming below is layered on top.
        let trimmed = showdown.helper.trimUrlPunctuation(url);
        url = trimmed.url;
        let suffix = trimmed.suffix;

        // GFM: a trailing ";" that completes an entity-reference-like "&name" is excluded
        // from the link, so move the whole "&name;" into the suffix.
        if (suffix.charAt(0) === ';') {
          let entity = url.match(/&(?:amp;)?[a-z\d]+$/i);
          if (entity) {
            url = url.slice(0, -entity[0].length);
            suffix = entity[0] + suffix;
          }
        }

        // GFM: "<" terminates the link. By this pass it has already been escaped to "&lt;"
        // (and ">" to "&gt;"), so split there and keep the remainder as plain text.
        let ltMatch = url.match(/&(?:lt|gt);/);
        if (ltMatch) {
          let at = url.indexOf(ltMatch[0]);
          suffix = url.slice(at) + suffix;
          url = url.slice(0, at);
        }

        // GFM: the last two labels of the host may not contain "_"; otherwise it is not a
        // valid autolink.
        if (!validAutolinkHost(url, isWww)) {
          return wholeMatch;
        }

        // we copy the treated url to the text variable
        let txt = url;
        // finally, if it's a www shortcut, we prepend http(s)
        // noinspection HttpUrlsUsage
        url = isWww ? (options.httpsAutoLinks ? 'https://' : 'http://') + url : url;
        // GFM: percent-encode non-ASCII characters in the href (the display text keeps the
        // literal characters)
        // eslint-disable-next-line no-control-regex -- \x00-\x7F is the ASCII range
        url = url.replace(/[^\x00-\x7F]+/g, function (s) { return encodeURI(s); });

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

      // 8.2. Check for naked mail (GFM extended email autolink).
      let localPart = '[A-Za-z\\d._+-]+',
          domainPart = '[A-Za-z\\d_-]+(?:\\.[A-Za-z\\d_-]+)*';

      // A scheme is only recognised when it is not part of a preceding word (so `mmmmailto:`
      // does not count) — any non-alphanumeric character (including `/`) is a valid boundary.
      let schemeBoundary = '(^|[^A-Za-z\\d])';

      // 8.2.1. `xmpp:` addresses keep their scheme and an optional `/resource`.
      let xmppMailRegex = new RegExp(schemeBoundary + '(xmpp:)(' + localPart + '@' + domainPart + ')(\\/[A-Za-z\\d._-]*)?', 'gi');
      text = text.replace(xmppMailRegex, function (wholeMatch, lead, scheme, addr, resource) {
        resource = resource || '';
        let trail = '',
            body = resource || addr;
        while (/[.,;:!?]$/.test(body)) {
          trail = body.slice(-1) + trail;
          body = body.slice(0, -1);
        }
        if (resource) { resource = body; } else { addr = body; }
        if (!validMailAddr(addr)) { return wholeMatch; }
        let target = 'xmpp:' + addr + resource;
        return lead + writeAnchorTag ('autoLink', xmppMailRegex, wholeMatch, target, null, target) + trail;
      });

      // 8.2.2. `mailto:` addresses keep their scheme but never carry a path.
      let mailtoRegex = new RegExp(schemeBoundary + '(mailto:)(' + localPart + '@' + domainPart + ')', 'gi');
      text = text.replace(mailtoRegex, function (wholeMatch, lead, scheme, addr) {
        let trail = '';
        while (/[.,;:!?]$/.test(addr)) {
          trail = addr.slice(-1) + trail;
          addr = addr.slice(0, -1);
        }
        if (!validMailAddr(addr)) { return wholeMatch; }
        let target = 'mailto:' + addr;
        return lead + writeAnchorTag ('autoLink', mailtoRegex, wholeMatch, target, null, target) + trail;
      });

      // 8.2.3. Bare addresses become mailto: links. The address must be preceded by the
      // string start or a character that cannot be part of the local-part (this also keeps
      // us out of hash placeholders like the `¨E43E` produced for an escaped char).
      let nakedMailRegex = new RegExp('(^|[^A-Za-z\\d._+\\-\\u00a8])(' + localPart + '@' + domainPart + ')', 'g');
      text = text.replace(nakedMailRegex, function (wholeMatch, lead, addr) {
        if (!validMailAddr(addr)) { return wholeMatch; }
        const m = parseMail(addr);
        return lead + writeAnchorTag ('autoLink', nakedMailRegex, wholeMatch, m.mail, null, m.url);
      });
    }
    return text;
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.cmInline.onEnd', text, options, globals);
  return afterEvent.output;

  // ---- shared character helpers ------------------------------------------------
  // The CommonMark flanking classifiers (isPunct/isWhitespace) live on the shared
  // delimiter-stack engine now; this path only needs the ASCII-punctuation test for
  // deciding which backslash escapes are meaningful.

  function isEscapable (ch) {
    return showdown.helper.isAsciiPunct(ch);
  }

  function hashSpan (html) {
    return showdown.helper._hashHTMLSpan(html, globals);
  }

  // resolve backslash escapes of ASCII punctuation to the literal character
  function resolveBackslash (str) {
    return str.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  }

  // ---- main parse --------------------------------------------------------------

  function parseCmInline (str) {
    // The doubly-linked node list + emphasis delimiter stack live on the shared engine
    // (showdown.helper.DelimiterStack); the bracket (link/image) stack and backtick memo
    // are specific to this unified parser and stay local.
    let stack = new showdown.helper.DelimiterStack(),
        brackets = null,   // top of bracket (link/image) stack
        // backtick runs of these lengths have no closer in the rest of the string;
        // future opens of the same length fail immediately (keeps backticks linear)
        backtickNoCloser = {};

    function appendText (literal) {
      return stack.appendText(literal);
    }
    // append already-final HTML that must not be escaped at render time
    function appendRaw (html) {
      return stack.appendRaw(html);
    }
    // render one node: raw nodes emit verbatim, text nodes are HTML-escaped
    function renderNode (n) {
      return n.raw ? n.literal : showdown.helper.escapeHTMLEntities(n.literal);
    }

    const len = str.length;
    let i = 0;
    while (i < len) {
      let ch = str.charAt(i);

      if (ch === '\n') {
        // hard line break: two+ trailing spaces or a backslash before the newline.
        // The <br /> is hashed so the later encodeAmpsAndAngles pass leaves it intact.
        let n = stack.tail;
        if (n && n.type === 'text' && !n.raw && / {2,}$/.test(n.literal)) {
          n.literal = n.literal.replace(/ +$/, '');
          appendRaw(hashSpan('<br />') + '\n');
        } else if (n && n.type === 'text' && !n.raw && /\\$/.test(n.literal)) {
          n.literal = n.literal.slice(0, -1);
          appendRaw(hashSpan('<br />') + '\n');
        } else {
          if (n && n.type === 'text' && !n.raw) { n.literal = n.literal.replace(/ +$/, ''); }
          appendText('\n');
        }
        i++;
        continue;
      }

      if (ch === '\\') {
        let next = str.charAt(i + 1);
        if (next === '\n') {
          appendRaw(hashSpan('<br />') + '\n');
          i += 2;
        } else if (next === '¨' && str.charAt(i + 2) === 'D') {
          // escaped `$` (the converter hashes `$` to the `¨D` placeholder early)
          appendText('¨D');
          i += 3;
        } else if (isEscapable(next)) {
          // Emit ordinary escaped punctuation as a Showdown escape placeholder (¨E<code>E)
          // so the later passes (ghMentions, simplifiedAutoLink, emoji, strikethrough,
          // ellipsis, ...) don't treat the char as markup - e.g. `\@user` must not become a
          // mention. unescapeSpecialChars restores the literal char at the end of the
          // pipeline. HTML-special chars stay literal so the render-time escape
          // (showdown.helper.escapeHTMLEntities) turns them into entities
          // (&amp; &lt; &gt; &quot;); placeholders would otherwise round-trip to raw `<`/`&`.
          if (next === '&' || next === '<' || next === '>' || next === '"') {
            appendText(next);
          } else {
            appendText(showdown.helper.escapePlaceholder(next));
          }
          i += 2;
        } else {
          appendText('\\');
          i++;
        }
        continue;
      }

      if (ch === '`') {
        let res = parseBacktick(str, i, backtickNoCloser);
        if (res) {
          appendRaw(res.html); i = res.end;
        } else {
          let e = skipRun(str, i, '`'); appendText(str.slice(i, e)); i = e;
        }
        continue;
      }

      if (ch === '<') {
        let res = parseAutolink(str, i) || parseRawHTML(str, i);
        if (res) { appendRaw(res.html); i = res.end; continue; }
        appendText('<');
        i++;
        continue;
      }

      if (ch === '&') {
        reEntity.lastIndex = i;
        let m = reEntity.exec(str);
        if (m) {
          let decoded = showdown.helper.cmDecodeEntities(m[0]);
          if (decoded !== m[0]) { appendText(decoded); i += m[0].length; continue; }
        }
        appendText('&');
        i++;
        continue;
      }

      if (ch === '!' && str.charAt(i + 1) === '[') {
        let node = appendText('![');
        pushBracket(node, true, i + 2, i);
        i += 2;
        continue;
      }
      if (ch === '[') {
        let node = appendText('[');
        pushBracket(node, false, i + 1, i);
        i++;
        continue;
      }
      if (ch === ']') {
        i = parseCloseBracket(str, i);
        continue;
      }

      if (ch === '*' || ch === '_') {
        let start = i;
        while (i < len && str.charAt(i) === ch) { ++i; }
        // resolveSentinels = true: this path runs after the converter's `$`/`¨` -> `¨D`/`¨T`
        // swap, so flanking must see the real adjacent character (the engine undoes the swap
        // for the lookaround only).
        stack.pushDelim(str, start, i, ch, true);
        continue;
      }

      // plain text run up to the next significant char
      let start = i;
      while (i < len && '\n\\`<&![]*_'.indexOf(str.charAt(i)) === -1) { ++i; }
      if (i === start) {
        appendText(str.charAt(i)); i++;
      } else {
        appendText(str.slice(start, i));
      }
    }

    processEmphasis(null);

    // render the node list
    return stack.renderList(renderNode);

    // ---- bracket stack ---------------------------------------------------------

    function pushBracket (node, image, sourceStart, matchStart) {
      brackets = {
        node: node,
        prev: brackets,
        prevDelim: stack.delimiters,
        image: image,
        active: true,
        matchStart: matchStart, // index in `str` of the opening `[` / `![`
        sourceStart: sourceStart // index in `str` where the label text begins
      };
    }

    function parseCloseBracket (s, idx) {
      let opener = brackets;
      if (opener === null) { appendText(']'); return idx + 1; }
      if (!opener.active) { brackets = opener.prev; appendText(']'); return idx + 1; }

      // try to parse the destination/title or a reference that follows the `]`
      // variant mirrors link.js/image.js: `inline` for `[..](..)`, `reference` for the
      // reference-style forms (full/collapsed/shortcut) - drives the capture event name.
      let dest = null, title = null, width = null, height = null, matched = false, endIdx = idx + 1,
          variant = 'inline';

      if (s.charAt(idx + 1) === '(') {
        let j = idx + 2, n2 = s.length, isWs = function (c) { return c === ' ' || c === '\t' || c === '\n'; };
        while (j < n2 && isWs(s.charAt(j))) { j++; }
        let d = showdown.helper.cmScanDestination(s, j);
        if (d) {
          j = d.end;
          // parseImgDimensions (Showdown extension, not CommonMark): an optional
          // ` =WxH` between destination and title. The `=WxH` is always consumed here so
          // it never leaks into the output; buildImage only renders it when the option is
          // on. Regex fragment copied from the inline image regex in image.js.
          let dimStart = j;
          while (dimStart < n2 && isWs(s.charAt(dimStart))) { dimStart++; }
          if (dimStart > j && s.charAt(dimStart) === '=') {
            let dim = /^=([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4})/.exec(s.slice(dimStart));
            if (dim) {
              width = dim[1];
              height = dim[2];
              j = dimStart + dim[0].length;
            }
          }
          let hadWs = false;
          while (j < n2 && isWs(s.charAt(j))) { hadWs = true; j++; }
          let tc = s.charAt(j), t = null;
          if (hadWs && (tc === '"' || tc === '\'' || tc === '(')) {
            t = showdown.helper.cmScanTitle(s, j);
            if (t) { j = t.end; }
          }
          while (j < n2 && isWs(s.charAt(j))) { j++; }
          if (s.charAt(j) === ')') {
            dest = d.url;
            title = t ? t.title : null;
            matched = true;
            endIdx = j + 1;
          }
        }
      }

      if (!matched) {
        // reference: full [label], collapsed [] or shortcut. Use the RAW source label
        // (backslash escapes intact) - CommonMark matches labels by case-fold +
        // whitespace only, so `[foo\!]` must not match a `[foo!]` definition.
        variant = 'reference';
        let labelText = s.slice(opener.sourceStart, idx),
            refKey = null;
        if (s.charAt(idx + 1) === '[') {
          let close = findRefClose(s, idx + 2);
          if (close !== -1) {
            let inner = s.slice(idx + 2, close);
            refKey = inner.trim() === '' ? labelText : inner;
            endIdx = close + 1;
          }
        } else {
          refKey = labelText; // shortcut
          endIdx = idx + 1;
        }
        if (refKey !== null) {
          let key = showdown.helper.cmNormalizeLabel(refKey);
          if (key !== '' && !showdown.helper.isUndefined(globals.gUrls[key])) {
            dest = globals.gUrls[key];
            title = globals.gTitles[key];
            // parseImgDimensions: reference-style dimensions stored by stripLinkDefinitions
            if (globals.gDimensions[key]) {
              width = globals.gDimensions[key].width;
              height = globals.gDimensions[key].height;
            }
            matched = true;
          }
        }
      }

      if (!matched) { brackets = opener.prev; appendText(']'); return idx + 1; }

      // process emphasis on the delimiters inside the brackets
      processEmphasis(opener.prevDelim);

      // collect and render the inner nodes
      let innerHTML = renderNodes(opener.node.next, null),
          wholeMatch = s.slice(opener.matchStart, endIdx);

      let otpHTML;
      if (opener.image) {
        otpHTML = buildImage(innerHTML, dest, title, width, height, variant, wholeMatch);
      } else {
        otpHTML = buildLink(innerHTML, dest, title, variant, wholeMatch);
      }

      // drop the opener node and everything after it, append the built span
      stack.removeFrom(opener.node);
      appendRaw(otpHTML);
      // remove any emphasis delimiters that belonged to the consumed range
      stack.pruneDelimiters(opener.prevDelim);

      if (!opener.image) {
        // a link cannot be nested in another link
        for (let b = opener.prev; b !== null; b = b.prev) {
          if (!b.image) { b.active = false; }
        }
      }
      brackets = opener.prev;
      return endIdx;
    }

    // ---- rendering helpers -----------------------------------------------------

    // concatenate the rendered HTML of nodes [from .. to)
    function renderNodes (from, to) {
      return stack.renderRange(from, to, renderNode);
    }

    function normalizeDest (dest) {
      dest = resolveBackslash(dest);
      dest = showdown.helper.applyBaseUrl(options.relativePathBaseUrl, dest);
      return showdown.helper.cmNormalizeURL(dest);
    }
    function buildTitleAttr (attributes, title) {
      if (title !== null && title !== undefined) {
        attributes.title = showdown.helper.cmEscapeTitle(resolveBackslash(title));
      }
    }

    // Real CommonMark links/images (`[..](..)` + reference forms). These dispatch the same
    // event families as link.js/image.js — `makehtml.link.<variant>.*` /
    // `makehtml.image.<variant>.*` (variant `inline`/`reference`) — so listener extensions
    // work identically across flavors. The rendered output for listener-free conversions is
    // unchanged: the attribute strings are rebuilt from the same values via _populateAttributes.
    function buildLink (innerHTML, dest, title, variant, wholeMatch) {
      // safeMode: neutralize dangerous URL schemes (javascript:, vbscript:, data:, ...)
      let href = (options.safeMode && !showdown.helper.isSafeUrl(dest)) ? '' : normalizeDest(dest);
      innerHTML = showdown.subParser('makehtml.hardLineBreaks')(innerHTML, options, globals);
      let attributes = {href: href};
      buildTitleAttr(attributes, title);

      let capture = showdown.Event.dispatchCapture('makehtml.link.' + variant + '.onCapture', wholeMatch, {
        regexp: null,
        matches: {_wholeMatch: wholeMatch, _url: dest, _title: title, text: innerHTML},
        attributes: attributes
      }, options, globals);

      let otp;
      if (capture.output && capture.output !== '') {
        otp = capture.output;
      } else {
        attributes = capture.attributes;
        otp = '<a' + showdown.helper._populateAttributes(attributes) + '>' + capture.matches.text + '</a>';
      }
      let hash = showdown.Event.dispatchHash('makehtml.link.' + variant + '.onHash', otp, options, globals);
      return hashSpan(hash.output);
    }

    function buildImage (innerHTML, dest, title, width, height, variant, wholeMatch) {
      // alt text is the plain-text rendering of the label (markup stripped); the inner
      // spans are hashed, so restore them before flattening
      let alt = showdown.helper.unhashHTMLSpans(innerHTML, options, globals)
        .replace(/<img\b[^>]*?\salt="([^"]*)"[^>]*?\/?>/g, '$1')
        .replace(/<[^>]*>/g, '');
      // safeMode: neutralize dangerous URL schemes; data:image/* stays allowed
      let src = (options.safeMode && !showdown.helper.isSafeUrl(dest, {allowDataImage: true})) ? '' : normalizeDest(dest);
      let attributes = {src: src, alt: alt};
      buildTitleAttr(attributes, title);
      // width/height gating copied from writeImageTag in image.js (parseImgDimensions)
      if (options.parseImgDimensions) {
        if (width)  { attributes.width  = (width  === '*') ? 'auto' : width; }
        if (height) { attributes.height = (height === '*') ? 'auto' : height; }
      }

      let capture = showdown.Event.dispatchCapture('makehtml.image.' + variant + '.onCapture', wholeMatch, {
        regexp: null,
        matches: {_wholeMatch: wholeMatch, _url: dest, _title: title, _width: width, _height: height, text: alt},
        attributes: attributes
      }, options, globals);

      let otp;
      if (capture.output && capture.output !== '') {
        otp = capture.output;
      } else {
        attributes = capture.attributes;
        // honor a listener that rewrote the alt text via matches.text
        if (capture.matches.text !== alt) { attributes.alt = capture.matches.text; }
        otp = '<img' + showdown.helper._populateAttributes(attributes) + ' />';
      }
      let hash = showdown.Event.dispatchHash('makehtml.image.' + variant + '.onHash', otp, options, globals);
      return hashSpan(hash.output);
    }

    // ---- emphasis (CommonMark reference algorithm) -----------------------------
    // Runs on the shared delimiter-stack engine. This path differs from
    // emphasisAndStrong's only in how the wrapped span is rendered: the inner nodes are
    // HTML-escaped, the GFM-inline-links pass + emoji/strikethrough/ellipsis run on them
    // (because the wrapped span is hashed below, the span-gamut extras never see it), and
    // the wrap node is raw.

    function processEmphasis (stackBottom) {
      stack.processEmphasis(stackBottom, buildEmphasis, true);
    }

    function buildEmphasis (tagOpen, tagClose, opener, closer) {
      let inner = renderNodes(opener.next, closer);
      inner = applyGfmInlineLinks(inner);
      // The wrapped emphasis span is hashed below, so the Showdown-only extras that run
      // after cmInline in spanGamut (emoji, strikethrough, ellipsis) never see its inner
      // content. Apply them here so e.g. `**~~x~~**` still strikes through.
      inner = showdown.subParser('makehtml.emoji')(inner, options, globals);
      inner = showdown.subParser('makehtml.strikethrough')(inner, options, globals);
      inner = showdown.subParser('makehtml.ellipsis')(inner, options, globals);
      inner = showdown.subParser('makehtml.hardLineBreaks')(inner, options, globals);
      return hashSpan(tagOpen + inner + tagClose);
    }
  }

  // ---- token recognizers (return {html, end} or null) ----------------------------

  function skipRun (str, i, ch) {
    let j = i;
    while (j < str.length && str.charAt(j) === ch) { j++; }
    return j;
  }

  function parseBacktick (str, i, noCloser) {
    let openEnd = skipRun(str, i, '`'),
        runLen = openEnd - i,
        n = str.length,
        j = openEnd;
    if (noCloser[runLen]) { return null; }
    // find a closing run of backticks of exactly runLen (not part of a longer run)
    while (j < n) {
      if (str.charAt(j) === '`') {
        let runStart = j,
            runEnd = skipRun(str, j, '`');
        if (runEnd - runStart === runLen) {
          let content = str.slice(openEnd, runStart).replace(/\n/g, ' ');
          // strip exactly one leading and trailing space if the content is not all spaces
          if (content.length >= 2 && content.charAt(0) === ' ' && content.charAt(content.length - 1) === ' ' && /[^ ]/.test(content)) {
            content = content.slice(1, -1);
          }
          let encoded = showdown.helper.encodeCode(content, options, globals);
          return {html: showdown.helper._hashHTMLSpan('<code>' + encoded + '</code>', globals), end: runEnd};
        }
        j = runEnd;
      } else {
        j++;
      }
    }
    noCloser[runLen] = true; // no closer of this length anywhere after here
    return null;
  }

  function parseAutolink (str, i) {
    if (!options.cmSpec) { return null; }
    reAutoUri.lastIndex = i;
    let uri = reAutoUri.exec(str);
    if (uri) {
      let raw = uri[0].slice(1, -1),
          href = showdown.helper.cmEncodeURI(raw).replace(/&/g, '&amp;');
      // safeMode: neutralize dangerous autolink schemes but keep the visible text
      if (options.safeMode && !showdown.helper.isSafeUrl(raw)) { href = ''; }
      return {html: showdown.helper._hashHTMLSpan('<a href="' + href + '">' + showdown.helper.escapeHTMLEntities(raw) + '</a>', globals), end: i + uri[0].length};
    }
    reAutoEmail.lastIndex = i;
    let email = reAutoEmail.exec(str);
    if (email) {
      let raw = email[0].slice(1, -1),
          href, txt;
      // encodeEmails: entity-encode the address (href and text) when the option is on,
      // so it works under cmSpec too. Mirrors parseMail in link.js (copied behavior).
      if (options.encodeEmails) {
        href = showdown.helper.encodeEmailAddress('mailto:' + raw);
        txt = showdown.helper.encodeEmailAddress(raw);
      } else {
        href = 'mailto:' + showdown.helper.escapeHTMLEntities(raw);
        txt = showdown.helper.escapeHTMLEntities(raw);
      }
      return {html: showdown.helper._hashHTMLSpan('<a href="' + href + '">' + txt + '</a>', globals), end: i + email[0].length};
    }
    // Showdown extension: <www...> angle autolink. Applies the GFM www rule (http(s)://
    // prepend + domain validation) to the explicitly delimited form. Active whenever
    // cmSpec is on (the early `!options.cmSpec` guard above already scopes this).
    reAutoWww.lastIndex = i;
    let www = reAutoWww.exec(str);
    if (www) {
      let raw = www[0].slice(1, -1),
          host = raw.split(/[/?#]/)[0];
      // GFM www rule: the domain after "www." must contain a period, plus the shared host
      // validation (>= 2 labels, last two labels have no "_").
      if (host.slice(4).indexOf('.') !== -1 && validAutolinkHost(raw, true)) {
        let full = (options.httpsAutoLinks ? 'https://' : 'http://') + raw,
            href = showdown.helper.cmEncodeURI(full).replace(/&/g, '&amp;');
        // safeMode: neutralize dangerous schemes but keep the visible text
        if (options.safeMode && !showdown.helper.isSafeUrl(full)) { href = ''; }
        return {html: showdown.helper._hashHTMLSpan('<a href="' + href + '">' + showdown.helper.escapeHTMLEntities(raw) + '</a>', globals), end: i + www[0].length};
      }
    }
    return null;
  }

  // The GFM ghMentions / simplifiedAutoLink post-passes emit their anchors through the shared
  // GFM anchor machinery (showdown.helper.writeAnchorTag / parseMail), same as link.js. This
  // path pins the CommonMark href policy (CM_GFM_ANCHOR_URL_POLICY): safeMode, cmNormalizeURL and
  // the quote/angle attribute escape are all skipped so these legacy GFM anchors stay
  // byte-identical to the non-cmSpec path (see CM_GFM_ANCHOR_URL_POLICY for the rationale).
  function writeAnchorTag (subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase) {
    return showdown.helper.writeAnchorTag(subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase,
      options, globals, showdown.helper.CM_GFM_ANCHOR_URL_POLICY);
  }

  function parseMail (mail) {
    return showdown.helper.parseMail(mail, options);
  }

  // GFM extended www autolink: the host must have at least two labels and the last two
  // must not contain "_". Explicit-scheme (http/https/ftp) urls are not domain-validated.
  function validAutolinkHost (url, isWww) {
    if (!isWww) { return true; }
    let host = url.split(/[/?#]/)[0],
        labels = host.split('.');
    if (labels.length < 2) { return false; }
    return !/_/.test(labels.slice(-2).join('.'));
  }

  // GFM extended email autolink: the domain must have at least two labels, must not end in
  // "-" or "_", and its last two labels must not contain "_".
  function validMailAddr (addr) {
    let at = addr.lastIndexOf('@');
    if (at < 1) { return false; }
    let domain = addr.slice(at + 1),
        labels = domain.split('.');
    if (labels.length < 2) { return false; }
    if (/[-_]$/.test(domain)) { return false; }
    return !/_/.test(labels.slice(-2).join('.'));
  }

  function parseRawHTML (str, i) {
    if (!options.cmSpec) { return null; }
    reRawHtml.lastIndex = i;
    let m = reRawHtml.exec(str);
    if (!m) { return null; }
    return {html: showdown.helper._hashHTMLSpan(m[0], globals), end: i + m[0].length};
  }

  // find the closing `]` of a reference label, honoring backslash escapes
  function findRefClose (str, j) {
    let n = str.length;
    while (j < n) {
      let c = str.charAt(j);
      if (c === '\\' && j + 1 < n) { j += 2; continue; }
      if (c === ']') { return j; }
      if (c === '[') { return -1; }
      j++;
    }
    return -1;
  }
});
