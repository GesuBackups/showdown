/**
 * @file      makehtml/ghMentions.js
 * @summary   The GFM `@mention` post-pass, gated by the `ghMentions` option.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Links `@username` mentions via `options.ghMentionsLink`, emitting the anchor through the shared
 * GFM anchor machinery (showdown.helper.writeAnchorTag) so listener extensions see the same
 * `makehtml.link.reference.*` events as ordinary links.
 *
 * DEVIATION FROM THE SCAN-STATE CONVENTION: unlike the `makehtml.inline.*` scan handlers
 * (entity.js, backslash.js, ...), this is a POST-SCAN pass — it runs on the serialized inline
 * output (and on emphasis inner content, via applyGfmInlineLinks in spanGamut.js), where real
 * links / images / code spans are already hashed and protected. It therefore uses the ordinary
 * text convention — (text, options, globals) -> text — not the (scan, options, globals) scan state.
 */

showdown.subParser('makehtml.inline.ghMentions', function (text, options, globals) {
  'use strict';

  if (!options.ghMentions) {
    return text;
  }
  // Gate 6: cmSpec pins the CommonMark href policy (CM_GFM_ANCHOR_URL_POLICY — safeMode,
  // cmNormalizeURL and the quote/angle attribute escape all skipped); the Showdown flavors reuse
  // the legacy link.js policy (LEGACY_ANCHOR_URL_POLICY) so these anchors stay byte-identical to
  // the non-cmSpec path. Matches the engine's former anchorUrlPolicy selection.
  let policy = options.cmSpec ? showdown.helper.CM_GFM_ANCHOR_URL_POLICY : showdown.helper.LEGACY_ANCHOR_URL_POLICY;
  let ghMentionsRegex = /(^|\s)(\\)?(@([a-z\d]+(?:[a-z\d._-]+?[a-z\d]+)*))/gi;
  return text.replace(ghMentionsRegex, function (wholeMatch, st, escape, mentions, username) {
    // bail if the mentions was escaped
    if (escape === '\\') {
      return st + mentions;
    }
    // check if options.ghMentionsLink is a string
    // TODO Validation should be done at initialization not at runtime
    if (!showdown.helper.isString(options.ghMentionsLink)) {
      throw new Error('ghMentionsLink option must be a string');
    }
    let url = options.ghMentionsLink.replace(/\{u}/g, username);
    return st + showdown.helper.writeAnchorTag('reference', ghMentionsRegex, wholeMatch, mentions, null, url, undefined, undefined, options, globals, policy);
  });
});
