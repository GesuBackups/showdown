////
// makehtml/hashCodeTags.js
// Copyright (c) 2018 ShowdownJS
//
// Hash and escape <code> elements that should not be parsed as markdown
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

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
