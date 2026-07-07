/**
 * Created by Tivie on 27/01/2017.
 */
/*jshint expr: true*/
/*jshint -W053 */
/*jshint -W010 */
/*jshint -W009 */

describe('encodeEmailAddress()', function () {
  'use strict';
  let encoder = showdown.helper.encodeEmailAddress,
      email = 'foobar@example.com',
      encodedEmail = encoder(email),
      encodedEmail2 = encoder(email);

  it('should encode email', function () {
    expect(encodedEmail).not.toBe(email);
  });

  it('should encode email determinated', function () {
    expect(encodedEmail).toBe(encodedEmail2);
  });

  it('should decode to original email', function () {
    let decodedEmail = encodedEmail.replace(/&#(.+?);/g, function (wm, cc) {
      if (cc.charAt(0) === 'x') {
        //hex
        return String.fromCharCode('0' + cc);
      } else {
        //dec
        return String.fromCharCode(cc);
      }
    });
    expect(decodedEmail).toBe(email);
  });
});

describe('isString()', function () {
  'use strict';
  let isString = showdown.helper.isString;

  it('should return true for new String Object', function () {
    expect(isString(new String('some string'))).toBe(true);
  });

  it('should return true for String Object', function () {
    expect(isString(String('some string'))).toBe(true);
  });

  it('should return true for string literal', function () {
    expect(isString('some string')).toBe(true);
  });

  it('should return false for integers', function () {
    expect(isString(5)).toBe(false);
  });

  it('should return false for random objects', function () {
    expect(isString({foo: 'bar'})).toBe(false);
  });

  it('should return false for arrays', function () {
    expect(isString(['bar'])).toBe(false);
  });
});

describe('isFunction()', function () {
  'use strict';
  let isFunction = showdown.helper.isFunction;

  it('should return true for closures', function () {
    expect(isFunction(function () {})).toBe(true);
  });

  it('should return true for defined functions', function () {
    function foo () {}
    expect(isFunction(foo)).toBe(true);
  });

  it('should return true for function letiables', function () {
    let bar = function () {};
    expect(isFunction(bar)).toBe(true);
  });

  it('should return false for hash objects', function () {
    expect(isFunction({})).toBe(false);
  });

  it('should return false for objects', function () {
    expect(isFunction(new Object ())).toBe(false);
  });

  it('should return false for string primitives', function () {
    expect(isFunction('foo')).toBe(false);
  });
});

describe('isArray()', function () {
  'use strict';
  let isArray = showdown.helper.isArray;

  it('should return true for short syntax arrays', function () {
    expect(isArray([])).toBe(true);
  });

  it('should return true for array objects', function () {
    let myArr = new Array();
    expect(isArray(myArr)).toBe(true);
  });

  it('should return false for functions', function () {
    expect(isArray(function () {})).toBe(false);
    function baz () {}
    expect(isArray(baz)).toBe(false);
  });

  it('should return false for objects', function () {
    expect(isArray({})).toBe(false);
    expect(isArray(new Object ())).toBe(false);
  });

  it('should return false for strings', function () {
    expect(isArray('foo')).toBe(false);
    expect(isArray(new String('foo'))).toBe(false);
  });
});

describe('isUndefined()', function () {
  'use strict';
  let isUndefined = showdown.helper.isUndefined;

  it('should return true if nothing is passed', function () {
    expect(isUndefined()).toBe(true);
  });

  it('should return true if a letiable is initialized but not defined', function () {
    // eslint-disable-next-line no-unassigned-vars -- deliberately unassigned to test isUndefined()
    let myVar;
    expect(isUndefined(myVar)).toBe(true);
  });

  it('should return false for null', function () {
    expect(isUndefined(null)).toBe(false);
  });

  it('should return false for 0', function () {
    expect(isUndefined(0)).toBe(false);
  });

  it('should return false for empty string', function () {
    expect(isUndefined('')).toBe(false);
  });

  it('should return false for empty booleans false or true', function () {
    expect(isUndefined(false)).toBe(false);
    expect(isUndefined(true)).toBe(false);
  });

  it('should return false for anything not undefined', function () {
    expect(isUndefined('foo')).toBe(false);
    expect(isUndefined(2)).toBe(false);
    expect(isUndefined({})).toBe(false);
  });
});

describe('stdExtName()', function () {
  'use strict';
  let stdExtName = showdown.helper.stdExtName;

  it('should remove certain chars', function () {
    let str = 'bla_-  \nbla';
    expect(//[_?*+\/\\.^-]
      stdExtName(str)).not.toMatch(/[_?*+/\\.^-]/g);
  });
  it('should make everything lowercase', function () {
    let str = 'BLABLA';
    expect(//[_?*+\/\\.^-]
      stdExtName(str)).toBe('blabla');
  });
});

