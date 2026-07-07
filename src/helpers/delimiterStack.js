/**
 * @file      helpers/delimiterStack.js
 * @summary   The shared CommonMark delimiter-run engine used by both inline emphasis paths.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * One implementation of the CommonMark emphasis/strong delimiter-stack algorithm (spec §6.2),
 * shared by `makehtml.emphasisAndStrong`'s CommonMark path and `makehtml.cmInline`. Provides the
 * doubly-linked node list, the delimiter stack, flanking computation and `processEmphasis`. The two
 * call sites differ only in: whether the `¨D`/`¨T` sentinel fix-up is applied to the flanking
 * lookaround (cmInline yes, emphasisAndStrong no — passed as `resolveSentinels`), how inner content
 * is rendered/hashed (passed as the `buildWrapped` callback) and whether wrap nodes are raw
 * (`rawWrap`). Also exposes the CommonMark character classifiers (`isPunct`/`isWhitespace`/
 * `isAsciiPunct`). Load-order safe: no other-helper reads happen at load time.
 */

/* jshint esnext: false, esversion: 9 */
// (esversion 9 enables the \p{...} Unicode property escapes used for CommonMark flanking rules)

// CommonMark punctuation = ASCII punctuation + Unicode P and S categories.
const cmAsciiPunct = /[!-/:-@[-`{-~]/;

/**
 * True when `ch` is an ASCII punctuation character (and defined). Used for
 * backslash-escapability and as one input to the flanking rules.
 * @param {string|undefined} ch
 * @returns {boolean}
 */
showdown.helper.isAsciiPunct = function (ch) {
  return ch !== undefined && cmAsciiPunct.test(ch);
};

/**
 * CommonMark "punctuation": ASCII punctuation plus the Unicode P (punctuation) and
 * S (symbol) general categories.
 * @param {string|undefined} ch
 * @returns {boolean}
 */
showdown.helper.isPunct = function (ch) {
  return ch !== undefined && (cmAsciiPunct.test(ch) || /[\p{P}\p{S}]/u.test(ch));
};

/**
 * CommonMark "whitespace" for the flanking rules: undefined (string edge), any JS
 * `\s` whitespace, or any Unicode Z (separator) character.
 * @param {string|undefined} ch
 * @returns {boolean}
 */
showdown.helper.isWhitespace = function (ch) {
  return ch === undefined || /\s/.test(ch) || /\p{Z}/u.test(ch);
};

/**
 * A doubly-linked list of inline nodes plus the CommonMark emphasis delimiter stack.
 * Both inline emphasis parsers build one of these, feed it text / delimiter runs, run
 * `processEmphasis`, then render the surviving nodes.
 * @constructor
 */
showdown.helper.DelimiterStack = function () {
  this.head = null;
  this.tail = null;
  this.delimiters = null; // top of the emphasis delimiter stack
};

showdown.helper.DelimiterStack.prototype = {

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
   * resolved before the flanking lookaround reads the adjacent characters (cmInline runs
   * after the converter's sentinel swap; emphasisAndStrong does not).
   * @param {string} str
   * @param {number} start index of the first delimiter char
   * @param {number} i index just past the last delimiter char
   * @param {string} ch the delimiter character (`*` or `_`)
   * @param {boolean} [resolveSentinels]
   * @returns {{}} the appended delimiter node
   */
  pushDelim: function (str, start, i, ch, resolveSentinels) {
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
    let beforeWs = showdown.helper.isWhitespace(before),
        afterWs = showdown.helper.isWhitespace(after),
        beforePt = showdown.helper.isPunct(before),
        afterPt = showdown.helper.isPunct(after),
        leftFlanking = !afterWs && (!afterPt || beforeWs || beforePt),
        rightFlanking = !beforeWs && (!beforePt || afterWs || afterPt),
        canOpen, canClose;
    if (ch === '_') {
      canOpen = leftFlanking && (!rightFlanking || beforePt);
      canClose = rightFlanking && (!leftFlanking || afterPt);
    } else {
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
   * The two divergences between the call sites are injected:
   *  - `buildWrapped(tagOpen, tagClose, opener, closer)` renders the enclosed nodes and
   *    returns the final (usually hashed) wrapped literal — this is where cmInline runs its
   *    GFM-inline-links pass + emoji/strikethrough/ellipsis and emphasisAndStrong does the
   *    `&quot;` encode.
   *  - `rawWrap` marks the spliced-in wrap node as raw (cmInline renders raw nodes verbatim;
   *    emphasisAndStrong's render ignores the flag).
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
