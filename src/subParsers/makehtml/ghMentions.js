/**
 * @file      makehtml/ghMentions.js
 * @summary   GFM `@mention` linking inside the unified inline scan, gated by the `ghMentions` option.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The `@` handler for the single-pass inline scanner in spanGamut.js — the scan-state convention
 * (scan, options, globals), consuming (returning the new cursor) or declining (returning null); see
 * entity.js for the fuller explanation. It links `@username` via `options.ghMentionsLink`, emitting
 * the anchor through the shared GFM anchor machinery (showdown.helper.writeAnchorTag) so listener
 * extensions see the same `makehtml.link.reference.*` events as ordinary links.
 *
 * This used to be a POST-SCAN text pass that ran on the serialized inline output (and on emphasis
 * inner content); it now resolves the mention DURING the scan. Moving before emphasis/bracket
 * resolution changed three behaviors, all ruled intentional:
 *   - Mentions NEVER link inside a bracket construct — while any `[`/`![` opener is live on the
 *     bracket stack the handler declines, so `[ @user](x)` keeps `@user` literal in the label rather
 *     than nesting an `<a>` in the link. A mention in a bracket that never resolves (`text [ @user]`)
 *     is therefore left literal too (the old pass linkified the serialized `[ @user]`); accepted.
 *   - A mention links inside an underline region (`__@user__` -> `<u><a>@user</a></u>`), consistent
 *     with how emphasis inner content already linked; the old pass saw `>@` there and skipped it.
 *   - The whole username is captured before emphasis runs, so `@user_name_here` links as one mention
 *     everywhere; the old pass ran after intraword `_` emphasis had split `_name_` out of it.
 *
 * The `(^|\s)` fragment anchor of the old pass becomes a scan-state boundary test: legal only at the
 * fragment start (scan.pos === 0), after a raw whitespace char, or when the node-list tail is a
 * pending emphasis DELIMITER node — the last case reproduces the old pass's fragment-^ match on
 * emphasis inner content (`*@user*`). A finished raw/hashed or plain-text tail is NOT a boundary
 * (the pass saw a placeholder/word letter there, so `[x](y)@user` and `a@user` did not match). The
 * old pass's `(\\)?` escape arm has no scan analogue: `\@` is turned into a `¨E<code>E` escape
 * placeholder by the backslash handler before this ever runs, so the `@` never reaches here.
 *
 * Two registrations:
 *   - `makehtml.inline.ghMentions` — the `@` scan handler above (the primary form).
 *   - `makehtml.inline.ghMentions.linkify` — an INTERNAL text-convention helper (text, options,
 *     globals) -> text used only to link mentions inside a RESOLVED wrapper span's already-rendered
 *     inner content, where the scan cannot: a strikethrough `<del>` is resolved at pairing time
 *     (strikethrough.js's buildDel) from `tilde`-typed nodes, not the `delim` nodes the boundary rule
 *     keys on, so its inner mentions are linked here instead. Emphasis/underline need no such call —
 *     an `*`/`_` run is a pending `delim` (the boundary rule links `*@user*` during the scan) and an
 *     underline region re-scans its inner from the fragment start; only strikethrough's node shape
 *     forces resolution-time linking. The helper is the historic post-scan pass body verbatim (same
 *     `(^|\s)` boundary regex on rendered inner), so a resolved `<del>` links exactly as before.
 */

showdown.subParser('makehtml.inline.ghMentions', function (scan, options, globals) {
  'use strict';

  let str = scan.str,
      pos = scan.pos;

  // Mentions never link inside a bracket construct: while any `[`/`![` opener is live on the bracket
  // stack, decline so the `@username` stays literal in the (image alt / link) label.
  if (scan.brackets) { return null; }

  let prev = pos > 0 ? str.charAt(pos - 1) : '',
      prevWs = pos > 0 && /\s/.test(prev),
      tail = scan.list.tail,
      tailIsDelim = !!tail && tail.type === 'delim';
  // BOUNDARY: fragment start, a whitespace char, or a pending emphasis delimiter run (the emphasis
  // inner-content case). Otherwise decline (a finished raw/hashed or plain-text tail is not a boundary).
  if (pos !== 0 && !prevWs && !tailIsDelim) { return null; }

  // Username: `@([a-z\d]+(?:[a-z\d._-]+?[a-z\d]+)*)` anchored at the cursor (sticky), same match set
  // as the historic pass — the boundary is handled above rather than in a capture group.
  let reUser = /@([a-z\d]+(?:[a-z\d._-]+?[a-z\d]+)*)/yi;
  reUser.lastIndex = pos;
  let m = reUser.exec(str);
  if (!m) { return null; }
  let username = m[1],
      mentions = m[0]; // `@` + username

  // check if options.ghMentionsLink is a string
  // TODO Validation should be done at initialization not at runtime
  if (!showdown.helper.isString(options.ghMentionsLink)) {
    throw new Error('ghMentionsLink option must be a string');
  }
  // Gate 6: cmSpec pins the CommonMark href policy (CM_GFM_ANCHOR_URL_POLICY — safeMode,
  // cmNormalizeURL and the quote/angle attribute escape all skipped); the Showdown flavors reuse
  // the legacy link.js policy (LEGACY_ANCHOR_URL_POLICY) so these anchors stay byte-identical to
  // the non-cmSpec path. Matches the engine's former anchorUrlPolicy selection.
  let policy = options.cmSpec ? showdown.helper.CM_GFM_ANCHOR_URL_POLICY : showdown.helper.LEGACY_ANCHOR_URL_POLICY;
  let url = options.ghMentionsLink.replace(/\{u}/g, username);
  // wholeMatch mirrors the old pass's group 0 (`st + mentions`) so a listener reading `_wholeMatch`
  // sees the same value: `st` is the whitespace boundary char when the boundary was whitespace, else ''.
  let st = prevWs ? prev : '';
  // writeAnchorTag returns an already-hashed ¨C<n>C placeholder; append it raw (final, no re-escape).
  let anchor = showdown.helper.writeAnchorTag('reference', reUser, st + mentions, mentions, null, url, undefined, undefined, options, globals, policy);
  scan.appendRaw(anchor);
  return pos + mentions.length;
});

// INTERNAL helper — links mentions in a resolved wrapper span's already-rendered inner content (see
// the file docblock). Called only by strikethrough.js's buildDel (a `<del>` is resolved from
// `tilde` nodes at pairing time, so the `delim`-keyed scan boundary never fired inside it); emphasis
// and underline link their inner during the scan and never call this. It is the historic post-scan
// ghMentions pass verbatim — the same `(^|\s)` fragment-boundary regex over the rendered inner string
// — so a resolved `<del>` links exactly as it did before ghMentions moved into the scan. Real links /
// images / code spans in the inner are already hashed, so they are protected from the regex.
showdown.subParser('makehtml.inline.ghMentions.linkify', function (text, options, globals) {
  'use strict';

  if (!options.ghMentions) {
    return text;
  }
  // Gate 6 (see the scan handler): cmSpec pins the CommonMark href policy; the Showdown flavors reuse
  // the legacy link.js policy so these anchors stay byte-identical to the non-cmSpec path.
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
