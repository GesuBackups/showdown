/**
 * @file      makehtml/spanGamut.js
 * @summary   The unified inline engine (the span gamut): pipeline + single-pass CommonMark inline scan.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The inline layer for every flavor. It runs a short pipeline — `underline`, then a single-pass
 * scan, then the Showdown-only extras (emoji, strikethrough) and the final
 * hashing/encoding passes. The scan resolves code spans, backslash escapes, character references,
 * autolinks, raw HTML, links, images and emphasis together on one delimiter stack, so the
 * cross-construct precedence rules CommonMark requires — a link cannot contain a link; code spans /
 * autolinks / raw HTML bind before links; emphasis interleaves with link brackets — are
 * expressible. The documented vanilla/original vs CommonMark divergences are option gates inside
 * the scan. Built on the `DelimiterStack` engine folded into this file below — the doubly-linked
 * node list + delimiter stack + processEmphasis machinery — since the unified scan is now its sole
 * consumer.
 *
 * spanGamut was previously taxonomized as an event-less dispatcher; it is now the inline engine and
 * owns the inline-pass lifecycle, emitting the `makehtml.spanGamut` onStart/onEnd events. The
 * links, images, code spans and emphasis/strong spans it builds emit their own `makehtml.link.*` /
 * `makehtml.image.*` / `makehtml.codeSpan.*` / `makehtml.emphasis.*` / `makehtml.strong.*` capture
 * families, so listener extensions behave identically across flavors.
 */

/* jshint esnext: false, esversion: 9 */

// ---- DelimiterStack: the engine's node-list / delimiter machinery ----------------
//
// The doubly-linked node list + CommonMark emphasis delimiter stack + flanking computation +
// processEmphasis (spec §6.2). This used to be a shared `showdown.helper.DelimiterStack` when two
// inline paths (the legacy emphasisAndStrong pass and the CommonMark cmInline pass) both drove it;
// it was folded in here as an engine-internal constructor once the unified scan below became its
// sole creator. Not registered on `showdown.helper`; the scan calls `new DelimiterStack()` directly.
// The construct handlers under `makehtml.inline.*` touch a live instance through `scan.list` at call
// time, so nothing outside this file needs to name the constructor.
//
// The flanking character classifiers it leans on (`showdown.helper.isAsciiPunct`/`isPunct`/
// `isWhitespace`) stay in helpers/commonmark.js and are read at call time inside the methods.

// A backslash-escaped punctuation char can reach the flanking classifier as the `¨E<code>E`
// placeholder; the classifier must treat a side that abuts one as a word character (see pushDelim's
// `placeholderAsWord`). Sticky so the after-side test can anchor at the scan cursor without
// slicing the string.
const cmEscapePlaceholder = /¨E\d+E/y;

/**
 * A doubly-linked list of inline nodes plus the CommonMark emphasis delimiter stack.
 * The unified inline scan builds one of these, feeds it text / delimiter runs, runs
 * `processEmphasis`, then renders the surviving nodes.
 * @constructor
 */
function DelimiterStack () {
  this.head = null;
  this.tail = null;
  this.delimiters = null; // top of the emphasis delimiter stack
}

