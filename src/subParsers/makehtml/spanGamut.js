/**
 * These are all the transformations that occur *within* block-level
 * tags like paragraphs, headers, and list items.
 */
showdown.subParser('makehtml.spanGamut', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.spanGamut.onStart', text, options, globals);
  text = startEvent.output;

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
    text = showdown.subParser('makehtml.hashHTMLSpans')(text, options, globals);

    text = showdown.subParser('makehtml.encodeAmpsAndAngles')(text, options, globals);
    text = showdown.subParser('makehtml.hardLineBreaks')(text, options, globals);

    let cmAfterEvent = showdown.Event.dispatchEnd('makehtml.spanGamut.onEnd', text, options, globals);
    return cmAfterEvent.output;
  }

  text = showdown.subParser('makehtml.codeSpan')(text, options, globals);
  text = showdown.subParser('makehtml.escapeSpecialCharsWithinTagAttributes')(text, options, globals);
  text = showdown.subParser('makehtml.encodeBackslashEscapes')(text, options, globals);

  // Process link and image tags. Images must come first,
  // because ![foo][f] looks like a link.
  text = showdown.subParser('makehtml.image')(text, options, globals);
  text = showdown.subParser('makehtml.link')(text, options, globals);

  if (options.cmSpec) {
    // CommonMark inline raw HTML: recognize well-formed tags/comments/PIs/
    // declarations/CDATA and hash them now - after backslash escapes and link/image
    // destinations are resolved, but before emphasis - so that markup characters
    // inside a tag (e.g. `<a href="**">`) are not parsed as emphasis. Malformed
    // `<…>` is left for encodeAmpsAndAngles to escape. Fresh regex per call (this
    // subparser runs re-entrantly).
    text = text.replace(new RegExp(showdown.helper.regexes.cmHTMLTagSource, 'g'), function (wm) {
      // Backslash escapes are not processed inside raw HTML, so restore any escape
      // placeholders that encodeBackslashEscapes produced back to literal `\<char>`.
      wm = showdown.helper.unescapePlaceholders(wm, function (c) { return '\\' + c; });
      return showdown.helper._hashHTMLSpan(wm, globals);
    });
  }

  text = showdown.subParser('makehtml.emoji')(text, options, globals);
  text = showdown.subParser('makehtml.underline')(text, options, globals);
  text = showdown.subParser('makehtml.emphasisAndStrong')(text, options, globals);
  text = showdown.subParser('makehtml.strikethrough')(text, options, globals);
  text = showdown.subParser('makehtml.ellipsis')(text, options, globals);

  // we need to hash HTML tags inside spans
  text = showdown.subParser('makehtml.hashHTMLSpans')(text, options, globals);

  // now we encode amps and angles
  text = showdown.subParser('makehtml.encodeAmpsAndAngles')(text, options, globals);

  text = showdown.subParser('makehtml.hardLineBreaks')(text, options, globals);

  let afterEvent = showdown.Event.dispatchEnd('makehtml.spanGamut.onEnd', text, options, globals);
  return afterEvent.output;
});
