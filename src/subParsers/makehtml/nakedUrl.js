/**
 * @file      makehtml/nakedUrl.js
 * @summary   GFM naked-URL / naked-mail autolinking (the `simplifiedAutoLink` option).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Two entries, two conventions:
 *   - `makehtml.inline.nakedUrl` (scan-state convention — (scan, options, globals)): the single-pass
 *     scanner's atomic-token recognizer, consuming a bare `http(s)://` / `ftp://` / `www.` run so the
 *     `_`/`*` inside it never become emphasis delimiters (see entity.js for the scan convention). It
 *     consumes (returns the new cursor) or declines (returns null).
 *   - `makehtml.inline.nakedUrl.linkify` (text convention — (text, options, globals) -> text): the
 *     POST-SCAN pass that turns those runs (and `xmpp:`/`mailto:`/bare addresses) into `<a>` anchors.
 *     Like ghMentions.js it runs on the serialized inline output (and emphasis inner content), where
 *     real links / images / code spans are already hashed, so it uses the ordinary text convention.
 */

// Recognize a naked URL at `i` (called only when options.simplifiedAutoLink, always a Showdown
// flavor — cmSpec/gfm skip this recognizer). Consumes the maximal `http(s)://` / `ftp://` /
// `www.` run, stopping at whitespace, angle/quote chars and the hash sentinel `¨` so an adjacent
// hash placeholder is never absorbed. `&` is deliberately KEPT in the run (legacy's naked-URL
// regex included it) so a query string like `?a=1&b=2` stays one atomic node with a literal `&`;
// splitting on `&` here would let the `&` be entity-escaped to `&amp;` before the post-pass
// re-links it. Trailing emphasis markers `_ * ~` are trimmed back off (and left for the scanner)
// so a URL wrapped in emphasis — `__https://x__` — still emphasizes; every other
// trailing-punctuation / GFM trim stays in the simplifiedAutoLink post-pass. The run is a single
// negated-class quantifier (linear / ReDoS-safe). Returns {text, end} or null.
function consumeNakedUrl (str, i) {
  if (!/^(?:https?:\/\/|ftp:\/\/|www\.)/i.test(str.slice(i, i + 8))) { return null; }
  let n = str.length, j = i;
  while (j < n && !/[\s\\`<>![\]"'´¨]/.test(str.charAt(j))) { j++; }
  while (j > i) {
    let c = str.charAt(j - 1);
    if (c === '_' || c === '*' || c === '~') { j--; } else { break; }
  }
  if (j <= i) { return null; }
  return {text: str.slice(i, j), end: j};
}

/**
 * Encode a bare email address into `{mail, url}` (a `mailto:` href), applying the entity
 * obfuscation of `encodeEmails` when enabled. File-local to nakedUrl.js (its sole caller).
 * @param {string} mail
 * @param {{}} options
 * @returns {{mail: string, url: string}}
 */
function parseMail (mail, options) {
  let url = 'mailto:';
  mail = showdown.helper.unescapePlaceholders(mail);
  if (options.encodeEmails) {
    url = showdown.helper.encodeEmailAddress(url + mail);
    mail = showdown.helper.encodeEmailAddress(mail);
  } else {
    url = url + mail;
  }
  return {
    mail: mail,
    url: url
  };
}

/**
 * The naked-URL trailing-punctuation trim: walk the captured URL from the back, moving trailing
 * `_*~,;:.!?` and unbalanced `)`/`]` into a suffix that is emitted after the link. Returns the
 * trimmed url and the accumulated suffix. File-local to nakedUrl.js (its sole caller); the
 * GFM-specific trimming layered on top stays in the linkify pass below.
 * @param {string} url
 * @returns {{url: string, suffix: string}}
 */
function trimUrlPunctuation (url) {
  const len = url.length;
  let suffix = '';

  // Bracket counts of the *remaining* url, tallied once up front and decremented as chars are
  // chopped: counting them per chopped char (url.match(/\(/g) and friends) rescanned the whole
  // string every iteration, which is O(n^2) on a long trailing `)))...` run.
  let counts = {'(': 0, ')': 0, '[': 0, ']': 0};
  for (let i = 0; i < len; ++i) {
    let c = url.charAt(i);
    if (Object.prototype.hasOwnProperty.call(counts, c)) {
      counts[c]++;
    }
  }

  function chop (char) {
    url = url.slice(0, -1);
    // prepend to the suffix — the order matters, later passes read suffix.charAt(0)
    suffix = char + suffix;
    if (Object.prototype.hasOwnProperty.call(counts, char)) {
      counts[char]--;
    }
  }

  for (let i = len - 1; i >= 0; --i) {
    let char = url.charAt(i);
    if (/[_*~,;:.!?]/.test(char)) {
      // it's a punctuation char so we remove it from the url
      chop(char);
    } else if (/[)\]]/.test(char)) {
      // it's a parenthesis so we need to check for "balance" (kinda)
      let opPar = char === ')' ? counts['('] : counts['['],
          clPar = char === ')' ? counts[')'] : counts[']'];
      if (opPar < clPar) {
        // there are more closing Parenthesis than opening so chop it!!!!!
        chop(char);
      } else {
        // it's (kinda) balanced so our work is done
        break;
      }
    } else {
      // it's not a punctuation or a parenthesis so our work is done
      break;
    }
  }
  return {url: url, suffix: suffix};
}

/**
 * GFM extended email autolink domain validation: the domain must have at least two labels, must not
 * end in `-` or `_`, and its last two labels must not contain `_`. File-local to nakedUrl.js (the
 * naked-mail and xmpp/mailto post-passes are its only callers).
 * @param {string} addr
 * @returns {boolean}
 */
function validMailAddr (addr) {
  let at = addr.lastIndexOf('@');
  if (at < 1) { return false; }
  let domain = addr.slice(at + 1),
      labels = domain.split('.');
  if (labels.length < 2) { return false; }
  if (/[-_]$/.test(domain)) { return false; }
  return !/_/.test(labels.slice(-2).join('.'));
}

// The `h`/`w`/`f` scan handler for the unified inline scanner in spanGamut.js. Consumes a bare URL
// run as one atomic node (emitted RAW, not HTML-escaped: the legacy simplifiedAutoLink pass ran on
// unescaped text, so `&` and non-ASCII chars stayed literal in the captured URL; if the post-pass
// does not actually link it, the trailing encodeAmpsAndAngles pass encodes any bare `&` — matching
// the legacy result either way). Declines (returns null) when there is no URL run at the cursor.
// eslint-disable-next-line no-unused-vars -- `options`/`globals` are unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.nakedUrl', function (scan, options, globals) {
  'use strict';

  let u = consumeNakedUrl(scan.str, scan.pos);
  if (u) { scan.appendRaw(u.text); return u.end; }
  return null;
});

showdown.subParser('makehtml.inline.nakedUrl.linkify', function (text, options, globals) {
  'use strict';

  // The GFM ghMentions / simplifiedAutoLink post-passes emit their anchors through the shared
  // GFM anchor machinery (showdown.helper.writeAnchorTag) plus the file-local parseMail, same
  // pattern as link.js. Gate 6: cmSpec pins the CommonMark href policy (CM_GFM_ANCHOR_URL_POLICY —
  // safeMode, cmNormalizeURL and the quote/angle attribute escape all skipped); the Showdown
  // flavors reuse the legacy link.js policy (LEGACY_ANCHOR_URL_POLICY) so these anchors stay
  // byte-identical to the non-cmSpec path. Matches the engine's former anchorUrlPolicy selection.
  let policy = options.cmSpec ? showdown.helper.CM_GFM_ANCHOR_URL_POLICY : showdown.helper.LEGACY_ANCHOR_URL_POLICY;
  function writeAnchorTag (subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase) {
    return showdown.helper.writeAnchorTag(subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase,
      options, globals, policy);
  }

  // 8. Handle naked links (if option is enabled)
  if (options.simplifiedAutoLink) {
    // 8.1. Check for naked URLs
    // we also include leading markdown magic chars [_*~] for cases like __https://www.google.com/foobar__
    // An explicit scheme (http/https/ftp) does not require the host to contain a dot;
    // a `www.` shortcut does (and is domain-validated below).
    // The body classes exclude the hash sentinel `¨` so an adjacent hash placeholder
    // (e.g. `¨C0C` for a hashed span) is never absorbed into the href and percent-encoded
    // into `%C2%A8...` — the placeholder must survive intact to be unhashed later.
    // cmSpec/gfm: an explicit scheme (http/https/ftp) links any non-empty host (no dot or
    // leading-char constraint); a `www.` shortcut is dot-and-leading-char validated. The
    // Showdown flavors (legacy simplifiedAutoLink, link.js) apply the SAME host constraint to
    // scheme URLs as to `www.` ones — the host must not start with `.`/`-` and must contain a
    // `.` — so `http:///a`, `http://-a.b.co` and `http://3628126748` stay plain text and
    // `http://.www.foo.bar/` links only its `www.foo.bar/` tail. Gated so cmSpec is byte-identical.
    let nakedUrlRegex = options.cmSpec ?
      /([_*~]*?)((?:https?|ftp):\/\/[^\s<>"'`´¨]+|www\.[^\s<>"'`´.¨-][^\s<>"'`´¨]*?\.[a-z\d.]+[^\s<>"'¨]*)\1/gi :
      /([_*~]*?)((?:(?:https?|ftp):\/\/|www\.)[^\s<>"'`´.¨-][^\s<>"'`´¨]*?\.[a-z\d.]+[^\s<>"'¨]*)\1/gi;
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
      let trimmed = trimUrlPunctuation(url);
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
      if (!showdown.helper.validAutolinkHost(url, isWww)) {
        return wholeMatch;
      }

      // we copy the treated url to the text variable
      let txt = url;
      // finally, if it's a www shortcut, we prepend http(s)
      // noinspection HttpUrlsUsage
      url = isWww ? (options.httpsAutoLinks ? 'https://' : 'http://') + url : url;
      // GFM/cmSpec: percent-encode non-ASCII characters in the href (the display text keeps
      // the literal characters). The Showdown flavors (legacy simplifiedAutoLink) leave the
      // href's non-ASCII characters literal, so this is gated to cmSpec to stay byte-identical
      // to the legacy path.
      if (options.cmSpec) {
        // eslint-disable-next-line no-control-regex -- \x00-\x7F is the ASCII range
        url = url.replace(/[^\x00-\x7F]+/g, function (s) { return encodeURI(s); });
      }

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
      const m = parseMail(addr, options);
      return lead + writeAnchorTag ('autoLink', nakedMailRegex, wholeMatch, m.mail, null, m.url);
    });
  }
  return text;
});
