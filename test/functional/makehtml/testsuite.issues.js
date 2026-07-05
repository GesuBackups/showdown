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
      case 1043: {
        if (/gfm/.test(name)) {
          converter = new bootstrap.showdown.Converter().setFlavor('github');
        } else if (/commonmark/.test(name)) {
          converter = new bootstrap.showdown.Converter().setFlavor('commonmark');
        }
        break;
      }
      case 1061: {
        // unused link reference definitions must be stripped in every flavor;
        // the vanilla variant runs on the default converter
        if (/original flavor/.test(name)) {
          converter.setFlavor('original');
        } else if (/commonmark flavor/.test(name)) {
          converter.setFlavor('commonmark');
        }
        break;
      }
      default:

    }
    it(name, assertion(testsuite[i], converter));
  }
});
