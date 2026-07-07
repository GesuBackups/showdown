/**
 * @file      helpers/text.js
 * @summary   Pure string/regex utilities: trimming, case folding, tab expansion, recursive matching.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `trimStart`/`trimEnd` (+ their shared whitespace class), `caseFold`, `expandCmTabs`,
 * `normalizeLeadingTabs`, `outdent`, `regexIndexOf`, `splitAtIndex`, the recursive-delimiter
 * matchers (`matchRecursiveRegExp`/`replaceRecursiveRegExp`) and the `repeat`/`padEnd` polyfills.
 * Load-order safe: the only load-time evaluations (the `CM_WS` regexes, `rgxFindMatchPos`) live in
 * this file with their sole users; nothing here reads another helper's state at load time.
 */

// Unicode whitespace class shared by the trimStart/trimEnd polyfills. Built via string
// concatenation (rather than a regex literal) so the single class definition lives in one
// place; ESLint cannot statically flag `no-control-regex` on a computed RegExp pattern.
const CM_WS = '\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\xA0\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u202F\\u205F\\u3000\\u2028\\u2029\\uFEFF';
const CM_WS_START = new RegExp('^[' + CM_WS + ']+');
const CM_WS_END = new RegExp('[' + CM_WS + ']+$');

/**
 * Polyfill method for trimStart
 * @param {string} text
 * @returns {string}
 */
showdown.helper.trimStart = function (text) {
  return (!String.prototype.trimStart) ? text.replace(CM_WS_START, '') : text.trimStart();
};

/**
 * Polyfill method for trimEnd
 * @param {string} text
 * @returns {string}
 */
showdown.helper.trimEnd = function (text) {
  return (!String.prototype.trimEnd) ? text.replace(CM_WS_END, '') : text.trimEnd();
};

/**
 * Unicode case folding for case-insensitive matching of link reference labels.
 * Uses `toLowerCase().toUpperCase()` (the round-trip used by commonmark.js) so that
 * characters like `ß`, `ẞ` and `SS` all fold together - which plain `toLowerCase`
 * does not (`ẞ` -> `ß`, not `ss`).
 * @param {string} str
 * @returns {string}
 */
showdown.helper.caseFold = function (str) {
  return str.toLowerCase().toUpperCase();
};

/**
 * CommonMark tab expansion: tabs are expanded to spaces using 4-column tab stops,
 * but only in the part of a line that defines block structure - the leading
 * whitespace plus an optional single list/block-quote marker and the whitespace
 * after it. Tabs in content (after that prefix) are preserved. Lines without a tab
 * in their prefix are returned unchanged.
 * @param {string} text
 * @returns {string}
 */
showdown.helper.expandCmTabs = function (text) {
  if (text.indexOf('\t') === -1) {
    return text;
  }
  const prefixRgx = /^[ \t]*(?:(?:[-+*]|\d{1,9}[.)]|>)[ \t]*)?/;
  const thematicBreakRgx = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  return text.split('\n').map(function (line) {
    // a thematic break (e.g. `*\t*\t*`) is not a list item: do not let the marker
    // branch of the prefix expansion mangle it
    if (thematicBreakRgx.test(line)) {
      return line;
    }
    let prefix = prefixRgx.exec(line)[0];
    if (prefix.indexOf('\t') === -1) {
      return line;
    }
    let out = '',
        col = 0;
    for (let k = 0; k < prefix.length; ++k) {
      let ch = prefix.charAt(k);
      if (ch === '\t') {
        let adv = 4 - (col % 4);
        out += new Array(adv + 1).join(' ');
        col += adv;
      } else {
        out += ch;
        col++;
      }
    }
    return out + line.slice(prefix.length);
  }).join('\n');
};

showdown.helper.normalizeLeadingTabs = function (text) {
  // 1. (1 to 3 spaces followed by a tab at the start of the line) becomes (1 tab)
  text = text.replace(/^ {1,3}\t/gm, '\t');

  // 2.
  return text;
};

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

let rgxFindMatchPos = function (str, left, right, flags) {
  'use strict';
  let f = flags || '',
      g = f.indexOf('g') > -1,
      x = new RegExp(left + '|' + right, 'g' + f.replace(/g/g, '')),
      l = new RegExp(left, f.replace(/g/g, '')),
      pos = [],
      t, s, m, start, end;

  do {
    t = 0;
    while ((m = x.exec(str))) {
      if (l.test(m[0])) {
        if (!(t++)) {
          s = x.lastIndex;
          start = s - m[0].length;
        }
      } else if (t) {
        if (!--t) {
          end = m.index + m[0].length;
          let obj = {
            left: {start: start, end: s},
            match: {start: s, end: m.index},
            right: {start: m.index, end: end},
            wholeMatch: {start: start, end: end}
          };
          pos.push(obj);
          if (!g) {
            return pos;
          }
        }
      }
    }
  } while (t && (x.lastIndex = s));

  return pos;
};

/**
 * matchRecursiveRegExp
 *
 * (c) 2007 Steven Levithan <stevenlevithan.com>
 * MIT License
 *
 * Accepts a string to search, a left and right format delimiter
 * as regex patterns, and optional regex flags. Returns an array
 * of matches, allowing nested instances of left/right delimiters.
 * Use the "g" flag to return all matches, otherwise only the
 * first is returned. Be careful to ensure that the left and
 * right format delimiters produce mutually exclusive matches.
 * Backreferences are not supported within the right delimiter
 * due to how it is internally combined with the left delimiter.
 * When matching strings whose format delimiters are unbalanced
 * to the left or right, the output is intentionally as a
 * conventional regex library with recursion support would
 * produce, e.g. "<<x>" and "<x>>" both produce ["x"] when using
 * "<" and ">" as the delimiters (both strings contain a single,
 * balanced instance of "<x>").
 *
 * examples:
 * matchRecursiveRegExp("test", "\\(", "\\)")
 * returns: []
 * matchRecursiveRegExp("<t<<e>><s>>t<>", "<", ">", "g")
 * returns: ["t<<e>><s>", ""]
 * matchRecursiveRegExp("<div id=\"x\">test</div>", "<div\\b[^>]*>", "</div>", "gi")
 * returns: ["test"]
 */
showdown.helper.matchRecursiveRegExp = function (str, left, right, flags) {
  'use strict';

  let matchPos = rgxFindMatchPos (str, left, right, flags),
      results = [];

  for (let i = 0; i < matchPos.length; ++i) {
    results.push([
      str.slice(matchPos[i].wholeMatch.start, matchPos[i].wholeMatch.end),
      str.slice(matchPos[i].match.start, matchPos[i].match.end),
      str.slice(matchPos[i].left.start, matchPos[i].left.end),
      str.slice(matchPos[i].right.start, matchPos[i].right.end)
    ]);
  }
  return results;
};

/**
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
