////
// makehtml/disallowedHtmlTags.js
// Copyright (c) 2018 ShowdownJS
//
// GFM "disallowed raw HTML" extension (tagfilter): a small blacklist of HTML tags
// is neutralized in the output by escaping their leading `<` to `&lt;`. These tags
// are singled out because they change how the surrounding markup is interpreted
// (script/style/iframe/etc.). See https://github.github.com/gfm/#disallowed-raw-html-extension-
//
// When the `safeMode` option is on, this stage also neutralizes a broader set of
// dangerous raw-HTML tags Showdown never generates and strips inline event-handler
// attributes (on*=...), so that embedded `<script>`, `<img onerror>`, `<svg onload>`
// and similar cannot execute. This is defense-in-depth, not a full HTML sanitizer.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.disallowedHtmlTags', function (text, options, globals) {
  'use strict';
  if (!options.disallowRawHTML && !options.safeMode) {
    return text;
  }

  let startEvent = new showdown.Event('makehtml.disallowedHtmlTags.onStart', text);
  startEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  startEvent = globals.converter.dispatch(startEvent);
  text = startEvent.output;

  // Run over the (near final) output: Showdown never generates these tags from Markdown
  // and code blocks/spans already entity-escape `<`, so only genuine raw-HTML passthrough
  // is touched. Both opening and closing forms are filtered, case-insensitively.
  text = text.replace(
    /<(\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext))/gi,
    '&lt;$1'
  );

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

  let afterEvent = new showdown.Event('makehtml.disallowedHtmlTags.onEnd', text);
  afterEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  afterEvent = globals.converter.dispatch(afterEvent);
  return afterEvent.output;
});
