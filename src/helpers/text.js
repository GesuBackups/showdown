/**
 * @file      helpers/text.js
 * @summary   Pure string/regex utilities: trimming, case folding, tab expansion, recursive matching.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `outdent`, `regexIndexOf`, `splitAtIndex`, the recursive-delimiter
 * matcher (`replaceRecursiveRegExp`) and the `repeat`/`padEnd` polyfills.
 * Load-order safe: the only load-time evaluation (`rgxFindMatchPos`) lives in
 * this file with its sole user; nothing here reads another helper's state at load time.
 */

/**
 * Remove one level of line-leading tabs or spaces
 * @param {string} text
 * @returns {string}
 */
showdown.helper.outdent = function (text) {
  'use strict';
  if (!showdown.helper.isString(text)) {
    return text;
  }
  return text.replace(/^(\t| {1,4})/gm, '');
};

/**
 * Returns the index within the passed String object of the first occurrence of the specified regex,
 * starting the search at fromIndex. Returns -1 if the value is not found.
 *
 * @param {string} str string to search
 * @param {RegExp} regex Regular expression to search
 * @param {int} [fromIndex = 0] Index to start the search
 * @returns {Number}
 * @throws InvalidArgumentError
 */
showdown.helper.regexIndexOf = function (str, regex, fromIndex) {
  'use strict';
  if (!showdown.helper.isString(str)) {
    throw 'InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string';
  }
  if (!(regex instanceof RegExp)) {
    throw 'InvalidArgumentError: second parameter of showdown.helper.regexIndexOf function must be an instance of RegExp';
  }
  let indexOf = str.substring(fromIndex || 0).search(regex);
  return (indexOf >= 0) ? (indexOf + (fromIndex || 0)) : indexOf;
};

/**
 * Splits the passed string object at the defined index, and returns an array composed of the two substrings
 * @param {string} str string to split
 * @param {int} index index to split string at
 * @returns {[string,string]}
 * @throws InvalidArgumentError
 */
showdown.helper.splitAtIndex = function (str, index) {
  'use strict';
  if (!showdown.helper.isString(str)) {
    throw 'InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string';
  }
  return [str.substring(0, index), str.substring(index)];
};

/**
 * Locates balanced `left`…`right` delimiter pairs, outermost-first.
 *
 * The delimiters are tokenized in a single regex pass, then paired arithmetically over the
 * token array. The original implementation re-ran the regex over the remainder once per
 * unbalanced opener ("drop the first opener and try again"), which is O(n^2) on inputs like
 * `'<div>\n'.repeat(n)` — with or without a trailing closer, so a "does a closer exist"
 * guard does not fix it. Pairing is expressed here as depth arithmetic instead:
 *
 * - `D[k]` is the cumulative depth after token k (opener +1, closer -1).
 * - A scan started at opener `j` completes at the first later token whose depth is `D[j] - 1`;
 *   it can complete at all iff some *closer* at or after `j + 1` reaches that depth, which is
 *   what `minCloserD` answers in O(1).
 * - When an opener cannot complete, the next candidate is the next opener that can. Because
 *   both that search and the match scans only ever move forward, the whole run stays linear.
 *
 * Emitted pairs are identical to the previous implementation's (verified by differential
 * fuzzing over both delimiter families and every flag combination).
 *
 * @param {string} str
 * @param {string} left
 * @param {string} right
 * @param {string} [flags]
 * @returns {Array<{left: {}, match: {}, right: {}, wholeMatch: {}}>}
 */
let rgxFindMatchPos = function (str, left, right, flags) {
  'use strict';
  let f = flags || '',
      g = f.indexOf('g') > -1,
      x = new RegExp(left + '|' + right, 'g' + f.replace(/g/g, '')),
      l = new RegExp(left, f.replace(/g/g, '')),
      pos = [],
      toks = [],
      m;

  while ((m = x.exec(str))) {
    toks.push({start: m.index, end: m.index + m[0].length, isLeft: l.test(m[0])});
    if (m[0].length === 0) {
      // zero-length delimiter match: step forward so the scan cannot stall
      x.lastIndex++;
    }
  }

  let n = toks.length,
      depth = new Array(n),
      minCloserDepth = new Array(n + 1),
      acc = 0;

  for (let k = 0; k < n; k++) {
    acc += toks[k].isLeft ? 1 : -1;
    depth[k] = acc;
  }
  minCloserDepth[n] = Infinity;
  for (let k = n - 1; k >= 0; k--) {
    minCloserDepth[k] = toks[k].isLeft ?
      minCloserDepth[k + 1] :
      Math.min(minCloserDepth[k + 1], depth[k]);
  }

  function completes (j) {
    return minCloserDepth[j + 1] <= depth[j] - 1;
  }

  let i = 0,
      viability = 0;
  while (i < n) {
    // closers before any opener are ignored, exactly as the depth counter used to
    while (i < n && !toks[i].isLeft) {
      i++;
    }
    if (i >= n) {
      break;
    }
    if (!completes(i)) {
      // this opener can never be closed: advance to the next one that can. `viability` keeps
      // the search monotone, so no token is examined twice across the whole run.
      let j = Math.max(i + 1, viability);
      while (j < n && !(toks[j].isLeft && completes(j))) {
        j++;
      }
      viability = j;
      i = j;
      continue;
    }
    let target = depth[i] - 1,
        found = i + 1;
    while (depth[found] !== target) {
      found++;
    }
    pos.push({
      left: {start: toks[i].start, end: toks[i].end},
      match: {start: toks[i].end, end: toks[found].start},
      right: {start: toks[found].start, end: toks[found].end},
      wholeMatch: {start: toks[i].start, end: toks[found].end}
    });
    if (!g) {
      return pos;
    }
    i = found + 1;
  }

  return pos;
};

