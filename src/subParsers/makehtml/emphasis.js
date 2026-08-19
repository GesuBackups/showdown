/**
 * @file      makehtml/emphasis.js
 * @summary   Emphasis and strong emphasis (`*`/`_` runs) in the unified inline scan (CommonMark spec §6.2).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * One file owns both em and strong: a single delimiter-run algorithm (the shared
 * showdown.helper.DelimiterStack engine) decides em vs strong at pairing time, so there is one
 * recognizer for the delimiter runs and one builder for the wrapped span. Two entries, two
 * conventions:
 *   - `makehtml.inline.emphasis` (scan-state convention — (scan, options, globals)): the single-pass
 *     scanner's `*`/`_` handler (see entity.js for the scan convention). It consumes the whole `*`
 *     or `_` delimiter run at scan.pos and pushes it onto the delimiter stack, returning the new
 *     cursor. It never declines — a delimiter run is always consumed onto the stack, where the
 *     emphasis algorithm later resolves (or discards) it.
 *   - `makehtml.inline.emphasis.build` (aux-builder convention, signature
 *     (scan, options, globals, tagOpen, tagClose, opener, closer)): NOT dispatched by the scanner's
 *     character loop. It is the `buildWrapped` callback the engine's processEmphasis wrapper
 *     (spanGamut.js) invokes at pairing time, once per matched opener/closer pair, to render and
 *     hash the `<em>`/`<strong>` span. `tagOpen`/`tagClose` are the chosen tags (`<em>`/`<strong>`
 *     per the delimiter algorithm's em-vs-strong decision); `opener`/`closer` are the delimiter
 *     nodes bounding the enclosed content (`opener.next` .. `closer`).
 *
 * Event parity (D3): the builder fires the separate makehtml.emphasis.* / makehtml.strong.* families
 * (a `<em>` span dispatches makehtml.emphasis.*, a `<strong>` span makehtml.strong.*), honoring a
 * listener's output / matches.text / attributes. Listener-free conversions are byte-identical.
 */

// eslint-disable-next-line no-unused-vars -- `globals` is unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.emphasis', function (scan, options, globals) {
  'use strict';
  let str = scan.str,
      len = str.length,
      start = scan.pos,
      ch = str.charAt(start),
      i = start;
  while (i < len && str.charAt(i) === ch) { ++i; }
  // resolveSentinels = true: this path runs after the converter's `$`/`¨` -> `¨D`/`¨T`
  // swap, so flanking must see the real adjacent character (the engine undoes the swap
  // for the lookaround only).
  // Gate 4 (intraword underscore). Under the Showdown flavors (unless
  // literalMidWordUnderscores), `_` uses the looser `*` open/close flanking rule so
  // `un_frigging_believable` emphasizes; cmSpec keeps the CommonMark `_` flanking rule.
  // placeholderAsWord (Showdown flavors only): a delimiter touching a `¨E<code>E` escape
  // placeholder flanks as if against a word char, so `word_\_x\__` -> `word<em>_x_</em>`
  // (legacy regex emphasis saw the placeholder as ordinary word characters).
  scan.list.pushDelim(str, start, i, ch, true, !options.cmSpec && !options.literalMidWordUnderscores, !options.cmSpec);
  return i;
});

// The `buildWrapped` callback for the shared delimiter-stack engine, invoked by the engine's
// processEmphasis wrapper (spanGamut.js) at emphasis-pairing time — not by the scanner's character
// loop. It renders the enclosed nodes and returns the final (hashed) wrapped span. This path
// differs from the retired emphasisAndStrong's only in how the wrapped span is rendered: the inner
// nodes are HTML-escaped via scan.renderNodes, the GFM-inline-links pass + emoji/strikethrough
// run on them (because the wrapped span is hashed below, the span-gamut extras never see
// it), and the wrap node is raw.
showdown.subParser('makehtml.inline.emphasis.build', function (scan, options, globals, tagOpen, tagClose, opener, closer) {
  'use strict';
  // Strikethrough pairing (place c): resolve tilde-run nodes inside this emphasis span into `<del>`,
  // on the span's inner node range, BEFORE the nodes are rendered below. This builder runs at
  // emphasis-pairing time (after the inner emphasis is already resolved), which is exactly when the
  // retired whole-text pass used to strike the rendered inner — so `**~~x~~**` still strikes through.
  // applyGfm is true (an emphasis span finalizes its inner like the top level: the GFM overlay is
  // applied; the `<del>` is hashed, so it is a no-op inside it). Emoji is scan-native, already
  // substituted inline, so the pairing pass no longer takes an applyEmoji arg.
  if (options.strikethrough) {
    showdown.subParser('makehtml.inline.strikethrough.pair')(scan, options, globals, opener.next, closer, true);
  }
  let inner = scan.renderNodes(opener.next, closer);
  inner = scan.applyGfmInlineLinks(inner);
  // Emoji, strikethrough (place c, above) and ellipsis are all scan-native — the `:name:`/`~~`/`...`
  // inside the span are already resolved by the scan (emoji substituted inline, before this builder
  // renders the inner nodes), so none are re-applied here.
  inner = showdown.subParser('makehtml.hardLineBreaks')(inner, options, globals);
  // Event parity (D3): fire the separate makehtml.emphasis.* / makehtml.strong.* families
  // (`<em>` -> emphasis, `<strong>` -> strong), honoring a listener's output / matches.text /
  // attributes. Byte-identical for listener-free conversions.
  let isStrong = (tagOpen === '<strong>'),
      tagName = isStrong ? 'strong' : 'em',
      evtName = isStrong ? 'makehtml.strong' : 'makehtml.emphasis',
      marker = opener.cc.repeat(isStrong ? 2 : 1),
      wholeMatch = marker + inner + marker,
      attributes = {},
      capture = showdown.Event.dispatchCapture(evtName + '.onCapture', inner, {
        regexp: null,
        matches: {_wholeMatch: wholeMatch, text: inner},
        attributes: attributes
      }, options, globals);
  let otp;
  if (capture.output && capture.output !== '') {
    otp = capture.output;
  } else {
    attributes = capture.attributes;
    otp = '<' + tagName + showdown.helper._populateAttributes(attributes) + '>' + capture.matches.text + '</' + tagName + '>';
  }
  let hash = showdown.Event.dispatchHash(evtName + '.onHash', otp, options, globals);
  return scan.hashSpan(hash.output);
});
