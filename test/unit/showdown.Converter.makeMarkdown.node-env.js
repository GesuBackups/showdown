// @vitest-environment node
//
// Pins the happy-dom fallback branch itself: with no ambient window/document,
// `showdown.helper.document` must resolve via `require('happy-dom')` rather than throwing.
//
// The makeMarkdown *fixtures* are exercised against that branch by the `node` project in
// vitest.config.mjs, which re-runs the whole makemarkdown corpus with `environment: 'node'`.
// What only this file adds is the explicit assertion that there really is no global window —
// the corpus would pass just as happily under jsdom and never notice the fallback was skipped.

describe('makeMarkdown() in a bare Node environment (happy-dom fallback)', function () {
  'use strict';

  let converter = new showdown.Converter();

  it('should run without a global window/document', function () {
    expect(typeof window).toBe('undefined');
    expect(converter.makeMarkdown('<h1>Title <em>em</em></h1>')).toBe('# Title *em*\n\n');
  });
});