DelimiterStack.prototype = {

  /**
   * Append an already-built node to the tail of the list.
   * @param {{}} node
   * @returns {{}} the appended node
   */
  appendNode: function (node) {
    node.prev = this.tail;
    node.next = null;
    node.raw = node.raw || false;
    if (this.tail) { this.tail.next = node; } else { this.head = node; }
    this.tail = node;
    return node;
  },

  /**
   * Append a text node.
   * @param {string} literal
   * @returns {{}}
   */
  appendText: function (literal) {
    return this.appendNode({type: 'text', literal: literal});
  },

  /**
   * Append already-final HTML that must not be escaped at render time.
   * @param {string} html
   * @returns {{}}
   */
  appendRaw: function (html) {
    return this.appendNode({type: 'text', literal: html, raw: true});
  },

  /**
   * Tokenize a run of `*`/`_` delimiters (`str.slice(start, i)`), compute its flanking
   * (canOpen/canClose) and push it onto both the node list and the delimiter stack.
   * When `resolveSentinels` is set, `$`/`¨` hidden behind the `¨D`/`¨T` sentinels are
   * resolved before the flanking lookaround reads the adjacent characters (the scan runs
   * after the converter's sentinel swap).
   * @param {string} str
   * @param {number} start index of the first delimiter char
   * @param {number} i index just past the last delimiter char
   * @param {string} ch the delimiter character (`*` or `_`)
   * @param {boolean} [resolveSentinels]
   * @param {boolean} [starRuleForUnderscore] when set, an `_` run uses the looser `*`
   *   open/close flanking rule (Showdown intraword emphasis) instead of the CommonMark `_`
   *   rule. The scan passes this for the Showdown flavors; the cmSpec paths never do.
   * @param {boolean} [placeholderAsWord] when set, a side whose adjacent text is a
   *   backslash-escape placeholder (`¨E<code>E`) is classified as a word character rather than
   *   whitespace/punctuation, so emphasis opens/closes against an escaped delimiter the way the
   *   legacy regex path did (e.g. `word_\_x\__` -> `word<em>_x_</em>`). The scan passes this for
   *   the Showdown flavors; the cmSpec paths leave it unset.
   * @returns {{}} the appended delimiter node
   */
  pushDelim: function (str, start, i, ch, resolveSentinels, starRuleForUnderscore, placeholderAsWord) {
    let len = str.length,
        run = str.slice(start, i),
        before = (start === 0) ? undefined : str.charAt(start - 1),
        after = (i >= len) ? undefined : str.charAt(i);
    if (resolveSentinels) {
      // `$` and `¨` are swapped for the two-char placeholders `¨D`/`¨T` before inline
      // parsing (see converter.js) and only restored at the end. Resolve them here so
      // flanking sees the real adjacent character rather than the placeholder's
      // trailing/leading letter (e.g. the `D` of `¨D` would otherwise read as a letter).
      if ((before === 'D' || before === 'T') && str.charAt(start - 2) === '¨') {
        before = (before === 'D') ? '$' : '¨';
      }
      if (after === '¨' && (str.charAt(i + 1) === 'D' || str.charAt(i + 1) === 'T')) {
        after = (str.charAt(i + 1) === 'D') ? '$' : '¨';
      }
    }
    if (placeholderAsWord) {
      // A backslash-escaped punctuation char (`\_`, `\*`, ...) is a literal that the legacy regex
      // emphasis treated as an ordinary word character (it ran after the `\X` -> `¨E<code>E`
      // escape swap and saw the placeholder's letters/digits). The scan still holds the raw `\X`
      // at this point, so the leading `\` (before the after-side char) or the escaped char itself
      // (on the before-side) would classify the touching side as punctuation and suppress
      // flanking. Treat a side that abuts such an escape — or, defensively, an already-substituted
      // `¨E<code>E` placeholder — as a word char before the whitespace/punctuation tests read it.
      cmEscapePlaceholder.lastIndex = i;
      if ((after === '\\' && showdown.helper.isAsciiPunct(str.charAt(i + 1))) || cmEscapePlaceholder.test(str)) {
        after = 'a';
      }
      if ((showdown.helper.isAsciiPunct(before) && str.charAt(start - 2) === '\\') ||
          (start > 0 && /¨E\d+E$/.test(str.slice(Math.max(0, start - 12), start)))) {
        before = 'a';
      }
    }
    let beforeWs = showdown.helper.isWhitespace(before),
        afterWs = showdown.helper.isWhitespace(after),
        beforePt = showdown.helper.isPunct(before),
        afterPt = showdown.helper.isPunct(after),
        leftFlanking = !afterWs && (!afterPt || beforeWs || beforePt),
        rightFlanking = !beforeWs && (!beforePt || afterWs || afterPt),
        canOpen, canClose;
    if (ch === '_' && !starRuleForUnderscore) {
      canOpen = leftFlanking && (!rightFlanking || beforePt);
      canClose = rightFlanking && (!leftFlanking || afterPt);
    } else {
      // `*` always uses this rule; `_` uses it too when starRuleForUnderscore is set (the
      // Showdown intraword-emphasis flavor gate).
      canOpen = leftFlanking;
      canClose = rightFlanking;
    }
    let node = this.appendNode({type: 'delim', cc: ch, literal: run, numdelims: run.length, origdelims: run.length, canOpen: canOpen, canClose: canClose});
    node.delimPrev = this.delimiters;
    node.delimNext = null;
    if (this.delimiters) { this.delimiters.delimNext = node; }
    this.delimiters = node;
    return node;
  },

  /**
   * Unlink a delimiter node from the delimiter stack (the node stays in the text list).
   * @param {{}} d
   */
  removeDelimiter: function (d) {
    if (d.delimPrev) { d.delimPrev.delimNext = d.delimNext; }
    if (d.delimNext) { d.delimNext.delimPrev = d.delimPrev; } else { this.delimiters = d.delimPrev; }
  },

  /**
   * Splice `newNode` into the text list immediately after `node`.
   * @param {{}} node
   * @param {{}} newNode
   */
  insertAfter: function (node, newNode) {
    newNode.prev = node;
    newNode.next = node.next;
    if (node.next) { node.next.prev = newNode; } else { this.tail = newNode; }
    node.next = newNode;
  },

  /**
   * Drop every delimiter at or above `bottom` from the stack (after a bracket span
   * has consumed the nodes they pointed at).
   * @param {{}|null} bottom
   */
  pruneDelimiters: function (bottom) {
    let d = this.delimiters;
    while (d !== null && d !== bottom) {
      let p = d.delimPrev;
      this.removeDelimiter(d);
      d = p;
    }
  },

  /**
   * Truncate the text list, dropping `node` and everything after it.
   * @param {{}} node
   */
  removeFrom: function (node) {
    this.tail = node.prev;
    if (this.tail) { this.tail.next = null; } else { this.head = null; }
  },

  /**
   * Concatenate the rendered output of nodes `[from .. to)`.
   * @param {{}|null} from
   * @param {{}|null} to
   * @param {function({}):string} renderNode
   * @returns {string}
   */
  renderRange: function (from, to, renderNode) {
    let out = '';
    for (let n = from; n !== null && n !== to; n = n.next) { out += renderNode(n); }
    return out;
  },

  /**
   * Concatenate the rendered output of the whole list.
   * @param {function({}):string} renderNode
   * @returns {string}
   */
  renderList: function (renderNode) {
    return this.renderRange(this.head, null, renderNode);
  },

  /**
   * The CommonMark `process_emphasis` reference algorithm (spec §6.2). Walks the
   * delimiter stack from `stackBottom` (exclusive; `null` = the whole stack), pairing
   * openers with closers and wrapping the enclosed nodes.
   *
   * The scan injects its two hooks:
   *  - `buildWrapped(tagOpen, tagClose, opener, closer)` renders the enclosed nodes and
   *    returns the final (usually hashed) wrapped literal — this is where the scan runs its
   *    GFM-inline-links pass + emoji/strikethrough over the inner content.
   *  - `rawWrap` marks the spliced-in wrap node as raw (the scan renders raw nodes verbatim).
   * @param {{}|null} stackBottom
   * @param {function(string, string, {}, {}):string} buildWrapped
   * @param {boolean} [rawWrap]
   */
  processEmphasis: function (stackBottom, buildWrapped, rawWrap) {
    let openersBottom = {
      '_': [stackBottom, stackBottom, stackBottom],
      '*': [stackBottom, stackBottom, stackBottom]
    };

    // start from the bottom-most delimiter above stackBottom
    let closer = this.delimiters;
    while (closer !== null && closer.delimPrev !== null && closer.delimPrev !== stackBottom) {
      closer = closer.delimPrev;
    }
    if (closer === stackBottom) { closer = (stackBottom === null) ? closer : stackBottom.delimNext; }

    while (closer !== null) {
      if (!closer.canClose) { closer = closer.delimNext; continue; }
      let opener = closer.delimPrev,
          openerFound = false,
          oddMatch;
      while (opener !== null && opener !== stackBottom && opener !== openersBottom[closer.cc][closer.origdelims % 3]) {
        oddMatch = (closer.canOpen || opener.canClose) &&
                   (closer.origdelims % 3 !== 0) &&
                   ((opener.origdelims + closer.origdelims) % 3 === 0);
        if (opener.cc === closer.cc && opener.canOpen && !oddMatch) { openerFound = true; break; }
        opener = opener.delimPrev;
      }
      let oldCloser = closer;

      if (openerFound) {
        let use = (opener.numdelims >= 2 && closer.numdelims >= 2) ? 2 : 1,
            tagOpen = (use === 2) ? '<strong>' : '<em>',
            tagClose = (use === 2) ? '</strong>' : '</em>';

        // trim consumed delimiters from the opener (end) and closer (start) literals
        opener.literal = opener.literal.slice(0, opener.literal.length - use);
        opener.numdelims -= use;
        closer.literal = closer.literal.slice(use);
        closer.numdelims -= use;

        let wrapped = buildWrapped(tagOpen, tagClose, opener, closer);

        // remove inner nodes and their delimiters from the lists
        let n2 = opener.next;
        while (n2 !== null && n2 !== closer) {
          let nx = n2.next;
          if (n2.type === 'delim') { this.removeDelimiter(n2); }
          n2 = nx;
        }
        // splice in a single text node holding the wrapped result
        let wrapNode = {type: 'text', literal: wrapped, raw: !!rawWrap};
        this.insertAfter(opener, wrapNode);
        wrapNode.next = closer;
        closer.prev = wrapNode;

        if (opener.numdelims === 0) { opener.literal = ''; this.removeDelimiter(opener); }
        if (closer.numdelims === 0) {
          closer.literal = '';
          let tmp = closer.delimNext;
          this.removeDelimiter(closer);
          closer = tmp;
        }
      } else {
        openersBottom[oldCloser.cc][oldCloser.origdelims % 3] = oldCloser.delimPrev;
        if (!oldCloser.canOpen) { this.removeDelimiter(oldCloser); }
        closer = oldCloser.delimNext;
      }
    }
  }
};

