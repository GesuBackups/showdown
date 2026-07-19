// Runs the Showdown Flavored Markdown spec suite (specs/showdown.md, extracted to
// showdown.testsuite.json by `npm run extract:spec`) against the `vanilla` flavor.
//
// This is the executable contract for the default converter. Unlike the single-converter
// original/gfm suites, each case is run with its own converter built from the options the
// example declares in its fence annotation (mirroring testsuite.features.js), so an example
// tagged `options:tables` runs with tables on and every other example runs with pure
// defaults.

// jshint ignore: start
let bootstrap = require('./makehtml.bootstrap.js'),
    showdown = bootstrap.showdown,
    assertion = bootstrap.assertion,
    testsuite = bootstrap.getJsonTestSuite('test/functional/makehtml/cases/showdown.testsuite.json');

describe('makeHtml() showdown (vanilla) testsuite', function () {
  'use strict';

  for (let section in testsuite) {
    if (Object.prototype.hasOwnProperty.call(testsuite, section)) {
      describe(section, function () {
        for (let i = 0; i < testsuite[section].length; ++i) {
          let testCase = testsuite[section][i];
          let name = testCase.name;
          let number = testCase.number;
          // each case carries the converter options it needs in the fixture (vanilla defaults
          // otherwise)
          let converter = new showdown.Converter(testCase.options);
          it(number + ': ' + name, assertion(testCase, converter, true));
        }
      });
    }
  }
});
