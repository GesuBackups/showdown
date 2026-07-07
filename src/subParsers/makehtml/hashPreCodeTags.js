/**
 * @file      makehtml/hashPreCodeTags.js
 * @summary   Hashes raw `<pre><code>` blocks (storing them in `ghCodeBlocks`) via the shared `makeHashCodeTagsHelper` factory.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Differs from `hashCodeTags` only in its open/close patterns and storage target. A
 * `showdown.helper.*` mechanism, not a construct; emits no events.
 */

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
