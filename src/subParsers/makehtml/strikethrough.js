/**
 * @file      makehtml/strikethrough.js
 * @summary   Converts GFM `~`/`~~` strikethrough runs into `<del>`, gated by `strikethrough`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Scan-native: strikethrough is recognized directly by the single-pass inline scan in spanGamut.js —
 * there is no whole-text pass form any more, and the onStart/onEnd lifecycle is retired per the
 * event-contract amendment (the inline-pass lifecycle belongs to spanGamut, which owns
 * `makehtml.spanGamut.onStart/onEnd`). The construct emits only capture/hash per resolved run
 * (`makehtml.strikethrough.onCapture` / `.onHash`).
 *
 * Two registrations:
 *   - `makehtml.inline.strikethrough` — the `~` scan handler that consumes a tilde run into a
 *     delimiter-like node on the scan's node list;
 *   - `makehtml.inline.strikethrough.pair` — the pairing pass that reproduces the historical
 *     whole-text regex on the SURVIVING tilde-run nodes, run AFTER emphasis resolution so emphasis
 *     wins a crossed `~`/`*` boundary exactly as the serialized pass did (the tildes swallowed inside
 *     a resolved emphasis span are no longer on the list). Because the scan resolves runs before
 *     link/image bracket resolution, strikethrough now applies inside resolving link/image labels for
 *     every flavor (the former cmSpec literal-label behavior was a pipeline artifact of running after
 *     link hashing, not a rule).
 */

// The `~` scan handler for the unified inline scanner in spanGamut.js (scan-state convention — see
// entity.js). It consumes the whole tilde run at scan.pos and appends it as a DELIMITER-LIKE node
// (`tilde: true`, `tlen`) on the node list, returning the new cursor. It never declines: like the
// `*`/`_` emphasis handler, a tilde run is always consumed, to be paired (or left literal) later by
// the pairing pass below. The node renders as its literal tildes when it stays unpaired.
// eslint-disable-next-line no-unused-vars -- `options`/`globals` unused but kept for the makehtml.inline.* (scan, options, globals) convention
showdown.subParser('makehtml.inline.strikethrough', function (scan, options, globals) {
  'use strict';
  let str = scan.str,
      len = str.length,
      start = scan.pos,
      i = start;
  while (i < len && str.charAt(i) === '~') { ++i; }
  scan.list.appendNode({type: 'text', literal: str.slice(start, i), tilde: true, tlen: i - start});
  return i;
});