/**
 * Recursive-delimiter matcher/replacer.
 *
 * Derived from matchRecursiveRegExp (c) 2007 Steven Levithan <stevenlevithan.com>, MIT License.
 *
 * @param {string} str
 * @param {string|function} replacement
 * @param {string} left
 * @param {string} right
 * @param {string} flags
 * @returns {string}
 */
showdown.helper.replaceRecursiveRegExp = function (str, replacement, left, right, flags) {
  'use strict';

  if (!showdown.helper.isFunction(replacement)) {
    let repStr = replacement;
    replacement = function () {
      return repStr;
    };
  }

  let matchPos = rgxFindMatchPos(str, left, right, flags),
      finalStr = str,
      lng = matchPos.length;

  if (lng > 0) {
    let bits = [];
    if (matchPos[0].wholeMatch.start !== 0) {
      bits.push(str.slice(0, matchPos[0].wholeMatch.start));
    }
    for (let i = 0; i < lng; ++i) {
      bits.push(
        replacement(
          str.slice(matchPos[i].wholeMatch.start, matchPos[i].wholeMatch.end),
          str.slice(matchPos[i].match.start, matchPos[i].match.end),
          str.slice(matchPos[i].left.start, matchPos[i].left.end),
          str.slice(matchPos[i].right.start, matchPos[i].right.end)
        )
      );
      if (i < lng - 1) {
        bits.push(str.slice(matchPos[i].wholeMatch.end, matchPos[i + 1].wholeMatch.start));
      }
    }
    if (matchPos[lng - 1].wholeMatch.end < str.length) {
      bits.push(str.slice(matchPos[lng - 1].wholeMatch.end));
    }
    finalStr = bits.join('');
  }
  return finalStr;
};

/**
 * Hashes standalone PHP/ASP-style processor instructions (`<?…?>` and `<%…%>`).
 *
 * The block pattern's lazy content class matches newlines, so an opener with no closer ahead
 * scans to end-of-input — once per opener, i.e. O(n^2) on `'\n\n<?x'.repeat(n)`. A processor
 * instruction only forms when its closer is followed by a blank line, so the pass is run over
 * the region up to the last such closer: no match can begin after it, and none can extend past
 * it, which makes the restriction exact rather than approximate.
 *
 * Known residual: openers of one type (`<%`) followed only by a closer of the other (`?>`)
 * still degrade, since the cutoff is computed across both delimiter types.
 *
 * @param {string} text
 * @param {function} replacer passed straight to String.replace
 * @returns {string}
 */
showdown.helper.replaceProcessorInstructions = function (text, replacer) {
  'use strict';
  let lastValidClose = -1,
      closeRgx = /[?%]>[ \t]*(?=\n{2,})/g,
      m;

  while ((m = closeRgx.exec(text))) {
    lastValidClose = m.index + m[0].length;
  }
  if (lastValidClose === -1) {
    return text;
  }
  // +2 keeps the blank line the trailing lookahead needs inside the scanned region
  let cut = lastValidClose + 2;
  return text.slice(0, cut).replace(/\n\n( {0,3}<([?%])[^\r]*?\2>[ \t]*(?=\n{2,}))/g, replacer) +
    text.slice(cut);
};

/**
 * String.prototype.repeat polyfill
 *
 * @param {string} str
 * @param {int} count
 * @returns {string}
 */
showdown.helper.repeat = function (str, count) {
  'use strict';
  // use built-in method if it's available
  if (!showdown.helper.isUndefined(String.prototype.repeat)) {
    return str.repeat(count);
  }
  str = '' + str;
  if (count < 0) {
    throw new RangeError('repeat count must be non-negative');
  }
  if (count === Infinity) {
    throw new RangeError('repeat count must be less than infinity');
  }
  count = Math.floor(count);
  if (str.length === 0 || count === 0) {
    return '';
  }
  // Ensuring count is a 31-bit integer allows us to heavily optimize the
  // main part. But anyway, most current (August 2014) browsers can't handle
  // strings 1 << 28 chars or longer, so:
  /*jshint bitwise: false*/
  if (str.length * count >= 1 << 28) {
    throw new RangeError('repeat count must not overflow maximum string size');
  }
  /*jshint bitwise: true*/
  let maxCount = str.length * count;
  count = Math.floor(Math.log(count) / Math.log(2));
  while (count) {
    str += str;
    count--;
  }
  str += str.substring(0, maxCount - str.length);
  return str;
};

/**
 * String.prototype.padEnd polyfill
 *
 * @param {string} str
 * @param {int} targetLength
 * @param {string} [padString]
 * @returns {string}
 */
showdown.helper.padEnd = function padEnd (str, targetLength, padString) {
  'use strict';
  // eslint-disable-next-line @stylistic/space-infix-ops
  targetLength = targetLength>>0; //floor if number or convert non-number to 0;
  padString = String(padString || ' ');
  if (str.length > targetLength) {
    return String(str);
  } else {
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += showdown.helper.repeat(padString, targetLength / padString.length); //append to original to ensure we are longer than needed
    }
    return String(str) + padString.slice(0,targetLength);
  }
};
