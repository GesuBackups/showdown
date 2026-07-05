/**
 * Created by Estevao on 08-06-2015.
 */
let bootstrap = require('./makehtml.bootstrap.js'),
    assertion = bootstrap.assertion,
    testsuite = bootstrap.getTestSuite('test/functional/makehtml/cases/issues/');

describe('makeHtml() issues testsuite', function () {
  'use strict';
  for (let i = 0; i < testsuite.length; ++i) {
    let name = testsuite[i].name.replace(/-/g, ' ');
    let m = name.match(/^#(\d+)\./)?.[1];
    let issue = m ? parseInt(m, 10) : null;
    let converter = new bootstrap.showdown.Converter();

    switch (issue) {
      case 1046: {
        let opts = {tables: true, tablesHeaderId: true};
        // the safeMode variant additionally neutralizes raw HTML in the cell content
        if (/safemode/i.test(name)) {
          opts.safeMode = true;
        }
        converter = new bootstrap.showdown.Converter(opts);
        break;
      }
      default:

    }
    it(name, assertion(testsuite[i], converter));
  }
});
