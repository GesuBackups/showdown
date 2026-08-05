/**
 * Created by Estevao on 15-01-2015.
 */
//let showdown = require('../../.build/showdown.js') || require('showdown');

describe('showdown.Converter', function () {
  'use strict';


  describe('makeMarkdown()', function () {
    let converter = new showdown.Converter();

    it('should parse a simple html string', function () {
      let html = '<a href="/somefoo.html">a link</a>\n';
      let md   = '[a link](</somefoo.html>)';

      expect(converter.makeMarkdown(html)).toBe(md);
    });

    it('should keep the whitespace between every pair of adjacent inline elements', function () {
      // The inter-tag whitespace guard in makeMarkdown protects `>[ \t]+<` runs with a
      // ¨NBSP; sentinel before DOM cleanup. The producer replace currently lacks the g flag
      // (deliverables/smells-and-repetition-audit.md, A4), so only the FIRST run per
      // document survives cleanup and later inline elements get jammed together
      // (currently renders as `*a* **b***c*`).
      let html = '<p><em>a</em>\t<strong>b</strong>\t<em>c</em></p>';
      expect(converter.makeMarkdown(html)).toBe('*a* **b** *c*\n\n');
    });

    it('should parse untrusted html in an inert document (no script/onerror execution)', function () {
      // parseHTML must not reuse the live ambient document; it parses into an inert
      // document (createHTMLDocument) so <img onerror>/<svg onload> never fire client-side.
      let div = showdown.helper.parseHTML('<img src=x onerror="window.__xss=1">');
      expect(div.ownerDocument).not.toBe(showdown.helper.document);
      // sanity: the markup still parsed and is walkable
      expect(converter.makeMarkdown('<img src=x onerror="window.__xss=1">')).toBe('![](<x>)');
    });

  });
});