// The pairing pass for the scan-native strikethrough (aux-builder convention, signature
// (scan, options, globals, fromNode, toNode, applyGfm)). NOT dispatched by the scanner's
// character loop — it is invoked AFTER emphasis resolution at the three places the retired serialized
// pass's effects were visible: (a) at scan end, on the whole list (spanGamut.js); (b) inside a
// resolving emphasis span, on its inner node range (emphasis.js's build, so `**~~x~~**` still
// strikes); and (c) in link.js's close-bracket resolution, scoped to the resolving label's node
// range (so a label strikes for every flavor). Because it runs after processEmphasis, a tilde run
// swallowed by an emphasis span is no longer in the list and is skipped at scan end — so a crossed
// `~`/`*` boundary lets emphasis win, exactly like the serialized regex (which never saw the tildes
// hashed inside a resolved emphasis span).
//
// It reproduces the historical whole-text strikethrough regex on the surviving tilde-run nodes in
// [fromNode, toNode): walk them left to right; an opener is a run of length 1 or 2 whose following
// content starts non-space-non-tilde; its closer is the NEAREST later surviving run of the SAME
// length whose preceding content ends non-space-non-tilde (lazy leftmost, like the /g regex —
// after a pair, scanning continues past the closer). The `(^|[^~])` / `\2(?!~)` guards are inherent
// (a tilde node consumes the whole run, so runs are never adjacent). Runs of 3+ tildes are neither
// opener nor closer (length never matches 1/2) and render literal. Adjacency reads the neighbor
// NODES' edge char (a hashed placeholder reads as `¨`/alnum, i.e. non-space-non-tilde, matching how
// the regex saw placeholder chars; see the raw-literal note on `flank` below). On a pair the inner
// nodes are rendered, the same capture/hash event flow the old pass used runs, and the consumed range
// is spliced to one raw node holding scan.hashSpan of the `<del>`. When `applyGfm` is set, buildDel
// also links `@mentions` in the resolved inner via the `makehtml.inline.ghMentions.linkify` helper
// (see ghMentions.js) — a `<del>` is resolved from `tilde` nodes, so the scan's mention boundary
// never fired inside it, and this restores `~~@user~~` -> `<del><a>@user</a></del>`.
showdown.subParser('makehtml.inline.strikethrough.pair', function (scan, options, globals, fromNode, toNode, applyGfm) {
  'use strict';

  // the regex's `[^\s~]` inner-flank test. The neighbor NODES are never tilde runs (a tilde run
  // node consumes the whole run, so runs are never adjacent) and text nodes never contain `~` (the
  // scan breaks its plain-text runs at `~`), so a raw-literal edge char decides flanking exactly as
  // the escaped serialized form the regex saw would (HTML-escaping neither adds nor removes edge
  // whitespace, and preserves non-space-ness), without paying for a render per lookup.
  function flank (ch) { return ch !== '' && ch !== '~' && !/\s/.test(ch); }
  function edgeChar (n, atEnd) {
    let l = n.literal;
    return (l && l.length) ? l.charAt(atEnd ? l.length - 1 : 0) : '';
  }

  // Single forward pass over the range: collect the tilde-run nodes and, for each, the flanking
  // chars of its surviving neighbors — `before` (last non-empty edge char to its left, for the
  // closer test) and `after` (first non-empty edge char to its right, for the opener test). These
  // read the ORIGINAL adjacent content; a later del splice only rewires boundary pointers, never a
  // content node's literal, so the precomputed chars stay valid through pairing (which lets the
  // resolution stay linear instead of re-deriving adjacency per candidate).
  let nodes = [];
  for (let n = fromNode; n !== null && n !== toNode; n = n.next) { nodes.push(n); }
  let tnodes = [];
  let prevChar = '';
  for (let p = 0; p < nodes.length; p++) {
    let n = nodes[p];
    if (n.tilde) { tnodes.push({node: n, tlen: n.tlen, before: prevChar, after: ''}); }
    let e = edgeChar(n, true);
    if (e !== '') { prevChar = e; }
  }
  let k = tnodes.length;
  if (k < 2) { return; }
  // fill `after` with a backward sweep over the same nodes
  let nextChar = '', ti = k - 1;
  for (let p = nodes.length - 1; p >= 0 && ti >= 0; p--) {
    let n = nodes[p];
    if (n === tnodes[ti].node) { tnodes[ti].after = nextChar; ti--; }
    let e = edgeChar(n, false);
    if (e !== '') { nextChar = e; }
  }

  // Nearest same-length valid closer at or after each index, per run length (1 and 2). A valid
  // closer is a length-1/2 run whose preceding content ends non-space-non-tilde.
  let nc1 = new Array(k + 1), nc2 = new Array(k + 1);
  nc1[k] = -1; nc2[k] = -1;
  for (let p = k - 1; p >= 0; p--) {
    let t = tnodes[p], closes = flank(t.before);
    nc1[p] = (closes && t.tlen === 1) ? p : nc1[p + 1];
    nc2[p] = (closes && t.tlen === 2) ? p : nc2[p + 1];
  }

  // Lazy leftmost pairing: for each valid opener take the nearest same-length valid closer after it,
  // then continue past the closer (mirroring the /g regex). Runs of 3+ are neither opener nor closer.
  let i = 0;
  while (i < k) {
    let op = tnodes[i];
    if ((op.tlen === 1 || op.tlen === 2) && flank(op.after)) {
      let j = (op.tlen === 1) ? nc1[i + 1] : nc2[i + 1];
      if (j !== -1) { buildDel(op.node, tnodes[j].node); i = j + 1; continue; }
    }
    i++;
  }

  function buildDel (opener, closer) {
    let inner = scan.renderNodes(opener.next, closer);
    // Mirror where the serialized pass ran relative to the GFM overlay: it had already run on the
    // text by the time the strikethrough pass wrapped it. Since this <del> is hashed below (hidden
    // from that later pass), re-apply it on the inner here — gated to the caller's context (a <del>
    // inside a link must not linkify). ghMentions is scan-native now, but a `<del>` is resolved from
    // `tilde` nodes at pairing time, so the scan's `delim`-keyed boundary never linked mentions inside
    // it (unlike emphasis/underline, which link their inner during the scan); link them here on the
    // resolved inner via the ghMentions inner-content helper, so `~~@user~~` -> `<del><a>@user</a></del>`
    // exactly as before. Order matches the historic overlay (ghMentions then naked URL/mail). Emoji is
    // scan-native: `:name:` inside the tilde run was substituted inline before this pairing pass
    // rendered the inner nodes, so it needs no re-apply here. hardLineBreaks always applies (below,
    // via the capture flow).
    if (applyGfm) {
      inner = showdown.subParser('makehtml.inline.ghMentions.linkify')(inner, options, globals);
      inner = scan.applyGfmInlineLinks(inner);
    }

    let marker = '~'.repeat(opener.tlen),
        wholeMatch = marker + inner + marker,
        otp;
    let capture = showdown.Event.dispatchCapture('makehtml.strikethrough.onCapture', inner, {
      regexp: null,
      matches: {_wholeMatch: wholeMatch, text: inner},
      attributes: {}
    }, options, globals);
    if (capture.output && capture.output !== '') {
      otp = capture.output;
    } else {
      otp = '<del' + showdown.helper._populateAttributes(capture.attributes) + '>' +
            showdown.subParser('makehtml.hardLineBreaks')(capture.matches.text, options, globals) +
            '</del>';
    }
    let hash = showdown.Event.dispatchHash('makehtml.strikethrough.onHash', otp, options, globals);
    let hashed = scan.hashSpan(hash.output);

    // splice [opener .. closer] -> one raw node holding the hashed <del> (drop inner delimiters
    // from the stack, mirroring processEmphasis's inner cleanup)
    for (let n = opener.next; n !== null && n !== closer; n = n.next) {
      if (n.type === 'delim') { scan.list.removeDelimiter(n); }
    }
    let wrapNode = {type: 'text', literal: hashed, raw: true, prev: opener.prev, next: closer.next};
    if (opener.prev) { opener.prev.next = wrapNode; } else { scan.list.head = wrapNode; }
    if (closer.next) { closer.next.prev = wrapNode; } else { scan.list.tail = wrapNode; }
  }
});
