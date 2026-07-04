/**
 * Created by Tivie on 15-01-2015.
 */
//let showdown = require('../../.build/showdown.js') || require('showdown');


describe('showdown.Converter', function () {
  'use strict';

  describe('Converter.options extensions', function () {
    let runCount;
    showdown.extension('testext', function () {
      return [{
        type: 'output',
        filter: function (text) {
          runCount = runCount + 1;
          return text;
        }
      }];
    });

    let converter = new showdown.Converter({extensions: ['testext']});

    it('output extensions should run once', function () {
      runCount = 0;
      converter.makeHtml('# testext');
      expect(runCount).toBe(1);
    });
  });

  describe('makeHtml() with option omitExtraWLInCodeBlocks', function () {
    let converter = new showdown.Converter({omitExtraWLInCodeBlocks: true}),
        text = 'var foo = bar;',
        html = converter.makeHtml('    ' + text);
    it('should omit extra line after code tag', function () {
      let expectedHtml = '<pre><code>' + text + '</code></pre>';
      expect(html).toBe(expectedHtml);
    });
  });

  describe('makeHtml() with option headerIds', function () {
    let converter = new showdown.Converter(),
        text = 'foo header';

    it('should generate github-compatible ids by default', function () {
      let html = converter.makeHtml('# ' + text),
          expectedHtml = '<h1 id="foo-header">' + text + '</h1>';
      expect(html).toBe(expectedHtml);
    });

    it('should prefix header id with a custom string', function () {
      converter.setOption('headerIds', { prefix: 'blabla' });
      let html = converter.makeHtml('# ' + text),
          expectedHtml = '<h1 id="blablafoo-header">' + text + '</h1>';
      expect(html).toBe(expectedHtml);
    });

    it('should omit the id when set to false', function () {
      converter.setOption('headerIds', false);
      let html = converter.makeHtml('# ' + text),
          expectedHtml = '<h1>' + text + '</h1>';
      expect(html).toBe(expectedHtml);
    });

    it('should use minimal sanitization when raw is true', function () {
      converter.setOption('headerIds', { raw: true });
      let html = converter.makeHtml('# foo/bar header'),
          expectedHtml = '<h1 id="foo/bar-header">foo/bar header</h1>';
      expect(html).toBe(expectedHtml);
    });

    it('should combine a prefix with raw sanitization', function () {
      converter.setOption('headerIds', { prefix: '/p/', raw: true });
      let html = converter.makeHtml('# foo/bar header'),
          expectedHtml = '<h1 id="/p/foo/bar-header">foo/bar header</h1>';
      expect(html).toBe(expectedHtml);
    });

    it('should throw a TypeError for an invalid headerIds value', function () {
      expect(function () {
        new showdown.Converter({ headerIds: 3 });
      }).toThrow();
    });
  });

  describe('makeHtml() with option metadata', function () {
    let converter = new showdown.Converter(),
        text1 =
          '---SIMPLE\n' +
          'foo: bar\n' +
          'baz: bazinga\n' +
          '---\n',
        text2 =
          '---TIVIE\n' +
          'a: b\n' +
          'c: 123\n' +
          '---\n';

    it('should correctly set metadata', function () {
      converter.setOption('metadata', true);

      let expectedHtml = '',
          expectedObj = {foo: 'bar', baz: 'bazinga'},
          expectedRaw = 'foo: bar\nbaz: bazinga',
          expectedFormat = 'SIMPLE';
      expect(converter.makeHtml(text1)).toBe(expectedHtml);
      expect(converter.getMetadata()).toEqual(expectedObj);
      expect(converter.getMetadata(true)).toBe(expectedRaw);
      expect(converter.getMetadataFormat()).toBe(expectedFormat);
    });

    it('consecutive calls should reset metadata', function () {
      converter.makeHtml(text2);
      let expectedObj = {a: 'b', c: '123'},
          expectedRaw = 'a: b\nc: 123',
          expectedFormat = 'TIVIE';
      expect(converter.getMetadata()).toEqual(expectedObj);
      expect(converter.getMetadata(true)).toBe(expectedRaw);
      expect(converter.getMetadataFormat()).toBe(expectedFormat);
    });
  });

  describe('makeHtml() metadata must not break out of the document head (completeHTMLDocument)', function () {
    let converter = new showdown.Converter({metadata: true, completeHTMLDocument: true});

    it('should entity-escape < and > in the title so it cannot close <title> and inject markup', function () {
      let html = converter.makeHtml('---\ntitle: </title><script>alert(1)</script>\n---\n\n# hi');
      expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
      expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('should entity-escape < and > in the doctype so it cannot inject markup', function () {
      let html = converter.makeHtml('---\ndoctype: html><script>alert(1)</script\n---\n\n# hi');
      expect(html).not.toContain('<script>alert(1)</script');
    });
  });
});
