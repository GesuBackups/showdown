/**
 * @file      makehtml/autolink.js
 * @summary   Angle-bracket autolinks in the unified inline scan (CommonMark spec §6.5) plus the Showdown `<www...>` extension.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes an `<uri>`, `<email>` or `<www...>` autolink at the scan cursor and builds the anchor
 * through the `makehtml.link.angleBrackets.*` capture/hash lifecycle (so listener extensions see the
 * same event family across flavors). cmSpec recognizes any scheme; the Showdown flavors restrict the
 * URI form to http/https/ftp. The `<www...>` form applies the GFM www rule (http(s):// prepend +
 * showdown.helper.validAutolinkHost domain validation) to the explicitly delimited shortcut.
 *
 * This is a `makehtml.inline.*` construct subparser called from the single-pass inline scanner in
 * spanGamut.js with the scan state — (scan, options, globals) — consuming (returning the new cursor)
 * or declining (returning null); see entity.js for the fuller scan-convention explanation.
 */

// Sticky regexes anchored at the scan cursor (lastIndex) so the recognizers never slice the tail of
// the string - keeps the tokenizer linear on `<`-heavy input. Reused across calls; each recognizer
// sets lastIndex before exec and the parse is not re-entrant within a single string.
// eslint-disable-next-line no-control-regex -- CommonMark autolinks exclude control chars (\x00-\x20) per spec
const reAutoUri = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\x00-\x20]*>/y;
// Showdown extension: <www...> angle autolinks (cmark-gfm does not autolink these, but the
// explicit <> is unambiguous user intent). Single variable class → linear / ReDoS-safe.
// eslint-disable-next-line no-control-regex -- same control-char exclusion as reAutoUri
const reAutoWww = /<www\.[^<>\x00-\x20]+>/y;
const reAutoEmail = /<[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*>/y;

showdown.subParser('makehtml.inline.autolink', function (scan, options, globals) {
  'use strict';

  // Dispatch the makehtml.link.angleBrackets capture/hash lifecycle for an `<url>` / `<email>` /
  // `<www...>` autolink (mirroring legacy link.js, which routed every angle-delimited autolink
  // through this family via writeAnchorTag). Honors a listener's output / attributes / matches.text.
  // Byte-identical to the hand-built anchor for listener-free conversions: the dispatch helpers
  // return their input unchanged, and _populateAttributes only escapes a literal `"` (which the
  // pre-encoded href never contains), so `<a href="HREF">TEXT</a>` is reproduced exactly.
  function emitAngleAutolink (wholeMatch, rawUrl, href, text) {
    let attributes = {href: href};
    let capture = showdown.Event.dispatchCapture('makehtml.link.angleBrackets.onCapture', wholeMatch, {
      regexp: null,
      matches: {_wholeMatch: wholeMatch, _url: rawUrl, text: text},
      attributes: attributes
    }, options, globals);
    let otp;
    if (capture.output && capture.output !== '') {
      otp = capture.output;
    } else {
      attributes = capture.attributes;
      otp = '<a' + showdown.helper._populateAttributes(attributes) + '>' + capture.matches.text + '</a>';
    }
    let hash = showdown.Event.dispatchHash('makehtml.link.angleBrackets.onHash', otp, options, globals);
    return showdown.helper._hashHTMLSpan(hash.output, globals);
  }

  function parseAutolink (str, i) {
    // Gate 5 (autolinks). Active for every flavor (the blanket `!cmSpec` bail is gone). cmSpec
    // recognizes any scheme; the Showdown flavors restrict the URI form to http/https/ftp (the
    // `<www...>` and `<email>` forms below stay active for all flavors). The `&` -> `&amp;` href
    // escape is unconditional.
    reAutoUri.lastIndex = i;
    let uri = reAutoUri.exec(str);
    if (uri) {
      let raw = uri[0].slice(1, -1);
      if (options.cmSpec || /^(?:https?|ftp):/i.test(raw)) {
        let href = showdown.helper.cmEncodeURI(raw).replace(/&/g, '&amp;');
        // safeMode: neutralize dangerous autolink schemes but keep the visible text
        if (options.safeMode && !showdown.helper.isSafeUrl(raw)) { href = ''; }
        return {html: emitAngleAutolink(uri[0], raw, href, showdown.helper.escapeHTMLEntities(raw)), end: i + uri[0].length};
      }
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
      return {html: emitAngleAutolink(email[0], raw, href, txt), end: i + email[0].length};
    }
    // Showdown extension: <www...> angle autolink. Applies the GFM www rule (http(s)://
    // prepend + domain validation) to the explicitly delimited form. Active for all flavors.
    reAutoWww.lastIndex = i;
    let www = reAutoWww.exec(str);
    if (www) {
      let raw = www[0].slice(1, -1),
          host = raw.split(/[/?#]/)[0];
      // GFM www rule: the domain after "www." must contain a period, plus the shared host
      // validation (>= 2 labels, last two labels have no "_").
      if (host.slice(4).indexOf('.') !== -1 && showdown.helper.validAutolinkHost(raw, true)) {
        // noinspection HttpUrlsUsage
        let full = (options.httpsAutoLinks ? 'https://' : 'http://') + raw,
            href = showdown.helper.cmEncodeURI(full).replace(/&/g, '&amp;');
        // safeMode: neutralize dangerous schemes but keep the visible text
        if (options.safeMode && !showdown.helper.isSafeUrl(full)) { href = ''; }
        return {html: emitAngleAutolink(www[0], raw, href, showdown.helper.escapeHTMLEntities(raw)), end: i + www[0].length};
      }
    }
    return null;
  }

  let res = parseAutolink(scan.str, scan.pos);
  if (res) { scan.appendRaw(res.html); return res.end; }
  // Decline: no autolink at the cursor; the scanner tries raw HTML next, then literal `<`.
  return null;
});
