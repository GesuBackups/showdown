/**
 * @file      makehtml/entity.js
 * @summary   HTML entity / numeric character references in the unified inline scan (CommonMark spec §2.5).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Recognizes a named entity (`&copy;`), a decimal (`&#35;`) or a hexadecimal (`&#xHH;`) numeric
 * character reference at the scan cursor. cmSpec decodes references to their literal character; the
 * Showdown flavors decode only when decodeEntities is on, otherwise they keep a valid reference
 * verbatim.
 *
 * This is a `makehtml.inline.*` construct subparser: it is called from the single-pass inline
 * scanner in spanGamut.js with the scan state — (scan, options, globals) instead of the usual
 * (text, options, globals) — because a text->text pass cannot express the cross-construct
 * precedence the unified scan resolves. `scan` bundles the string (`scan.str`), the cursor
 * (`scan.pos`, set by the scanner immediately before dispatch) and the output-node appenders
 * (`scan.appendText` / `scan.appendRaw`). A construct either consumes — appending its output and
 * returning the new cursor index — or declines by returning `null`, letting the scanner fall
 * through to its literal handling.
 */

// Sticky entity recognizer, anchored at the scan cursor (lastIndex) so it never slices the tail of
// the string — keeps the tokenizer linear on `&`-heavy input. lastIndex is set before every exec,
// so reuse across invocations is safe (file-level const, same pattern as the regexes in
// src/helpers/delimiterStack.js).
const reEntity = /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]*);/y;

// eslint-disable-next-line no-unused-vars -- `globals` is unused here but kept for the makehtml.inline.* (scan, options, globals) calling convention
showdown.subParser('makehtml.inline.entity', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      i = scan.pos;
  reEntity.lastIndex = i;
  let m = reEntity.exec(str);
  if (m) {
    // Gate 2 (entity/numeric refs). cmSpec decodes character references to their literal
    // character (unconditionally, as it always has); the Showdown flavors decode only when
    // decodeEntities is on, otherwise they keep a valid reference verbatim. Emit the verbatim
    // reference raw so render-time escaping does not turn `&` into `&amp;`; the later
    // encodeAmpsAndAngles pass leaves a valid entity reference intact. The `|| options.cmSpec`
    // keeps this gate strictly `!cmSpec`-conditioned (cmSpec output is byte-identical).
    if (options.cmSpec || options.decodeEntities) {
      let decoded = showdown.helper.cmDecodeEntities(m[0]);
      if (decoded !== m[0]) { scan.appendText(decoded); return i + m[0].length; }
    } else {
      scan.appendRaw(m[0]); return i + m[0].length;
    }
  }
  // Decline: no entity match, or a cmSpec-decode that produced an identical string (decoded ===
  // m[0]). In both cases the scanner falls through to its literal-`&` handling — exactly the cases
  // the inline `&`-branch used to fall to its trailing appendText('&').
  return null;
});
