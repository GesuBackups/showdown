/**
 * @file      makehtml/image.js
 * @summary   Markdown images (`![..](..)` + reference forms) in the unified inline scan (CommonMark spec §6.4).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * A markdown image `![..]` is recognized by the shared bracket scan in link.js — the `![` push and
 * the `]` close-bracket resolution are common to links and images. This file owns only what an image
 * renders as: the `<img>` builder.
 *
 * `makehtml.inline.image.build` is an aux-builder entry (like emphasis's `.build`): it is NOT
 * dispatched by the scanner's character loop. link.js invokes it at close-bracket time for a `![`
 * opener, with the scan state plus the resolved pieces —
 * (scan, options, globals, innerHTML, dest, title, width, height, variant, wholeMatch, rawLabel).
 * It renders and hashes the `<img>` span and returns the placeholder. It fires the
 * `makehtml.image.<variant>.*` (variant `inline`/`reference`) capture family, so listener extensions
 * work identically across flavors; listener-free conversions are byte-identical.
 */

/* jshint esnext: false, esversion: 9 */

// Resolve Markdown backslash escapes (`\*`, `\_`, …) into placeholder escapes so those characters
// lose their Markdown meaning. A character-level encoding pass (mechanism, not a construct; emits no
// events). Uses a hand-optimized replace chain that sidesteps the slow `RegExp` constructor. File-local
// to image.js — the non-cmSpec alt-text builder below is its sole caller.
function encodeBackslashEscapes (text) {
  'use strict';

  text = text
    .replace(/\\(\\)/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\([!#%'()*+,\-./:;=?@[\]\\^_`{|}~])/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\¨D/g, '¨D') // escape $ (which was already escaped as ¨D) (charcode is 36)
    .replace(/\\&/g, '&amp;') // escape &
    .replace(/\\"/g, '&quot;') // escaping "
    .replace(/\\</g, '&lt;') // escaping <
    .replace(/\\>/g, '&gt;'); // escaping >

  return text;
}

showdown.subParser('makehtml.inline.image.build', function (scan, options, globals, innerHTML, dest, title, width, height, variant, wholeMatch, rawLabel) {
  'use strict';

  let alt;
  if (options.cmSpec) {
    // CommonMark: alt text is the plain-text rendering of the label (markup stripped); the
    // inner spans are hashed, so restore them before flattening.
    alt = showdown.helper.unhashHTMLSpans(innerHTML, options, globals)
      .replace(/<img\b[^>]*?\salt="([^"]*)"[^>]*?\/?>/g, '$1')
      .replace(/<[^>]*>/g, '');
  } else {
    // Showdown flavors (legacy image.js parity): the alt is the RAW label text with inline
    // markup left literal — emphasis/links inside `![...]` are NOT processed into the alt, so
    // e.g. `![a_b_c]` keeps its underscores instead of emphasizing them away. Mirrors
    // image.js's non-cmSpec altText handling exactly (backslash escapes resolved to
    // placeholders, then `"` and `* _ : ~` escaped), the whole `<img>` being hashed below.
    alt = encodeBackslashEscapes(rawLabel)
      .replace(/"/g, '&quot;')
      .replace(showdown.helper.regexes.asteriskDashTildeAndColon, showdown.helper.escapeCharactersCallback);
  }
  // safeMode: neutralize dangerous URL schemes; data:image/* stays allowed
  let src = (options.safeMode && !showdown.helper.isSafeUrl(dest, {allowDataImage: true})) ? '' : scan.normalizeDest(dest);
  let attributes = {src: src, alt: alt};
  scan.buildTitleAttr(attributes, title);
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
  return scan.hashSpan(hash.output);
});
