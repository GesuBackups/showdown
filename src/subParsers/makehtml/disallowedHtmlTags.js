/**
 * @file      makehtml/disallowedHtmlTags.js
 * @summary   Neutralizes dangerous raw-HTML tags by escaping their leading `<` (GFM tagfilter, spec §6.11).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Runs late over near-final output, gated by `disallowRawHTML`/`safeMode`, filtering a blacklist
 * (`script`, `style`, `iframe`, `title`, `textarea`, `xmp`, `noembed`, `noframes`, `plaintext`). In
 * `safeMode` it also strips inline `on*=` handlers as defense-in-depth (not a full sanitizer). Emits
 * one `onCapture`/`onHash` per neutralized tag; a listener can whitelist a tag by setting `output`.
 */


showdown.subParser('makehtml.disallowedHtmlTags', function (text, options, globals) {
  'use strict';
  if (!options.disallowRawHTML && !options.safeMode) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.disallowedHtmlTags.onStart', text, options, globals);
  text = startEvent.output;

  // Run over the (near final) output: Showdown never generates these tags from Markdown
  // and code blocks/spans already entity-escape `<`, so only genuine raw-HTML passthrough
  // is touched. Both opening and closing forms are filtered, case-insensitively.
  //
  // Per-tag capture: `matches.text` is the matched tag opening (`<script`, `</iframe`, …). A
  // listener may rewrite it or, by setting `output` to the original tag, whitelist that tag
  // (i.e. leave it unescaped). Default output neutralizes the tag by escaping its leading `<`.
  const tagFilterRgx = /<(\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext))/gi;
  text = text.replace(tagFilterRgx, function (wholeMatch) {
    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.disallowedHtmlTags.onCapture', wholeMatch, {
      regexp: tagFilterRgx,
      matches: {
        _wholeMatch: wholeMatch,
        text: wholeMatch
      },
      attributes: {}
    }, options, globals);
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      otp = '&lt;' + captureStartEvent.matches.text.replace(/^</, '');
    }
    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.disallowedHtmlTags.onHash', otp, options, globals);
    return beforeHashEvent.output;
  });

  if (options.safeMode) {
    // Additional dangerous tags Showdown never emits from Markdown (svg/math/form/
    // media/embedding/document-metadata). Escaping the leading `<` renders them inert.
    text = text.replace(
      /<(\/?(?:svg|math|form|object|embed|base|link|meta|applet|frame|frameset|button|select|option|audio|video|source|track|template|portal))(?=[\s/>])/gi,
      '&lt;$1'
    );
    // Strip inline event-handler attributes (onclick, onerror, onload, ...) from any
    // surviving tag. Showdown's own generated attributes are never `on*`, so this only
    // affects raw-HTML passthrough (e.g. `<img src=x onerror=alert(1)>`). The separator
    // before the handler may be whitespace, `/`, or the closing quote of the previous
    // attribute — browsers accept all of these (`<img/onerror>`, `<img\tonerror>`,
    // `<a href="x"onmouseover=y>`). A whitespace/`/` separator is dropped; a quote
    // separator is preserved so the previous attribute stays terminated.
    text = text.replace(
      /(["'\s/])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi,
      function (whole, sep) { return (sep === '"' || sep === '\'') ? sep : ''; }
    );
    // Neutralize dangerous URL schemes (javascript:, vbscript:, data:text/html, ...) in the
    // URL-bearing attributes of raw-HTML tags — Showdown's own scheme allowlist only covers the
    // links/images it generates, not raw HTML the author embedded. This runs over EVERY surviving
    // tag (not just `<a>`/`<area>`) so it also catches e.g. `<input formaction="javascript:...">`
    // (`<input>` is intentionally not escaped, to keep tasklist checkboxes). Only real tags are
    // matched (code blocks have their `<` entity-escaped, so `&lt;a ...` is skipped), and Showdown's
    // generated tags carry only safe/relative URLs so re-checking them is a harmless no-op.
    //   - The tag body is `(?:"[^"]*"|'[^']*'|[^>])*` (quote-aware) rather than `[^>]*` so a `>`
    //     inside a quoted attribute value does not truncate the tag early.
    //   - The attribute separator is `["'\s/]` (not just `\s`) because browsers accept `/` and
    //     quote-adjacent attributes (`<a/href=…>`, `<a id="x"href=…>`); the separator is preserved.
    text = text.replace(/<[a-zA-Z][a-zA-Z0-9:-]*\b(?:"[^"]*"|'[^']*'|[^>])*>/g, function (tag) {
      return tag.replace(
        /(["'\s/](?:href|xlink:href|formaction|action)\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)/gi,
        function (whole, pre, val) {
          let unquoted = val.replace(/^(["'])([\s\S]*)\1$/, '$2');
          return showdown.helper.isSafeUrl(unquoted) ? whole : pre + '""';
        }
      );
    });
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.disallowedHtmlTags.onEnd', text, options, globals);
  return afterEvent.output;
});
