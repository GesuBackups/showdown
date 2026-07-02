////
// makehtml/hashHTMLSpans.js
// Copyright (c) 2018 ShowdownJS
//
// Hash span elements that should not be parsed as markdown
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.hashHTMLSpans', function (text, options, globals) {
  'use strict';
  let startEvent = new showdown.Event('makehtml.hashHTMLSpans.onStart', text);
  startEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  startEvent = globals.converter.dispatch(startEvent);
  text = startEvent.output;

  // NOTE: the self-closing character classes exclude `<` (`[^<>]` rather than `[^>]`) so a scan
  // for a tag's `>` can never run across the start of the *next* `<`. This keeps matching linear
  // on pathological input (`'<'.repeat(n)`) without changing results — a real tag has no bare `<`.

  // Hash Self Closing tags
  if (!options.cmSpec) {
    text = text.replace(/<[^<>]+?\/>/gi, function (wm) {
      return showdown.helper._hashHTMLSpan(wm, globals);
    });
  }

  // Hash whole `<tag …>…</tag>` spans. This is done with a forward cursor + an "absent close
  // tag" cache rather than a `<([^<>]+?)>[\s\S]*?<\/\1>` regex: that regex re-scans to EOF for a
  // matching `</tag>` at *every* `<` when none follows, which is O(n^2) on inputs like
  // `'<a>'.repeat(n)` or `'<a>'.repeat(n) + '</z>'`. The cursor scans each character once and, the
  // first time a given `</name>` is found to be absent ahead, never searches for it again. Two
  // passes preserve the old ordering/semantics: first tags whose *entire* `<…>` content is the
  // closing name (no attributes), then tags whose first token is the closing name (with attributes).
  text = hashPairedTags(text, 'full');
  text = hashPairedTags(text, 'name');

  // Hash self closing tags without />. In CommonMark raw-HTML mode the valid inline
  // raw HTML has already been hashed earlier (spanGamut); any `<…>` left here is
  // malformed and must NOT be hashed (it is escaped by encodeAmpsAndAngles instead).
  if (!options.cmSpec) {
    text = text.replace(/<[^<>]+?>/gi, function (wm) {
      return showdown.helper._hashHTMLSpan(wm, globals);
    });
  }

  /**
   * Hash `<open>…</close>` spans in a single linear pass.
   * @param {string} str
   * @param {'full'|'name'} mode `full`: the close tag name is the whole `<…>` content (tags
   *   without attributes); `name`: the content must contain whitespace and the close tag name
   *   is its first token (tags with attributes).
   * @returns {string}
   */
  function hashPairedTags (str, mode) {
    let out = '',
        i = 0,
        len = str.length,
        absent = Object.create(null);
    while (i < len) {
      if (str.charAt(i) !== '<') { out += str.charAt(i); i++; continue; }
      let gt = str.indexOf('>', i + 1);
      // a real open tag has a `>` and no `<` between `<` and `>`
      if (gt === -1) { out += str.charAt(i); i++; continue; }
      let inner = str.slice(i + 1, gt);
      if (inner.indexOf('<') !== -1) { out += str.charAt(i); i++; continue; }
      let closeName;
      if (mode === 'full') {
        if (inner.length === 0) { out += str.charAt(i); i++; continue; }
        closeName = inner;
      } else {
        let sp = inner.search(/\s/);
        if (sp <= 0) { out += str.charAt(i); i++; continue; }
        closeName = inner.slice(0, sp);
      }
      let closeStr = '</' + closeName + '>';
      if (absent[closeStr]) { out += str.charAt(i); i++; continue; }
      let ci = str.indexOf(closeStr, gt + 1);
      if (ci === -1) { absent[closeStr] = true; out += str.charAt(i); i++; continue; }
      out += showdown.helper._hashHTMLSpan(str.slice(i, ci + closeStr.length), globals);
      i = ci + closeStr.length;
    }
    return out;
  }

  let afterEvent = new showdown.Event('makehtml.hashHTMLSpans.onEnd', text);
  afterEvent
    .setOutput(text)
    ._setGlobals(globals)
    ._setOptions(options);
  afterEvent = globals.converter.dispatch(afterEvent);
  return afterEvent.output;
});
