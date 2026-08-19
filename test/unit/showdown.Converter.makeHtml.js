/**
 * Created by Tivie on 15-01-2015.
 *
 * makeHtml() coverage that a fixture cannot express. Per-option conversion behavior lives in
 * test/functional/makehtml/cases/features.testsuite.json (and the spec suites); what remains
 * here asserts invocation counts, thrown errors, post-conversion accessor state, and the one
 * option whose effect the functional harness normalizes away (see omitExtraWLInCodeBlocks).
 */


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
    // Deliberately NOT a fixture: the option's only effect is the trailing newline before
    // `</code>`, and the functional harness prettifies both sides with diffable-html, which
    // re-indents `<pre><code>` content and normalizes that newline away. A fixture would
    // therefore pass identically with the option on or off.
    let converter = new showdown.Converter({omitExtraWLInCodeBlocks: true}),
        text = 'var foo = bar;',
        html = converter.makeHtml('    ' + text);
    it('should omit extra line after code tag', function () {
      let expectedHtml = '<pre><code>' + text + '</code></pre>';
      expect(html).toBe(expectedHtml);
    });
  });

  describe('makeHtml() with option headerIds', function () {
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
});
