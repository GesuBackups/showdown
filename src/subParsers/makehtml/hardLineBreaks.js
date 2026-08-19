/**
 * @file      makehtml/hardLineBreaks.js
 * @summary   Converts hard line breaks (trailing double-space or backslash-newline) into `<br />`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Supports the vanilla (`  \n`) and GFM `simpleLineBreaks` styles plus `\`+newline. A break has no
 * inner content, so its per-break capture events carry only `_wholeMatch`; `attributes` apply to the
 * emitted `<br>`. Emits the `makehtml.hardLineBreaks.*` event family.
 *
 * This file owns both forms of the construct: the whole-text `makehtml.hardLineBreaks` pass above and
 * the `makehtml.inline.hardBreak` scan handler below (called from the single-pass inline scanner in
 * spanGamut.js; see entity.js for the scan-convention explanation).
 */

showdown.subParser('makehtml.hardLineBreaks', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.hardLineBreaks.onStart', text, options, globals);
  text = startEvent.output;

  // Do hard breaks
  if (options.simpleLineBreaks) {
    // GFM style hard breaks
    // only add line breaks if the text does not contain a block (special case for lists).
    // ¨K = a generated/hashed block; ¨M = a markdown="1"-processed block (early restore);
    // ¨R = a raw HTML block (late restore). The ¨R sniff is newline-agnostic so it matches
    // both the cmSpec single-newline and the legacy double-newline wrapper.
    if (!/\n\n¨K/.test(text) && !/\n\n¨M/.test(text) && !/\n¨R\d+R\n/.test(text)) {
      text = text.replace(/\n+/gm, function (wholeMatch) { return parseBreak(/\n+/gm, wholeMatch); });
    }
  } else {
    // Vanilla hard breaks
    text = text.replace(/  +\n/g, function (wholeMatch) { return parseBreak(/  +\n/g, wholeMatch); });
  }
  text = text.replace(/\\\n/g, function (wholeMatch) { return parseBreak(/\\\n/g, wholeMatch); });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.hardLineBreaks.onEnd', text, options, globals);
  return afterEvent.output;

  /**
   * Render one hard break. A break has no inner content (like a horizontal rule), so `matches`
   * carries only the read-only `_wholeMatch` context - no `text` key. `attributes` are applied
   * to the emitted `<br>`, so a listener can tag/style individual breaks; a listener may also
   * override `output` entirely. The trailing newline that separated the source lines is kept.
   * @param {RegExp} pattern
   * @param {string} wholeMatch
   * @returns {string}
   */
  function parseBreak (pattern, wholeMatch) {
    let otp;
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.hardLineBreaks.onCapture', wholeMatch, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch
      },
      attributes: {}
    }, options, globals);

    // if something was passed as output, it takes precedence and will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      otp = '<br' + showdown.helper._populateAttributes(captureStartEvent.attributes) + ' />';
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.hardLineBreaks.onHash', otp, options, globals);
    return beforeHashEvent.output + '\n';
  }

});

// The `\n` scan handler for the unified inline scanner in spanGamut.js. Always consumes (the engine's
// `\n` dispatch is unconditional): a text tail with two+ trailing spaces or a trailing `\` becomes a
// hashed `<br />` (hashed so the later encodeAmpsAndAngles pass leaves it intact), otherwise the
// trailing spaces are trimmed and a literal newline is emitted. Reads/mutates the output list tail
// via scan.list; see entity.js for the scan-convention explanation.
// eslint-disable-next-line no-unused-vars -- `options`/`globals` are unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.hardBreak', function (scan, options, globals) {
  'use strict';

  let stack = scan.list,
      i = scan.pos;
  // hard line break: two+ trailing spaces or a backslash before the newline.
  // The <br /> is hashed so the later encodeAmpsAndAngles pass leaves it intact.
  let n = stack.tail;
  if (n && n.type === 'text' && !n.raw && / {2,}$/.test(n.literal)) {
    n.literal = n.literal.replace(/ +$/, '');
    scan.appendRaw(scan.hashSpan('<br />') + '\n');
  } else if (n && n.type === 'text' && !n.raw && /\\$/.test(n.literal)) {
    n.literal = n.literal.slice(0, -1);
    scan.appendRaw(scan.hashSpan('<br />') + '\n');
  } else {
    if (n && n.type === 'text' && !n.raw) { n.literal = n.literal.replace(/ +$/, ''); }
    scan.appendText('\n');
  }
  return i + 1;
});
