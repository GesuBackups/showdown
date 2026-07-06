////
// makehtml/hashPreCodeTags.js
// Copyright (c) 2018 ShowdownJS
//
// Hash and escape <pre><code> elements that should not be parsed as markdown
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Registered through the shared makeHashCodeTagsHelper factory (defined in
// hashCodeTags.js): the <pre><code> variant differs only in the open/close patterns
// and storing each block in ghCodeBlocks (as githubCodeBlock does). Mechanism, not a
// construct: attached as a showdown.helper (no events).
showdown.helper.hashPreCodeTags = makeHashCodeTagsHelper(
  '^ {0,3}<pre\\b[^>]*>\\s*<code\\b[^>]*>',
  '^ {0,3}</code>\\s*</pre>',
  function (wholeMatch, codeblock, globals) {
    return '\n\n¨G' + (globals.ghCodeBlocks.push({text: wholeMatch, codeblock: codeblock}) - 1) + 'G\n\n';
  }
);
