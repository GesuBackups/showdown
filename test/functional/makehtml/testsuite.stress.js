/**
 * Stress / edge-case snapshot suite.
 *
 * Throws deliberately weird, malformed and misaligned input at makeHtml — HTML with only opening
 * or only closing tags, crossed/mismatched tags, unclosed attributes, garbage angle brackets,
 * unbalanced markdown constructs, odd Unicode, malformed tables/footnotes, the CommonMark path,
 * and safeMode — and asserts the output matches a captured snapshot. None of these should throw,
 * hang, or silently change shape; if a parser change alters how an edge case is handled, the
 * corresponding snapshot in `cases/stress.testsuite.json` fails and the diff shows exactly what
 * moved. Regenerate intentionally-changed snapshots by re-capturing makeHtml output.
 *
 * Comparison uses prettify=false (exact, per-line-trimmed) because malformed HTML cannot be
 * run through the HTML prettifier.
 */
let bootstrap = require('./makehtml.bootstrap.js'),
    showdown = bootstrap.showdown,
    assertion = bootstrap.assertion,
    testsuite = bootstrap.getJsonTestSuite('test/functional/makehtml/cases/stress.testsuite.json');

describe('makeHtml() stress testsuite', function () {
  'use strict';

  for (let section in testsuite) {
    if (Object.prototype.hasOwnProperty.call(testsuite, section)) {
      describe(section, function () {
        for (let i = 0; i < testsuite[section].length; ++i) {
          let testCase = testsuite[section][i];
          let name = testCase.name.replace(/-/g, ' ');
          let number = testCase.number;
          let converter = new showdown.Converter(testCase.options);
          it(number + ': ' + name, assertion(testCase, converter, true));
        }
      });
    }
  }
});
