/**
 * @file      makehtml/hashCodeTags.js
 * @summary   Hashes and escapes raw `<code>` elements, and defines the shared factory used by `hashPreCodeTags`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Uses a recursive open/close scan plus `encodeCode`; the `makeHashCodeTagsHelper` factory lives
 * here (this file concatenates first) and is reused by the `<pre><code>` variant. A
 * `showdown.helper.*` mechanism, not a construct; emits no events.
 */

// Mechanism (not a construct): hash plumbing, attached as showdown.helper functions
// (no events). Shared factory for the two "hash a raw code element" passes —
// hashCodeTags and its near-clone hashPreCodeTags. Both run the same recursive
// open/close scan plus encodeCode, differing only in the open/close tag patterns and
// how the hashed block is stored. Defined here (this file is concatenated before
// hashPreCodeTags.js) so the sibling file can register its variant through the same
// implementation.
function makeHashCodeTagsHelper (openPattern, closePattern, store) {
  'use strict';
  return function (text, options, globals) {
    let repFunc = function (wholeMatch, match, left, right) {
      // encode html entities
      let codeblock = left + showdown.helper.encodeCode(match) + right;
      return store(wholeMatch, codeblock, globals);
    };
    return showdown.helper.replaceRecursiveRegExp(text, repFunc, openPattern, closePattern, 'gim');
  };
}

// Hash naked <code>
showdown.helper.hashCodeTags = makeHashCodeTagsHelper(
  '<code\\b[^>]*>',
  '</code>',
  function (wholeMatch, codeblock, globals) {
    return '¨C' + (globals.gHtmlSpans.push(codeblock) - 1) + 'C';
  }
);