// The inline engine (the span gamut): a short pipeline wrapped around a single-pass CommonMark
// inline scan. It owns the inline-pass lifecycle (makehtml.spanGamut onStart/onEnd) — it is no
// longer the event-less dispatcher it once was.
showdown.subParser('makehtml.spanGamut', function (text, options, globals) {
  'use strict';

  // Underline (option) is scan-native: the scan hands each `_` run to the underline handler FIRST
  // (before emphasis) so it either claims a `__`/`___` region as `<u>` — rendering the inner via a
  // nested sub-scan — or consumes the run as inert literal text, never letting `_` reach the emphasis
  // stack (reproducing the retired whole-text pass's "escape every remaining `_`" rule, without
  // escaping the underscores inside protected constructs the pass used to corrupt). `*` is unaffected.
  const underlineOn = !!options.underline;

  // Scan triggers for the atomic-token recognizers (consumeEmoji / naked URL). Kept as
  // locals so the tokenizer's hot loop only tests them when the relevant option is enabled.
  // autoLink is `!cmSpec`-gated: under cmSpec/gfm the CommonMark flanking rules already leave
  // URL underscores intact, so the Showdown-only recognizer is unnecessary there and skipping
  // it keeps cmSpec output byte-identical by construction.
  // Emoji (option) is scan-native: the scan performs the `:name:` SUBSTITUTION inline for every
  // flavor, before link/image bracket resolution and emphasis/strikethrough pairing (so it applies
  // inside resolving labels and spans too). Not `!cmSpec`-gated — like ellipsis/strikethrough the
  // substitution is flavor-independent (the retired whole-text pass handled cmSpec post-scan).
  const emojiOn = !!options.emoji,
      autoLinkOn = !options.cmSpec && !!options.simplifiedAutoLink,
      // Ellipsis (option) is scan-native: the scan consumes `...` -> `…` inline for every flavor,
      // before link/image bracket resolution (so it applies inside resolving labels too). Unlike
      // emoji/autolink this is NOT `!cmSpec`-gated — the ellipsis substitution is flavor-independent.
      ellipsisOn = !!options.ellipsis,
      // Strikethrough (option) is scan-native: the scan consumes `~` runs as delimiter-like nodes and
      // a pairing pass (run AFTER emphasis resolution, see strikethrough.js) reproduces the historical
      // whole-text regex. Not `!cmSpec`-gated — like ellipsis it is flavor-independent (strikethrough
      // is off by default under cmSpec, but when enabled it pairs the same way, which is what lets the
      // label-range pairing in link.js apply for every flavor).
      strikethroughOn = !!options.strikethrough,
      // ghMentions (option) is scan-native: the scan hands each `@` to the ghMentions handler, which
      // links `@username` inline (before emphasis/bracket resolution) or declines to plain text. See
      // ghMentions.js for the boundary/bracket rules. There is no post-scan mention pass any more.
      ghMentionsOn = !!options.ghMentions;

  let startEvent = showdown.Event.dispatchStart('makehtml.spanGamut.onStart', text, options, globals);
  text = startEvent.output;

  text = parseCmInline(text);

  // simplifiedAutoLink (GFM extension) is applied to the serialized inline output and to emphasis
  // inner content (see parseCmInline) so naked URLs / mail inside emphasis are linked too. Real
  // links, images and code spans are hashed by parseCmInline, so they are protected from this
  // regex. The pass lives in its own construct subparser (nakedUrl.js) and emits its anchors
  // through the shared showdown.helper.* GFM anchor machinery, same as link.js. (ghMentions is now
  // scan-native — resolved during parseCmInline — so it is no longer part of this overlay.)
  text = applyGfmInlineLinks(text);

  function applyGfmInlineLinks (text) {
    // Handle naked links / mail (if option is enabled)
    text = showdown.subParser('makehtml.inline.nakedUrl.linkify')(text, options, globals);
    return text;
  }

  let afterEvent = showdown.Event.dispatchEnd('makehtml.spanGamut.onEnd', text, options, globals);
  text = afterEvent.output;

  // Emoji and strikethrough are scan-native now (resolved during parseCmInline — emoji is substituted
  // inline, strikethrough by the pairing pass; see the scan-end call below), so there are no whole-text
  // emoji / strikethrough passes here any more.

  // ---- serialized-text tail: a three-pass epilogue (F7 audit: all three live, none removable) -------
  //
  // 1. hashHTMLSpans — kept for the EVENT CONTRACT, not for the fixtures. Every HTML span the scan's own
  //    constructs emit is already hashed in-scan via scan.hashSpan (link / image / codeSpan / rawHtml /
  //    autolink, plus the extras: strikethrough's `<del>`, image-emoji's `<img>`, underline's `<u>`,
  //    emphasis / strong), and nakedUrl.linkify hashes its anchors inside writeAnchorTag — so NO fixture
  //    reaches here carrying raw `<tag>…</tag>` (removing this pass is byte-identical across every fixture
  //    and both byte-identity docs). Its sole remaining feeder is LISTENER OUTPUT: a listener on
  //    makehtml.spanGamut.onEnd (dispatched just above) may append raw HTML to `text`, which must be
  //    hash-protected here before encodeAmpsAndAngles escapes its `<`/`>`/`&`. That event surface is not
  //    exercised by the fixtures, so the pass stays to honor the contract.
  text = showdown.helper.hashHTMLSpans(text, options, globals);

  // 2. encodeAmpsAndAngles — live. Text nodes were already entity-escaped at render time (renderNode
  //    runs escapeHTMLEntities on every non-raw node), so this acts on RAW-node content: the nakedUrl
  //    scan recognizer appends a bare URL run verbatim (with a literal `&`), and when nakedUrl.linkify
  //    declines to link it that `&` must be encoded to `&amp;` here (this also covers bare `&`/`<`/`>`
  //    in listener output).
  text = showdown.helper.encodeAmpsAndAngles(text, options, globals);

  // 3. hardLineBreaks (trailing pass) — live and fixture-exercised. The in-scan hardBreak handler only
  //    emits `<br />` for `  \n` / `\\\n`; the GFM `simpleLineBreaks` option turns every remaining soft
  //    `\n` into `<br />`, which only this trailing pass does (the simpleLineBreaks fixtures depend on it).
  text = showdown.subParser('makehtml.hardLineBreaks')(text, options, globals);

  return text;

  // ---- shared character helpers ------------------------------------------------

  function hashSpan (html) {
    return showdown.helper._hashHTMLSpan(html, globals);
  }

  // resolve backslash escapes of ASCII punctuation to the literal character
  function resolveBackslash (str) {
    return str.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  }

  // ---- main parse --------------------------------------------------------------

  function parseCmInline (str) {
    // The doubly-linked node list + emphasis delimiter stack live on the engine's DelimiterStack
    // (folded into this file above); the bracket (link/image) stack is specific to this
    // unified parser and lives on scan.brackets (the backtick no-closer memo lives on scan.memos).
    let stack = new DelimiterStack();

    function appendText (literal) {
      return stack.appendText(literal);
    }
    // append already-final HTML that must not be escaped at render time
    function appendRaw (html) {
      return stack.appendRaw(html);
    }
    // Run a FRESH nested inline scan over `sliceStr` and return its rendered HTML. Engine
    // primitive for constructs (e.g. underline) that resolve a syntactic region and then need
    // its inner Markdown scanned in isolation. The nested scan gets its own node list, delimiter
    // stack, bracket stack and memos; it runs the same scan CORE only — no pipeline extras, no
    // GFM overlay, no lifecycle events — so it terminates (the slice is strictly shorter than the
    // region that produced it) and stays free of the outer pass's side effects.
    function subParse (sliceStr) {
      return parseCmInline(sliceStr);
    }
    // render one node: raw nodes emit verbatim, text nodes are HTML-escaped
    function renderNode (n) {
      return n.raw ? n.literal : showdown.helper.escapeHTMLEntities(n.literal);
    }

    // The scan state handed to every `makehtml.inline.*` construct subparser. These are the
    // single-pass scanner's internals — one string, one cursor, one output node list — bundled
    // so each construct can live in its own file (the calling convention of the
    // `makehtml.inline.*` namespace: (scan, options, globals) instead of (text, options, globals),
    // because a text->text pass cannot express cross-construct precedence). A construct either
    // consumes — appends its output and returns the new cursor index — or declines by returning
    // null, and the scanner falls through.
    let scan = {
      str: str,
      pos: 0,
      appendText: appendText,
      appendRaw: appendRaw,
      subParse: subParse,   // run a fresh nested inline scan over a slice, returning rendered HTML
      hashSpan: hashSpan,   // hash a finished HTML span to a ¨C<n>C placeholder
      list: stack,          // the output node list (constructs may inspect/adjust the tail, e.g. hard breaks trimming trailing spaces)
      memos: {},
      renderNodes: renderNodes,               // render nodes [from..to) via the engine's renderNode
      processEmphasis: processEmphasis,       // resolve emphasis above a stack bottom (delimiter algorithm)
      applyGfmInlineLinks: applyGfmInlineLinks, // the post-scan GFM overlay (naked URL/mail linkify)
      normalizeDest: normalizeDest,           // shared link/image destination normalization (safeMode-independent part)
      buildTitleAttr: buildTitleAttr,         // shared title attribute builder
      brackets: null                          // head of the open [ / ![ bracket stack (link/image)
    };

    const len = str.length;
    let i = 0;
    while (i < len) {
      let ch = str.charAt(i);

      if (ch === '\n') {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.hardBreak')(scan, options, globals);
        continue;
      }

      if (ch === '\\') {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.backslash')(scan, options, globals);
        if (e !== null) { i = e; continue; }
        appendText('\\');
        i++;
        continue;
      }

      if (ch === '`') {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.codeSpan')(scan, options, globals);
        continue;
      }

      if (ch === '<') {
        // Ordered `<` dispatch (spec-fixed try order): the Showdown whole-`<a>` swallow first
        // (so an anchor's inner text is never re-linked), then autolinks, then a single raw-HTML
        // tag; on decline of all three the `<` is literal text.
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.rawHtml.wholeAnchor')(scan, options, globals);
        if (e === null) { e = showdown.subParser('makehtml.inline.autolink')(scan, options, globals); }
        if (e === null) { e = showdown.subParser('makehtml.inline.rawHtml')(scan, options, globals); }
        if (e !== null) { i = e; continue; }
        appendText('<');
        i++;
        continue;
      }

      if (ch === '&') {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.entity')(scan, options, globals);
        if (e !== null) { i = e; continue; }
        appendText('&');
        i++;
        continue;
      }

      if (ch === '!' && str.charAt(i + 1) === '[') {
        let node = appendText('![');
        pushBracket(node, true, i + 2, i);
        i += 2;
        continue;
      }
      if (ch === '[') {
        let node = appendText('[');
        pushBracket(node, false, i + 1, i);
        i++;
        continue;
      }
      if (ch === ']') {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.link')(scan, options, globals);
        continue;
      }

      // Underline (option): an `_` run is handed to the underline handler FIRST — it either claims a
      // `__`/`___` region as `<u>` (rendering the inner via a nested sub-scan) or consumes the run as
      // inert literal text, never falling through to emphasis (reproducing the retired pass's "escape
      // every remaining `_`" rule). `*` is unaffected and always reaches the emphasis handler.
      if (ch === '_' && underlineOn) {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.underline')(scan, options, globals);
        continue;
      }

      if (ch === '*' || ch === '_') {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.emphasis')(scan, options, globals);
        continue;
      }

      // Emoji shortcodes (option): substitute a known `:name:` inline (so the `_`/`*` inside an
      // emoji name, e.g. `:couplekiss_man_woman:`, never become emphasis delimiters). Because this
      // resolves before bracket/emphasis/strikethrough pairing, emoji inside resolving labels and
      // spans is substituted too. `:name:` inside a code span is already protected (backticks are
      // consumed above before we reach here).
      if (emojiOn && ch === ':') {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.emoji')(scan, options, globals);
        if (e !== null) { i = e; continue; }
      }

      // Ellipsis (option): consume a literal `...` at the cursor as the ellipsis character `…`
      // (or a listener's output) before the plain-text run swallows the dots.
      if (ellipsisOn && ch === '.') {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.ellipsis')(scan, options, globals);
        if (e !== null) { i = e; continue; }
      }

      // Strikethrough (option, staged): consume the whole `~` run at the cursor as a delimiter-like
      // node (always consumes, never declines — like the `*`/`_` emphasis handler); the pairing pass
      // resolves runs into `<del>` after emphasis, at scan end and in link.js's label resolution.
      if (strikethroughOn && ch === '~') {
        scan.pos = i;
        i = showdown.subParser('makehtml.inline.strikethrough')(scan, options, globals);
        continue;
      }

      // ghMentions (option): resolve an `@username` mention at the cursor. The handler applies the
      // boundary rule (fragment start / whitespace / pending emphasis delimiter, and never inside an
      // open bracket) and declines otherwise, falling through to plain text.
      if (ghMentionsOn && ch === '@') {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.ghMentions')(scan, options, globals);
        if (e !== null) { i = e; continue; }
      }

      // Naked URLs (simplifiedAutoLink option): consume the URL body as one atomic text node
      // so `_`/`*` inside it (e.g. `http://foo.com/a_b` or `.../#**x**`) never become emphasis
      // delimiters and no emphasis hash placeholder can be spliced into the href. The
      // simplifiedAutoLink post-pass then builds the anchor from the intact URL text. Trailing
      // emphasis markers are left for the scanner so `__https://x__` still emphasizes.
      if (autoLinkOn && (ch === 'h' || ch === 'H' || ch === 'w' || ch === 'W' || ch === 'f' || ch === 'F')) {
        scan.pos = i;
        let e = showdown.subParser('makehtml.inline.nakedUrl')(scan, options, globals);
        if (e !== null) { i = e; continue; }
      }

      // plain text run up to the next significant char (or a scan trigger for the option-gated
      // emoji / naked-URL recognizers above, so a trigger in mid-run hands control back).
      let start = i;
      while (i < len) {
        let c = str.charAt(i);
        if ('\n\\`<&![]*_'.indexOf(c) !== -1) { break; }
        if (i > start) {
          if (emojiOn && c === ':') { break; }
          if (ellipsisOn && c === '.') { break; }
          if (strikethroughOn && c === '~') { break; }
          if (ghMentionsOn && c === '@') { break; }
          if (autoLinkOn && (c === 'h' || c === 'H' || c === 'w' || c === 'W' || c === 'f' || c === 'F')) { break; }
        }
        ++i;
      }
      if (i === start) {
        appendText(str.charAt(i)); i++;
      } else {
        appendText(str.slice(start, i));
      }
    }

    processEmphasis(null);

    // Strikethrough pairing (place a): resolve the surviving top-level tilde-run nodes into `<del>`
    // AFTER emphasis, mirroring the whole-text pass that ran on the serialized output. applyGfm is
    // true here — a top-level `<del>` is finalized like an emphasis span (the GFM overlay had already
    // run on the serialized text before the strikethrough pass wrapped it). Emoji is scan-native,
    // already substituted inline, so there is no applyEmoji arg.
    if (strikethroughOn) {
      showdown.subParser('makehtml.inline.strikethrough.pair')(scan, options, globals, stack.head, null, true);
    }

    // render the node list
    return stack.renderList(renderNode);

    // ---- bracket stack ---------------------------------------------------------

    function pushBracket (node, image, sourceStart, matchStart) {
      scan.brackets = {
        node: node,
        prev: scan.brackets,
        prevDelim: stack.delimiters,
        image: image,
        active: true,
        matchStart: matchStart, // index in `str` of the opening `[` / `![`
        sourceStart: sourceStart // index in `str` where the label text begins
      };
    }

    // ---- rendering helpers -----------------------------------------------------

    // concatenate the rendered HTML of nodes [from .. to)
    function renderNodes (from, to) {
      return stack.renderRange(from, to, renderNode);
    }

    function normalizeDest (dest) {
      dest = resolveBackslash(dest);
      dest = showdown.helper.applyBaseUrl(options.relativePathBaseUrl, dest);
      return showdown.helper.cmNormalizeURL(dest);
    }
    function buildTitleAttr (attributes, title) {
      if (title !== null && title !== undefined) {
        attributes.title = showdown.helper.cmEscapeTitle(resolveBackslash(title));
      }
    }

    // ---- emphasis (CommonMark reference algorithm) -----------------------------
    // Runs on the shared delimiter-stack engine. This path differs from
    // emphasisAndStrong's only in how the wrapped span is rendered: the inner nodes are
    // HTML-escaped, the GFM-inline-links pass + emoji/strikethrough run on them
    // (because the wrapped span is hashed below, the span-gamut extras never see it), and
    // the wrap node is raw.

    function processEmphasis (stackBottom) {
      stack.processEmphasis(stackBottom, function (tagOpen, tagClose, opener, closer) {
        return showdown.subParser('makehtml.inline.emphasis.build')(scan, options, globals, tagOpen, tagClose, opener, closer);
      }, true);
    }
  }
});