describe('forEach()', function () {
  'use strict';
  let forEach = showdown.helper.forEach;

  it('should throw an error if first parameter is undefined', function () {
    expect((function () {forEach();})).toThrow('obj param is required');
  });

  it('should throw an error if second parameter is undefined', function () {
    expect((function () {forEach([]);})).toThrow('callback param is required');
  });

  it('should throw an error if second parameter is not a function', function () {
    expect((function () {forEach([], 'foo');})).toThrow('callback param must be a function/closure');
  });

  it('should throw an error if first parameter is not an object or an array', function () {
    expect((function () {forEach('foo', function () {});})).toThrow('obj does not seem to be an array or an iterable object');
  });

  it('should not throw even if object is empty', function () {
    expect((function () {forEach({}, function () {});})).not.toThrow();
  });

  it('should iterate array items', function () {
    let myArray = ['banana', 'orange', 'grape'];
    forEach(myArray, function (val, key, obj) {
      expect(key).toBeTypeOf('number');
      expect((key % 1)).toBe(0);
      expect(val).toBe(myArray[key]);
      expect(obj).toBe(myArray);
    });
  });

  it('should iterate over object properties', function () {
    let myObj = {foo: 'banana', bar: 'orange', baz: 'grape'};
    forEach(myObj, function (val, key, obj) {
      expect(Object.prototype.hasOwnProperty.call(myObj, key)).toBe(true);
      expect(val).toBe(myObj[key]);
      expect(obj).toBe(myObj);
    });
  });

  it('should iterate only over object own properties', function () {
    let Obj1 = {foo: 'banana'},
        myObj = Object.create(Obj1);
    myObj.bar = 'orange';
    myObj.baz = 'grape';

    expect(Object.prototype.hasOwnProperty.call(myObj, 'bar')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(myObj, 'baz')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(myObj, 'foo')).toBe(false);

    forEach(myObj, function (val, key) {
      expect(key).not.toBe('foo');
    });
  });
});

describe('matchRecursiveRegExp()', function () {
  'use strict';

  let rRegExp = showdown.helper.matchRecursiveRegExp;

  it('should match nested elements', function () {
    let result = rRegExp('<div><div>a</div></div>', '<div\\b[^>]*>', '</div>', 'gim');
    expect(result).toEqual([['<div><div>a</div></div>', '<div>a</div>', '<div>', '</div>']]);
  });

});

describe('repeat()', function () {
  'use strict';
  it('work produce the same output as String.prototype.repeat()', function () {
    if (typeof String.prototype.repeat !== 'undefined') {
      let str = 'foo',
          expected = str.repeat(100),
          actual = showdown.helper.repeat(str, 100);
      expect(expected).toBe(actual);
    }
  });
});

describe('_populateAttributes()', function () {
  'use strict';
  it('should encode a literal double-quote in a value so it cannot break out of the attribute', function () {
    let out = showdown.helper._populateAttributes({href: 'x" onmouseover=alert(1)'});
    expect(out).toBe(' href="x&quot; onmouseover=alert(1)"');
  });
  it('should not double-encode values already escaped by core callers', function () {
    let out = showdown.helper._populateAttributes({href: 'a&quot;b'});
    expect(out).toBe(' href="a&quot;b"');
  });
  it('should leave normal values untouched', function () {
    expect(showdown.helper._populateAttributes({href: 'http://x.com', title: 'hi'}))
      .toBe(' href="http://x.com" title="hi"');
  });
});

describe('isSafeUrl()', function () {
  'use strict';
  let isSafe = showdown.helper.isSafeUrl;
  it('should block dangerous schemes including obfuscated forms', function () {
    ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:x', 'java\tscript:x',
      'java&#115;cript:x', 'vbscript:x', 'data:text/html,x'].forEach(function (u) {
      expect(isSafe(u)).toBe(false);
    });
  });
  it('should allow safe and relative urls', function () {
    ['http://x', 'https://x/a?b=1', '/rel', './rel', '#frag', '//host', 'mailto:a@b', 'tel:+1', 'ftp://f']
      .forEach(function (u) { expect(isSafe(u)).toBe(true); });
  });
  it('should only allow data:image when allowDataImage is set', function () {
    expect(isSafe('data:image/png;base64,AAAA')).toBe(false);
    expect(isSafe('data:image/png;base64,AAAA', {allowDataImage: true})).toBe(true);
    expect(isSafe('data:text/html,x', {allowDataImage: true})).toBe(false);
  });
});

