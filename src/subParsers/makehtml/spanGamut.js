/**
 * @file      makehtml/spanGamut.js
 * @summary   Routes text through every inline/span-level construct (code spans, links, images, emphasis, emoji, …).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The inline recursive dispatcher. In the default path it runs `codeSpan`, escaping, links/images,
 * emphasis, etc.; in cmSpec mode it delegates most inline work to `cmInline` (after `underline`),
 * then runs the Showdown-only extras (emoji, strikethrough, ellipsis) and the final hashing/encoding
 * passes. Emits no events.
 */

// Dispatcher (not a construct): it matches nothing itself, only routes text through the
// inline subparsers, so it emits no events (the document-level makehtml.onStart /
// onPreParse / onEnd cover whole-text hooks).
showdown.subParser('makehtml.spanGamut', function (text, options, globals) {
  'use strict';

  if (options.cmSpec) {
    // underline runs BEFORE cmInline (mirroring the legacy order, where underline runs
    // before emphasisAndStrong): it claims `__`/`___` as `<u>` and escapes any remaining
    // `_`, so cmInline doesn't consume those underscores as emphasis. cmInline then hashes
    // the raw `<u>` tags as CommonMark raw HTML and leaves the escaped `_` placeholders be.
    text = showdown.subParser('makehtml.underline')(text, options, globals);

    // Unified CommonMark inline parser: code spans, backslash escapes, entities,
    // autolinks, raw HTML, links, images and emphasis resolved together on one
    // delimiter stack (replaces the sequential codeSpan/link/image/emphasis passes
    // and the raw-HTML hashing below). The remaining Showdown-only extras (emoji,
    // strikethrough, ellipsis) and the final encodeAmpsAndAngles/hardLineBreaks run
    // after, on the non-hashed text.
    text = showdown.subParser('makehtml.cmInline')(text, options, globals);

    text = showdown.subParser('makehtml.emoji')(text, options, globals);
    text = showdown.subParser('makehtml.strikethrough')(text, options, globals);
    text = showdown.subParser('makehtml.ellipsis')(text, options, globals);

    // hash the raw HTML these extras produce (e.g. strikethrough's `<del>`, image-based
    // emoji's `<img>`) before encodeAmpsAndAngles, otherwise their `<`/`>` get escaped to
    // `&lt;`/`&gt;`. Mirrors the legacy branch, which hashes spans before encoding.
    text = showdown.helper.hashHTMLSpans(text, options, globals);

    text = showdown.helper.encodeAmpsAndAngles(text, options, globals);
    text = showdown.subParser('makehtml.hardLineBreaks')(text, options, globals);

    return text;
  }

  text = showdown.subParser('makehtml.codeSpan')(text, options, globals);
  text = showdown.helper.escapeSpecialCharsWithinTagAttributes(text, options, globals);
  text = showdown.helper.encodeBackslashEscapes(text, options, globals);

  // Process link and image tags. Images must come first,
  // because ![foo][f] looks like a link.
  text = showdown.subParser('makehtml.image')(text, options, globals);
  text = showdown.subParser('makehtml.link')(text, options, globals);

  text = showdown.subParser('makehtml.emoji')(text, options, globals);
  text = showdown.subParser('makehtml.underline')(text, options, globals);
  text = showdown.subParser('makehtml.emphasisAndStrong')(text, options, globals);
  text = showdown.subParser('makehtml.strikethrough')(text, options, globals);
  text = showdown.subParser('makehtml.ellipsis')(text, options, globals);

  // we need to hash HTML tags inside spans
  text = showdown.helper.hashHTMLSpans(text, options, globals);

  // now we encode amps and angles
  text = showdown.helper.encodeAmpsAndAngles(text, options, globals);

  text = showdown.subParser('makehtml.hardLineBreaks')(text, options, globals);

  return text;
});
