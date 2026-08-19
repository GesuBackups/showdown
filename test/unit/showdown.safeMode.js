/**
 * safeMode option — white-box coverage.
 *
 * The option's behavior (URL scheme allowlist, raw-HTML escaping, event-handler stripping and
 * their interactions) lives in the `safeMode` section of
 * test/functional/makehtml/cases/features.testsuite.json. Only the case below stays here: it
 * drives the subparser directly because no converter input reaches that intermediate state.
 */
describe('showdown.Converter safeMode option', function () {
  'use strict';

  describe('disallowedHtmlTags subparser', function () {
    it('should leave already-escaped malformed-tag text untouched (no in-place corruption)', function () {
      // A malformed tag (e.g. `<a/href=…>`, `<img/onerror=…>`) is entity-escaped to inert
      // `&lt;…&gt;` text upstream. The disallowedHtmlTags safeMode sanitizers operate per real
      // `<…>` tag only, so this escaped text passes through verbatim — matching it would strip
      // characters out of the middle of the inert text and corrupt it.
      let opts = showdown.getDefaultOptions();
      opts.safeMode = true;
      let globals = {gHtmlBlocks: [], gHtmlRawBlocks: [], gHtmlSpans: [], ghCodeBlocks: [], converter: new showdown.Converter()},
          escaped = '&lt;a/href=&quot;javascript:alert(1)&quot;&gt; and &lt;img/onerror=alert(1)&gt;';
      expect(showdown.subParser('makehtml.disallowedHtmlTags')(escaped, opts, globals)).toBe(escaped);
    });
  });
});