describe('escapeHTMLEntities()', function () {
  'use strict';
  it('should escape & < > "', function () {
    expect(showdown.helper.escapeHTMLEntities('<a href="x">&</a>'))
      .toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

// ---------------------------------------------------------------------------
// helpers/types.js
// ---------------------------------------------------------------------------
describe('helpers/types.js', function () {
  'use strict';

  describe('isNumber()', function () {
    let isNumber = showdown.helper.isNumber;
    it('should return true for number literals', function () {
      expect(isNumber(5)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-3.14)).toBe(true);
    });
    it('should return true for numeric strings (coerced via isNaN)', function () {
      expect(isNumber('5')).toBe(true);
      expect(isNumber('')).toBe(true);
    });
    it('should return false for non-numeric strings', function () {
      expect(isNumber('foo')).toBe(false);
    });
    it('should return false for NaN', function () {
      expect(isNumber(NaN)).toBe(false);
    });
  });

  describe('isObject()', function () {
    let isObject = showdown.helper.isObject;
    it('should return true for plain objects', function () {
      expect(isObject({})).toBe(true);
      expect(isObject({foo: 'bar'})).toBe(true);
    });
    it('should return false for arrays', function () {
      expect(isObject([])).toBe(false);
      expect(isObject(['a'])).toBe(false);
    });
    it('should return false for null', function () {
      expect(isObject(null)).toBe(false);
    });
    it('should return false for primitives', function () {
      expect(isObject('foo')).toBe(false);
      expect(isObject(5)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/text.js
// ---------------------------------------------------------------------------
describe('helpers/text.js', function () {
  'use strict';

  describe('trimStart()', function () {
    let trimStart = showdown.helper.trimStart;
    it('should strip leading ASCII whitespace', function () {
      expect(trimStart('  \t\nfoo')).toBe('foo');
    });
    it('should strip leading unicode whitespace (CM whitespace class)', function () {
      expect(trimStart('  　foo')).toBe('foo');
      expect(trimStart('﻿foo')).toBe('foo');
    });
    it('should not touch trailing whitespace', function () {
      expect(trimStart('  foo  ')).toBe('foo  ');
    });
  });

  describe('trimEnd()', function () {
    let trimEnd = showdown.helper.trimEnd;
    it('should strip trailing ASCII whitespace', function () {
      expect(trimEnd('foo \t\n')).toBe('foo');
    });
    it('should strip trailing unicode whitespace (CM whitespace class)', function () {
      expect(trimEnd('foo  　')).toBe('foo');
      expect(trimEnd('foo﻿')).toBe('foo');
    });
    it('should not touch leading whitespace', function () {
      expect(trimEnd('  foo  ')).toBe('  foo');
    });
  });

  describe('caseFold()', function () {
    let caseFold = showdown.helper.caseFold;
    it('should uppercase-fold ASCII', function () {
      expect(caseFold('Foo')).toBe('FOO');
    });
    it('should fold ß, ẞ and SS together', function () {
      expect(caseFold('ß')).toBe('SS');
      expect(caseFold('ẞ')).toBe('SS');
      expect(caseFold('ss')).toBe('SS');
      expect(caseFold('ß')).toBe(caseFold('ẞ'));
    });
  });

  describe('expandCmTabs()', function () {
    let expandCmTabs = showdown.helper.expandCmTabs;
    it('should return the text unchanged when there is no tab', function () {
      expect(expandCmTabs('foo bar')).toBe('foo bar');
    });
    it('should expand a leading tab to a 4-column tab stop', function () {
      expect(expandCmTabs('\tfoo')).toBe('    foo');
    });
    it('should honor the current column for tab-stop math', function () {
      // 2 leading spaces put the tab at column 2, so it advances only 2 columns
      expect(expandCmTabs('  \tfoo')).toBe('    foo');
    });
    it('should account for a list marker when computing the tab stop', function () {
      // `-` is a marker at column 0, so the following tab advances 3 columns
      expect(expandCmTabs('-\tfoo')).toBe('-   foo');
    });
    it('should preserve tabs that appear in content (after the prefix)', function () {
      expect(expandCmTabs('foo\tbar')).toBe('foo\tbar');
    });
    it('should leave a thematic break untouched', function () {
      expect(expandCmTabs('*\t*\t*')).toBe('*\t*\t*');
    });
  });

  describe('normalizeLeadingTabs()', function () {
    let normalizeLeadingTabs = showdown.helper.normalizeLeadingTabs;
    it('should convert 1-3 leading spaces followed by a tab into a single tab', function () {
      expect(normalizeLeadingTabs('   \tfoo')).toBe('\tfoo');
      expect(normalizeLeadingTabs(' \tfoo')).toBe('\tfoo');
    });
    it('should not convert 4 leading spaces followed by a tab', function () {
      expect(normalizeLeadingTabs('    \tfoo')).toBe('    \tfoo');
    });
    it('should operate per line', function () {
      expect(normalizeLeadingTabs('  \tfoo\n   \tbar')).toBe('\tfoo\n\tbar');
    });
  });

  describe('outdent()', function () {
    let outdent = showdown.helper.outdent;
    it('should remove up to four leading spaces per line', function () {
      expect(outdent('    foo')).toBe('foo');
      expect(outdent('   foo')).toBe('foo');
    });
    it('should remove one leading tab per line', function () {
      expect(outdent('\tfoo')).toBe('foo');
    });
    it('should operate per line', function () {
      expect(outdent('    foo\n\tbar')).toBe('foo\nbar');
    });
    it('should return non-string input unchanged', function () {
      expect(outdent(5)).toBe(5);
    });
  });

  describe('regexIndexOf()', function () {
    let regexIndexOf = showdown.helper.regexIndexOf;
    it('should return the index of the first match', function () {
      expect(regexIndexOf('abcdef', /cd/)).toBe(2);
    });
    it('should honor fromIndex', function () {
      expect(regexIndexOf('abcabc', /a/, 1)).toBe(3);
    });
    it('should return -1 when there is no match', function () {
      expect(regexIndexOf('abcdef', /zz/)).toBe(-1);
    });
    it('should throw if the first argument is not a string', function () {
      expect(function () { regexIndexOf(5, /a/); }).toThrow('InvalidArgumentError');
    });
    it('should throw if the second argument is not a RegExp', function () {
      expect(function () { regexIndexOf('foo', 'a'); }).toThrow('InvalidArgumentError');
    });
  });

  describe('splitAtIndex()', function () {
    let splitAtIndex = showdown.helper.splitAtIndex;
    it('should split a string into two parts at the index', function () {
      expect(splitAtIndex('abcdef', 3)).toEqual(['abc', 'def']);
    });
    it('should handle index 0 and past the end', function () {
      expect(splitAtIndex('abc', 0)).toEqual(['', 'abc']);
      expect(splitAtIndex('abc', 99)).toEqual(['abc', '']);
    });
    it('should throw if the first argument is not a string', function () {
      expect(function () { splitAtIndex(5, 1); }).toThrow('InvalidArgumentError');
    });
  });

  describe('replaceRecursiveRegExp()', function () {
    let replaceRecursiveRegExp = showdown.helper.replaceRecursiveRegExp;
    it('should replace nested constructs using a function replacement', function () {
      let out = replaceRecursiveRegExp('<div><div>a</div></div>', function (wm, match) {
        return '[' + match + ']';
      }, '<div\\b[^>]*>', '</div>', 'gim');
      expect(out).toBe('[<div>a</div>]');
    });
    it('should accept a plain string replacement', function () {
      expect(replaceRecursiveRegExp('x(a(b)c)y', '_', '\\(', '\\)', 'g')).toBe('x_y');
    });
    it('should replace every top-level match with the "g" flag', function () {
      expect(replaceRecursiveRegExp('(a)(b)', '_', '\\(', '\\)', 'g')).toBe('__');
    });
    it('should return the input unchanged when there is no match', function () {
      expect(replaceRecursiveRegExp('abc', '_', '\\(', '\\)', 'g')).toBe('abc');
    });
  });

  describe('padEnd()', function () {
    let padEnd = showdown.helper.padEnd;
    it('should pad the end with the given pad string', function () {
      expect(padEnd('5', 3, '0')).toBe('500');
    });
    it('should pad with spaces by default', function () {
      expect(padEnd('a', 3)).toBe('a  ');
    });
    it('should return the string unchanged when already long enough', function () {
      expect(padEnd('foo', 2)).toBe('foo');
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/escapes.js
// ---------------------------------------------------------------------------
describe('helpers/escapes.js', function () {
  'use strict';

  describe('escapePlaceholder() / escapeCharactersCallback()', function () {
    it('should produce the ¨E<code>E placeholder for a character', function () {
      expect(showdown.helper.escapePlaceholder('*')).toBe('¨E42E');
      expect(showdown.helper.escapePlaceholder('_')).toBe('¨E95E');
    });
    it('escapeCharactersCallback should placeholder-escape its capture group', function () {
      expect(showdown.helper.escapeCharactersCallback('*', '*')).toBe('¨E42E');
    });
  });

  describe('escapeCharacters()', function () {
    let escapeCharacters = showdown.helper.escapeCharacters;
    it('should escape each listed character to a placeholder', function () {
      expect(escapeCharacters('a*b_c', '*_', false)).toBe('a¨E42Eb¨E95Ec');
    });
    it('should only escape after a backslash when afterBackslash is set', function () {
      expect(escapeCharacters('\\*', '*', true)).toBe('¨E42E');
      expect(escapeCharacters('*', '*', true)).toBe('*');
    });
  });

  describe('unescapePlaceholders()', function () {
    let unescapePlaceholders = showdown.helper.unescapePlaceholders;
    it('should restore a placeholder to its literal character', function () {
      expect(unescapePlaceholders('¨E42Ex')).toBe('*x');
    });
    it('should apply the optional transform to each restored character', function () {
      let out = unescapePlaceholders('¨E42E', function (chr) { return '\\' + chr; });
      expect(out).toBe('\\*');
    });
  });

  describe('backslashEscapePlaceholders()', function () {
    it('should prefix each placeholder with a backslash but keep the placeholder', function () {
      expect(showdown.helper.backslashEscapePlaceholders('¨E42E')).toBe('\\¨E42E');
    });
  });

  describe('hashDollarsAndTremas() / restoreDollarsAndTremas()', function () {
    let hash = showdown.helper.hashDollarsAndTremas,
        restore = showdown.helper.restoreDollarsAndTremas;
    it('should hide $ and ¨ behind the ¨D/¨T sentinels', function () {
      expect(hash('$')).toBe('¨D');
      expect(hash('¨')).toBe('¨T');
    });
    it('should round-trip $ and ¨ intact', function () {
      let src = 'a$b¨c$$¨¨';
      expect(restore(hash(src))).toBe(src);
    });
  });

  describe('unescapeHTMLEntities()', function () {
    let unescapeHTMLEntities = showdown.helper.unescapeHTMLEntities;
    it('should decode & < > " entities', function () {
      expect(unescapeHTMLEntities('&lt;&gt;&amp;&quot;')).toBe('<>&"');
    });
    it('should be the inverse of escapeHTMLEntities', function () {
      let src = '<a href="x">& stuff</a>';
      expect(unescapeHTMLEntities(showdown.helper.escapeHTMLEntities(src))).toBe(src);
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/url.js
// ---------------------------------------------------------------------------
describe('helpers/url.js', function () {
  'use strict';

  describe('URLUtils', function () {
    it('should parse the components of an absolute URL', function () {
      let u = new showdown.helper.URLUtils('http://user:pass@host.com:8080/a/b?x=1#frag');
      expect(u.protocol).toBe('http:');
      expect(u.host).toBe('host.com:8080');
      expect(u.hostname).toBe('host.com');
      expect(u.port).toBe('8080');
      expect(u.pathname).toBe('/a/b');
      expect(u.search).toBe('?x=1');
      expect(u.hash).toBe('#frag');
      expect(u.username).toBe('user');
      expect(u.password).toBe('pass');
      expect(u.href).toBe('http://user:pass@host.com:8080/a/b?x=1#frag');
    });
    it('should resolve a relative path against a base URL', function () {
      let u = new showdown.helper.URLUtils('foo.html', 'http://host.com/a/b/page.html');
      expect(u.href).toBe('http://host.com/a/b/foo.html');
    });
    it('should resolve dot segments against a base URL', function () {
      let u = new showdown.helper.URLUtils('../c/d', 'http://host.com/a/b/page.html');
      expect(u.href).toBe('http://host.com/a/c/d');
    });
  });

  describe('applyBaseUrl()', function () {
    let applyBaseUrl = showdown.helper.applyBaseUrl;
    it('should pass an absolute URL through unchanged', function () {
      expect(applyBaseUrl('http://base.com/', 'http://other.com/x')).toBe('http://other.com/x');
    });
    it('should resolve a relative URL against the base', function () {
      expect(applyBaseUrl('http://base.com/dir/', 'foo.html')).toBe('http://base.com/dir/foo.html');
    });
    it('should pass the URL through unchanged when no base is given', function () {
      expect(applyBaseUrl('', 'foo.html')).toBe('foo.html');
    });
  });

  describe('isAbsolutePath()', function () {
    let isAbsolutePath = showdown.helper.isAbsolutePath;
    it('should treat protocol and protocol-relative URLs as absolute', function () {
      expect(isAbsolutePath('http://x')).toBe(true);
      expect(isAbsolutePath('//x')).toBe(true);
    });
    it('should treat fragments as absolute', function () {
      expect(isAbsolutePath('#x')).toBe(true);
    });
    it('should treat plain relative paths as not absolute', function () {
      expect(isAbsolutePath('foo/bar')).toBe(false);
      expect(isAbsolutePath('./foo')).toBe(false);
    });
  });

  describe('urlASCIIEncoding()', function () {
    it('should percent-encode backslashes and spaces', function () {
      expect(showdown.helper.urlASCIIEncoding('a\\b c')).toBe('a%5Cb%20c');
    });
  });

  describe('safeUrlSchemes', function () {
    it('should be a list of the expected allowed schemes', function () {
      let schemes = showdown.helper.safeUrlSchemes;
      expect(showdown.helper.isArray(schemes)).toBe(true);
      ['http', 'https', 'ftp', 'mailto', 'tel'].forEach(function (s) {
        expect(schemes.indexOf(s)).not.toBe(-1);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/commonmark.js
// ---------------------------------------------------------------------------
describe('helpers/commonmark.js', function () {
  'use strict';

  describe('cmDecodeEntities()', function () {
    let cmDecodeEntities = showdown.helper.cmDecodeEntities;
    it('should decode named references', function () {
      expect(cmDecodeEntities('&ouml;')).toBe('ö');
      expect(cmDecodeEntities('&amp;')).toBe('&');
    });
    it('should decode decimal references', function () {
      expect(cmDecodeEntities('&#246;')).toBe('ö');
    });
    it('should decode hexadecimal references', function () {
      expect(cmDecodeEntities('&#xf6;')).toBe('ö');
    });
    it('should leave invalid references verbatim', function () {
      expect(cmDecodeEntities('&nope;')).toBe('&nope;');
    });
    it('should map zero, out-of-range and surrogate code points to U+FFFD', function () {
      expect(cmDecodeEntities('&#0;')).toBe('�');
      expect(cmDecodeEntities('&#x110000;')).toBe('�');
      expect(cmDecodeEntities('&#xD800;')).toBe('�');
    });
  });

  describe('cmEncodeURI()', function () {
    let cmEncodeURI = showdown.helper.cmEncodeURI;
    it('should percent-encode unsafe characters', function () {
      expect(cmEncodeURI('a b')).toBe('a%20b');
    });
    it('should preserve existing percent-encoded sequences', function () {
      expect(cmEncodeURI('a%20b')).toBe('a%20b');
    });
    it('should encode a stray percent that is not a valid escape', function () {
      expect(cmEncodeURI('a%zz')).toBe('a%25zz');
    });
    it('should leave safe-set characters untouched', function () {
      expect(cmEncodeURI('a/b?c=d&e#f')).toBe('a/b?c=d&e#f');
    });
    it('should UTF-8 percent-encode non-ASCII characters', function () {
      expect(cmEncodeURI('café')).toBe('caf%C3%A9');
    });
  });

  describe('cmNormalizeURL()', function () {
    let cmNormalizeURL = showdown.helper.cmNormalizeURL;
    it('should resolve backslash escapes of punctuation', function () {
      expect(cmNormalizeURL('foo\\*bar')).toBe('foo*bar');
    });
    it('should guard a bare ampersand as &amp; but keep real entities', function () {
      expect(cmNormalizeURL('a&b')).toBe('a&amp;b');
      expect(cmNormalizeURL('a&amp;b')).toBe('a&amp;b');
    });
    it('should restore escape placeholders to their literal characters', function () {
      expect(cmNormalizeURL(showdown.helper.escapePlaceholder('*') + 'x')).toBe('*x');
    });
  });

  describe('cmEscapeTitle()', function () {
    let cmEscapeTitle = showdown.helper.cmEscapeTitle;
    it('should decode references then HTML-escape the significant characters', function () {
      expect(cmEscapeTitle('a "b" <c> & &amp;')).toBe('a &quot;b&quot; &lt;c&gt; &amp; &amp;');
    });
  });

  describe('cmNormalizeLabel()', function () {
    let cmNormalizeLabel = showdown.helper.cmNormalizeLabel;
    it('should collapse whitespace, trim and case-fold', function () {
      expect(cmNormalizeLabel('  Foo   Bar  ')).toBe('FOO BAR');
    });
    it('should NOT resolve raw backslash escapes', function () {
      expect(cmNormalizeLabel('foo\\!bar')).toBe('FOO\\!BAR');
    });
    it('should restore escape placeholders', function () {
      expect(cmNormalizeLabel(showdown.helper.escapePlaceholder('!'))).toBe('!');
    });
  });

  describe('cmScanDestination()', function () {
    let cmScanDestination = showdown.helper.cmScanDestination;
    it('should scan an angle-bracket destination', function () {
      expect(cmScanDestination('<foo bar>', 0)).toEqual({url: 'foo bar', end: 9, angle: true});
    });
    it('should scan an empty angle-bracket destination', function () {
      expect(cmScanDestination('<>', 0)).toEqual({url: '', end: 2, angle: true});
    });
    it('should scan a bare destination up to whitespace', function () {
      expect(cmScanDestination('foo bar', 0)).toEqual({url: 'foo', end: 3, angle: false});
    });
    it('should allow balanced parentheses in a bare destination', function () {
      expect(cmScanDestination('a(b(c)d)e rest', 0)).toEqual({url: 'a(b(c)d)e', end: 9, angle: false});
    });
    it('should keep backslash escapes in the scanned destination', function () {
      expect(cmScanDestination('a\\)b rest', 0)).toEqual({url: 'a\\)b', end: 4, angle: false});
    });
    it('should return null for an unbalanced bare destination', function () {
      expect(cmScanDestination('a(b', 0)).toBe(null);
    });
    it('should return null for an angle destination containing a raw newline', function () {
      expect(cmScanDestination('<a\nb>', 0)).toBe(null);
    });
  });

  describe('cmScanTitle()', function () {
    let cmScanTitle = showdown.helper.cmScanTitle;
    it('should scan a double-quoted title', function () {
      expect(cmScanTitle('"foo" rest', 0)).toEqual({title: 'foo', end: 5});
    });
    it('should scan a single-quoted title', function () {
      expect(cmScanTitle('\'foo\' rest', 0)).toEqual({title: 'foo', end: 5});
    });
    it('should scan a parenthesized title', function () {
      expect(cmScanTitle('(foo) rest', 0)).toEqual({title: 'foo', end: 5});
    });
    it('should keep backslash escapes in the scanned title', function () {
      expect(cmScanTitle('"a\\"b"', 0)).toEqual({title: 'a\\"b', end: 6});
    });
    it('should return null for an unescaped ( inside a parenthesized title', function () {
      expect(cmScanTitle('(foo(bar)) rest', 0)).toBe(null);
    });
    it('should return null for an unterminated title', function () {
      expect(cmScanTitle('"foo', 0)).toBe(null);
    });
    it('should return null when the title contains a blank line', function () {
      expect(cmScanTitle('"foo\n\nbar"', 0)).toBe(null);
    });
    it('should return null when the start index is not an opening delimiter', function () {
      expect(cmScanTitle('foo', 0)).toBe(null);
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/markdownEscapes.js
// ---------------------------------------------------------------------------
describe('helpers/markdownEscapes.js', function () {
  'use strict';

  it('escapeMarkdownDestination should escape \\ < >', function () {
    expect(showdown.helper.escapeMarkdownDestination('a<b>c\\d')).toBe('a\\<b\\>c\\\\d');
  });
  it('escapeMarkdownTitle should escape \\ "', function () {
    expect(showdown.helper.escapeMarkdownTitle('a"b\\c')).toBe('a\\"b\\\\c');
  });
  it('escapeMarkdownText should escape \\ [ ]', function () {
    expect(showdown.helper.escapeMarkdownText('a[b]c\\d')).toBe('a\\[b\\]c\\\\d');
  });
});

// ---------------------------------------------------------------------------
// helpers/misc.js
// ---------------------------------------------------------------------------
describe('helpers/misc.js', function () {
  'use strict';

  describe('cloneObject()', function () {
    let cloneObject = showdown.helper.cloneObject;
    it('should return primitives and null unchanged', function () {
      expect(cloneObject(5)).toBe(5);
      expect(cloneObject(null)).toBe(null);
    });
    it('should shallow-clone by default (nested references shared)', function () {
      let src = {a: {b: 1}},
          clone = cloneObject(src);
      expect(clone).not.toBe(src);
      expect(clone.a).toBe(src.a);
    });
    it('should deep-clone when the deep flag is set', function () {
      let src = {a: {b: 1}},
          clone = cloneObject(src, true);
      expect(clone).not.toBe(src);
      expect(clone.a).not.toBe(src.a);
      expect(clone.a.b).toBe(1);
    });
    it('should clone Date instances', function () {
      let d = new Date(0),
          clone = cloneObject(d);
      expect(clone).not.toBe(d);
      expect(clone instanceof Date).toBe(true);
      expect(clone.getTime()).toBe(0);
    });
  });

  describe('applyFlavor()', function () {
    it('should copy the preset overrides onto the target', function () {
      let target = {a: 1, b: 2};
      showdown.helper.applyFlavor({b: 9, c: 3}, target);
      expect(target).toEqual({a: 1, b: 9, c: 3});
    });
  });

  describe('validateOptions()', function () {
    let validateOptions = showdown.helper.validateOptions;
    it('should throw if options is not an object', function () {
      expect(function () { validateOptions('foo'); }).toThrow('Options must be an object');
    });
    it('should fill in missing options with their default values', function () {
      let out = validateOptions({});
      expect(showdown.helper.isObject(out)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(out, 'omitExtraWLInCodeBlocks')).toBe(true);
    });
    it('should throw when an option has the wrong type', function () {
      expect(function () {
        validateOptions({omitExtraWLInCodeBlocks: 'notABoolean'});
      }).toThrow('must be of type boolean');
    });
  });

  describe('_hashHTMLSpan()', function () {
    it('should produce a ¨C<n>C placeholder resolvable by unhashHTMLSpans', function () {
      let globals = {gHtmlSpans: []},
          opts = showdown.getDefaultOptions(),
          ph = showdown.helper._hashHTMLSpan('<b>x</b>', globals);
      expect(ph).toBe('¨C0C');
      expect(globals.gHtmlSpans[0]).toBe('<b>x</b>');
      expect(showdown.helper.unhashHTMLSpans(ph, opts, globals)).toBe('<b>x</b>');
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/emojis.js
// ---------------------------------------------------------------------------
describe('helpers/emojis.js', function () {
  'use strict';

  it('the emojis table should contain canonical entries', function () {
    expect(showdown.helper.emojis.smile).toBe('😄');
    expect(showdown.helper.isString(showdown.helper.emojis.heart)).toBe(true);
    expect(showdown.helper.emojis.heart.length).toBeGreaterThan(0);
  });

  describe('emojiReverse()', function () {
    it('should invert the unicode emoji table', function () {
      let rev = showdown.helper.emojiReverse();
      expect(rev.unicode[showdown.helper.emojis.smile]).toBe('smile');
    });
    it('should expose an images map and a matching regex', function () {
      let rev = showdown.helper.emojiReverse();
      expect(showdown.helper.isObject(rev.images)).toBe(true);
      expect(rev.regex instanceof RegExp).toBe(true);
    });
    it('should return the same cached object on subsequent calls', function () {
      expect(showdown.helper.emojiReverse()).toBe(showdown.helper.emojiReverse());
    });
  });
});

// ---------------------------------------------------------------------------
// helpers/regexes.js
// ---------------------------------------------------------------------------
describe('helpers/regexes.js', function () {
  'use strict';

  it('should expose the expected keys', function () {
    let regexes = showdown.helper.regexes;
    ['asteriskDashTildeAndColon', 'asteriskDashAndTilde', 'cmHTMLTagSource',
      'cmOpenTagSource', 'cmCloseTagSource'].forEach(function (key) {
      expect(Object.prototype.hasOwnProperty.call(regexes, key)).toBe(true);
    });
  });
  it('should expose precompiled RegExps for the character classes', function () {
    expect(showdown.helper.regexes.asteriskDashTildeAndColon instanceof RegExp).toBe(true);
    expect(showdown.helper.regexes.asteriskDashAndTilde instanceof RegExp).toBe(true);
  });
  it('should expose the CommonMark grammar as source strings', function () {
    expect(typeof showdown.helper.regexes.cmHTMLTagSource).toBe('string');
    expect(typeof showdown.helper.regexes.cmOpenTagSource).toBe('string');
    expect(typeof showdown.helper.regexes.cmCloseTagSource).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// helpers/htmlEntities.js
// ---------------------------------------------------------------------------
describe('helpers/htmlEntities.js', function () {
  'use strict';

  it('should map the core named references to the correct characters', function () {
    let entities = showdown.helper.htmlEntities;
    expect(entities.amp).toBe('&');
    expect(entities.lt).toBe('<');
    expect(entities.gt).toBe('>');
    expect(entities.quot).toBe('"');
    expect(entities.copy).toBe('©');
  });
});

// ---------------------------------------------------------------------------
// helpers mechanisms (encode*/hash*/escapeSpecialCharsWithinTagAttributes)
// Contract-level coverage — the functional fixtures carry the exhaustive load.
// ---------------------------------------------------------------------------
describe('helpers mechanisms', function () {
  'use strict';

  let options = showdown.getDefaultOptions();
  function mkGlobals () {
    return {
      gHtmlBlocks: [],
      gHtmlRawBlocks: [],
      gHtmlSpans: [],
      ghCodeBlocks: [],
      converter: new showdown.Converter()
    };
  }

  describe('encodeCode()', function () {
    it('should entity-encode & < > " and placeholder the markdown magic chars', function () {
      expect(showdown.helper.encodeCode('a<b>&"*_')).toBe('a&lt;b&gt;&amp;&quot;¨E42E¨E95E');
    });
  });

  describe('encodeAmpsAndAngles()', function () {
    it('should guard bare & but leave entity references alone', function () {
      expect(showdown.helper.encodeAmpsAndAngles('a & b &amp; <c> "d"'))
        .toBe('a &amp; b &amp; &lt;c&gt; &quot;d&quot;');
    });
  });

  describe('encodeBackslashEscapes()', function () {
    it('should convert backslash escapes to placeholders', function () {
      expect(showdown.helper.encodeBackslashEscapes('\\* \\\\')).toBe('¨E42E ¨E92E');
    });
  });

  describe('escapeSpecialCharsWithinTagAttributes()', function () {
    it('should escape the magic chars inside a tag', function () {
      expect(showdown.helper.escapeSpecialCharsWithinTagAttributes('<a href="_x_">*b*</a>', options))
        .toBe('<a href¨E61E"¨E95Ex¨E95E">*b*</a>');
    });
    it('should be a no-op in cmSpec mode', function () {
      expect(showdown.helper.escapeSpecialCharsWithinTagAttributes('<a href="_x_">*b*</a>', {cmSpec: true}))
        .toBe('<a href="_x_">*b*</a>');
    });
  });

  describe('hashBlock()', function () {
    it('should emit a ¨K<n>K placeholder registered in globals.gHtmlBlocks', function () {
      let globals = mkGlobals();
      expect(showdown.helper.hashBlock('\n\n<div>x</div>\n\n', options, globals)).toBe('\n\n¨K0K\n\n');
      expect(globals.gHtmlBlocks[0]).toBe('<div>x</div>');
    });
  });

  describe('hashHTMLSpans() / unhashHTMLSpans()', function () {
    it('should hash inline spans to ¨C<n>C placeholders and round-trip back', function () {
      let globals = mkGlobals(),
          hashed = showdown.helper.hashHTMLSpans('a <span>x</span> b <br/> c', options, globals);
      expect(hashed).toMatch(/¨C\d+C/);
      expect(globals.gHtmlSpans.length).toBe(2);
      expect(showdown.helper.unhashHTMLSpans(hashed, options, globals))
        .toBe('a <span>x</span> b <br/> c');
    });
  });

  describe('hashCodeTags()', function () {
    it('should protect <code> content and store the encoded block', function () {
      let globals = mkGlobals();
      expect(showdown.helper.hashCodeTags('a <code>x<y></code> b', options, globals)).toBe('a ¨C0C b');
      expect(globals.gHtmlSpans[0]).toBe('<code>x&lt;y&gt;</code>');
    });
  });

  describe('hashPreCodeTags()', function () {
    it('should protect <pre><code> blocks in ghCodeBlocks', function () {
      let globals = mkGlobals(),
          input = '<pre><code>\nvar x = 1 < 2 & 3;\n</code></pre>',
          out = showdown.helper.hashPreCodeTags(input, options, globals);
      expect(out).toBe('\n\n¨G0G\n\n');
      expect(globals.ghCodeBlocks[0].text).toBe(input);
      expect(globals.ghCodeBlocks[0].codeblock).toContain('&lt; 2 &amp; 3;');
    });
  });

  describe('hashHTMLBlocks()', function () {
    it('should hash a block-level tag to a ¨K<n>K placeholder', function () {
      let globals = mkGlobals();
      expect(showdown.helper.hashHTMLBlocks('<div>\nfoo\n</div>', options, globals)).toBe('\n\n¨K0K\n\n');
      expect(globals.gHtmlBlocks[0]).toBe('<div>\nfoo\n</div>');
    });
  });
});
