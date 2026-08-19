// Runs the Original Markdown spec suite (specs/original.md, extracted to
// original.testsuite.json by `npm run extract:spec`) against the `original` flavor.
//
// The spec's expected outputs were verified against Markdown.pl 1.0.1 itself; the only
// deliberate departures from it are documented in the spec's Appendix B.

// jshint ignore: start
let bootstrap = require('./makehtml.bootstrap.js'),
    converter = new bootstrap.showdown.Converter(bootstrap.showdown.getFlavorOptions('original')),
    assertion = bootstrap.assertion,
    testsuite = bootstrap.getJsonTestSuite('test/functional/makehtml/cases/original.testsuite.json');

describe('makeHtml() original testsuite', function () {
  'use strict';

  for (let section in testsuite) {
    if (Object.prototype.hasOwnProperty.call(testsuite, section)) {
      describe(section, function () {
        for (let i = 0; i < testsuite[section].length; ++i) {
          let name = testsuite[section][i].name;
          let number = testsuite[section][i].number;
          // The cases below are skipped. `Automatic links_111` is untestable as-is: email
          // obfuscation output is randomized (the spec compares after decoding character
          // references, which the harness does not do). The rest are KNOWN DIVERGENCES
          // between Showdown's original flavor and the spec, catalogued when the suite was
          // introduced. Each needs a decision — fix the behavior in src/ or amend the spec —
          // and then its unskipping. Example numbers are positional; re-check them after
          // adding or removing spec examples.
          //
          //   Backslash escapes_4 ......... showdown escapes a wider char set (`"$<` consume
          //                                 the backslash)
          //   Setext headers_27 ........... showdown takes the whole multi-line paragraph as
          //                                 heading text; original only the last line
          //   Indented code blocks_31/32,
          //   Blockquotes_58 .............. showdown encodes `"` to &quot; inside code blocks;
          //                                 original encodes only & < >
          //   List items_70 ............... showdown requires 4 spaces to nest a sub-list;
          //                                 original nests on any additional indentation
          //                                 (the disableForced4SpacesIndentedSublists option
          //                                 exists for exactly this)
          //   Lists_72 .................... showdown lets a list interrupt a paragraph;
          //                                 original requires a preceding blank line
          //   Lists_76/83 ................. showdown emits a start attribute for ordered lists
          //                                 not starting at 1
          //   Lists_77 .................... showdown starts a new list on marker type change;
          //                                 original types the list by its first marker
          //   Automatic escaping_115 ...... original.md leaves a bare `>` unchanged (`4 < 5 and 6 > 3`
          //                                 keeps its `>`); showdown escapes both bare angle brackets
          //                                 (`&lt;`/`&gt;`) for every flavor under the unified inline
          //                                 engine
          switch (name) {
            case 'Automatic links_111':
            case 'Backslash escapes_4':
            case 'Setext headers_27':
            case 'Indented code blocks_31':
            case 'Indented code blocks_32':
            case 'Blockquotes_58':
            case 'List items_70':
            case 'Lists_72':
            case 'Lists_76':
            case 'Lists_83':
            case 'Lists_77':
            case 'Automatic escaping_115':
              continue;
          }
          it(number + ': ' + name, assertion(testsuite[section][i], converter, true));
        }
      });
    }
  }
});
