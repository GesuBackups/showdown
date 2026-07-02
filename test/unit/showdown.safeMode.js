/**
 * safeMode option: URL scheme allowlist + raw-HTML escaping (defense-in-depth).
 */
describe('showdown.Converter safeMode option', function () {
  'use strict';

  describe('URL scheme allowlist (legacy path)', function () {
    let converter = new showdown.Converter({safeMode: true});

    it('should neutralize javascript: in links', function () {
      expect(converter.makeHtml('[x](javascript:alert(1))')).toBe('<p><a href="">x</a></p>');
    });
    it('should neutralize javascript: in images but keep the alt text', function () {
      expect(converter.makeHtml('![x](javascript:alert(1))')).toBe('<p><img src="" alt="x" /></p>');
    });
    it('should neutralize vbscript: and entity/whitespace-obfuscated schemes', function () {
      expect(converter.makeHtml('[x](vbscript:msgbox(1))')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('[x](java&#115;cript:alert(1))')).toBe('<p><a href="">x</a></p>');
    });
    it('should preserve safe http/https/relative/anchor/mailto links', function () {
      expect(converter.makeHtml('[a](http://example.com)')).toBe('<p><a href="http://example.com">a</a></p>');
      expect(converter.makeHtml('[a](/rel/path)')).toBe('<p><a href="/rel/path">a</a></p>');
      expect(converter.makeHtml('[a](#frag)')).toBe('<p><a href="#frag">a</a></p>');
      expect(converter.makeHtml('[a](mailto:a@b.com)')).toBe('<p><a href="mailto:a@b.com">a</a></p>');
    });
    it('should block data:text/html but keep data:image for images', function () {
      expect(converter.makeHtml('[a](data:text/html,<script>)')).toContain('href=""');
      expect(converter.makeHtml('![a](data:image/png;base64,AAAA)'))
        .toBe('<p><img src="data:image/png;base64,AAAA" alt="a" /></p>');
    });
  });

  describe('URL scheme allowlist (commonmark/cmSpec path)', function () {
    let converter = new showdown.Converter({safeMode: true, cmSpec: true});

    it('should neutralize javascript: links and autolinks', function () {
      expect(converter.makeHtml('[x](javascript:alert(1))')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<javascript:alert(1)>')).toBe('<p><a href="">javascript:alert(1)</a></p>');
    });
    it('should preserve safe links', function () {
      expect(converter.makeHtml('[a](https://example.com)')).toBe('<p><a href="https://example.com">a</a></p>');
    });
  });

  describe('raw-HTML escaping', function () {
    let converter = new showdown.Converter({safeMode: true});

    it('should escape raw <script>', function () {
      expect(converter.makeHtml('<script>alert(1)</script>')).toBe('&lt;script>alert(1)&lt;/script>');
    });
    it('should strip event-handler attributes from raw tags', function () {
      expect(converter.makeHtml('<img src=x onerror=alert(1)>')).toBe('<p><img src=x></p>');
      expect(converter.makeHtml('<a href="#" onclick="alert(1)">t</a>')).not.toContain('onclick');
    });
    it('should neutralize <svg onload>', function () {
      expect(converter.makeHtml('<svg onload=alert(1)></svg>')).toBe('<p>&lt;svg>&lt;/svg></p>');
    });
    it('should strip event handlers regardless of separator (space/tab/newline/slash/quote)', function () {
      expect(converter.makeHtml('<img src=x onerror=alert(1)>')).toBe('<p><img src=x></p>');
      expect(converter.makeHtml('<img src=x\tonerror=alert(1)>')).toBe('<p><img src=x></p>');
      expect(converter.makeHtml('<img/onerror=alert(1)>')).toBe('<p><img></p>');
      expect(converter.makeHtml('<a href="x"onmouseover="alert(1)">y</a>')).toBe('<p><a href="x">y</a></p>');
    });
    it('should neutralize dangerous URL schemes in form-action attributes (e.g. <input formaction>)', function () {
      // <input> is not escaped (kept for tasklists), so its formaction must be scheme-checked
      expect(converter.makeHtml('<input formaction="javascript:alert(1)" type="submit">')).not.toContain('formaction="javascript');
      expect(converter.makeHtml('<input formaction=javascript:alert(1) type=submit>')).not.toContain('formaction=javascript');
      // control: a safe formaction is preserved
      expect(converter.makeHtml('<input formaction="/submit" type="submit">')).toContain('formaction="/submit"');
    });
  });

  describe('raw-HTML anchor URL scheme allowlist', function () {
    let converter = new showdown.Converter({safeMode: true});

    it('should neutralize dangerous schemes in raw <a>/<area> href (all obfuscations)', function () {
      expect(converter.makeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<a href=javascript:alert(1)>x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<a href="  javascript:alert(1)">x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<a href="java&#115;cript:alert(1)">x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<a href="vbscript:x">x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<a href="data:text/html,x">x</a>')).toBe('<p><a href="">x</a></p>');
      expect(converter.makeHtml('<area href="javascript:alert(1)">')).toBe('<p><area href=""></p>');
    });
    it('should keep safe schemes and relative urls in raw anchors', function () {
      expect(converter.makeHtml('<a href="https://ok.com">x</a>')).toBe('<p><a href="https://ok.com">x</a></p>');
      expect(converter.makeHtml('<a href="/rel">x</a>')).toBe('<p><a href="/rel">x</a></p>');
    });
    it('should neutralize a dangerous href even when its value contains a > (quoted attr)', function () {
      // a `>` inside the quoted href must not truncate the tag and let the scheme slip past
      expect(converter.makeHtml('<a href="data:text/html,<b>x</b>">y</a>')).toContain('href=""');
      expect(converter.makeHtml('<a href="javascript:alert(1)>z">y</a>')).toContain('href=""');
      // ...but a safe URL that happens to contain a > is preserved
      expect(converter.makeHtml('<a href="http://ok/a>b">y</a>')).toContain('href="http://ok/a>b"');
    });
    it('should not corrupt an anchor href shown inside a code span', function () {
      expect(converter.makeHtml('`<a href="javascript:x">`'))
        .toBe('<p><code>&lt;a href=&quot;javascript:x&quot;&gt;</code></p>');
    });
    it('should neutralize a dangerous href regardless of the attribute separator (slash / quote-adjacent)', function () {
      // browsers accept `/` and quote-adjacent separators between attributes, so a href that is
      // not preceded by whitespace must still be neutralized
      expect(converter.makeHtml('<a/href="javascript:alert(1)">click</a>')).toContain('href=""');
      expect(converter.makeHtml('<a id="x"href="javascript:alert(1)">click</a>')).toContain('href=""');
      expect(converter.makeHtml('<a id=\'x\'href=\'javascript:alert(1)\'>click</a>')).toContain('href=""');
      expect(converter.makeHtml('<area/href="javascript:alert(1)">')).toContain('href=""');
      // control: a safe href adjacent to a preceding attribute must be preserved
      expect(converter.makeHtml('<a id="x"href="https://ok">y</a>')).toContain('href="https://ok"');
    });
  });

  describe('does not affect default behavior when off', function () {
    let converter = new showdown.Converter();

    it('should pass javascript: links through by default (trusted-input model)', function () {
      expect(converter.makeHtml('[x](javascript:alert(1))')).toBe('<p><a href="javascript:alert(1)">x</a></p>');
    });
    it('should pass raw <script> through by default', function () {
      expect(converter.makeHtml('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
    });
  });

  describe('interaction with other features', function () {
    it('should keep generated tasklist checkboxes', function () {
      let converter = new showdown.Converter({tasklists: true, safeMode: true});
      expect(converter.makeHtml('- [x] done')).toContain('type="checkbox"');
    });
    it('should not break completeHTMLDocument head', function () {
      let converter = new showdown.Converter({safeMode: true, completeHTMLDocument: true});
      let html = converter.makeHtml('# hi');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<!DOCTYPE HTML>');
      expect(html).toContain('<body>');
    });
    it('should still generate a title from metadata under safeMode', function () {
      let converter = new showdown.Converter({safeMode: true, completeHTMLDocument: true, metadata: true});
      let html = converter.makeHtml('---\ntitle: Hello World\n---\n\n# hi');
      expect(html).toContain('<title>Hello World</title>');
    });
  });
});
