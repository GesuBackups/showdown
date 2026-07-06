////
// makehtml/hashCodeTags.js
// Copyright (c) 2018 ShowdownJS
//
// Hash and escape <code> elements that should not be parsed as markdown
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


// Shared factory for the two "hash a raw code element" passes — hashCodeTags and its
// near-clone hashPreCodeTags. Both run the same recursive open/close scan plus encodeCode,
// differing only in the event namespace, the open/close tag patterns and how the hashed
// block is stored. Defined here (this file is concatenated before hashPreCodeTags.js) so the
// sibling file can register its variant through the same implementation.
function makeHashCodeTagsSubParser (eventNs, openPattern, closePattern, store) {
  'use strict';
  return function (text, options, globals) {
    text = showdown.Event.dispatchStart('makehtml.' + eventNs + '.onStart', text, options, globals).output;

    let repFunc = function (wholeMatch, match, left, right) {
      // encode html entities
      let codeblock = left + showdown.subParser('makehtml.encodeCode')(match, options, globals) + right;
      return store(wholeMatch, codeblock, globals);
    };
    text = showdown.helper.replaceRecursiveRegExp(text, repFunc, openPattern, closePattern, 'gim');

    return showdown.Event.dispatchEnd('makehtml.' + eventNs + '.onEnd', text, options, globals).output;
  };
}

// Hash naked <code>
showdown.subParser('makehtml.hashCodeTags', makeHashCodeTagsSubParser(
  'hashCodeTags',
  '<code\\b[^>]*>',
  '</code>',
  function (wholeMatch, codeblock, globals) {
    return '¨C' + (globals.gHtmlSpans.push(codeblock) - 1) + 'C';
  }
));
