/**
 * @file      helpers/url.js
 * @summary   URL parsing, base-URL resolution, safeMode scheme guard, ASCII encoding and email obfuscation.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `URLUtils`, `applyBaseUrl`, `isAbsolutePath`, `isSafeUrl` (+ `safeUrlSchemes`),
 * `urlASCIIEncoding` and `encodeEmailAddress` (with its seeded RNG helpers). Load-order safe:
 * the RNG helpers used at call time live in this file; nothing here reads another helper's
 * state at load time.
 */

/**
 * MurmurHash3's mixing function
 * https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
 *
 * @param {string} string
 * @returns {Number}
 */
/*jshint bitwise: false*/
function xmur3 (str) {
  let h;
  for (let i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function () {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/**
 * Random Number Generator
 * https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
 *
 * @param {Number} seed
 * @returns {Number}
 */
/*jshint bitwise: false*/
function mulberry32 (a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Obfuscate an e-mail address through the use of Character Entities,
 * transforming ASCII characters into their equivalent decimal or hex entities.
 *
 *
 * @param {string} mail
 * @returns {string}
 */
showdown.helper.encodeEmailAddress = function (mail) {
  'use strict';
  let encode = [
    function (ch) {
      return '&#' + ch.charCodeAt(0) + ';';
    },
    function (ch) {
      return '&#x' + ch.charCodeAt(0).toString(16) + ';';
    },
    function (ch) {
      return ch;
    }
  ];

  // RNG seeded with mail, so that we can get determined results for each email.
  let rand = mulberry32(xmur3(mail));

  mail = mail.replace(/./g, function (ch) {
    if (ch === '@') {
      // this *must* be encoded. I insist.
      ch = encode[Math.floor(rand() * 2)](ch);
    } else {
      let r = rand();
      // roughly 10% raw, 45% hex, 45% dec
      ch = (
        r > 0.9 ? encode[2](ch) : r > 0.45 ? encode[1](ch) : encode[0](ch)
      );
    }
    return ch;
  });

  return mail;
};

/**
 * Prepends a base URL to relative paths.
 *
 * @param {string} baseUrl the base URL to prepend to a relative path
 * @param {string} url the path to modify, which may be relative
 * @returns {string} the full URL
 */
showdown.helper.applyBaseUrl = function (baseUrl, url) {
  // Only prepend if given a base URL and the path is not absolute.
  if (baseUrl && baseUrl !== '' && !showdown.helper.isAbsolutePath(url)) {
    let urlResolve = new showdown.helper.URLUtils(url, baseUrl);
    url = urlResolve.href;
  }

  return url;
};

/**
 * Checks if the given path is absolute.
 *
 * @param {string} path the path to test for absolution
 * @returns {boolean} `true` if the given path is absolute, else `false`
 */
showdown.helper.isAbsolutePath = function (path) {
  // Absolute paths begin with '[protocol:]//' or '#' (anchors)
  return /(^([a-z]+:)?\/\/)|(^#)/i.test(path);
};

// URL schemes allowed by safeMode. Relative URLs, fragments (#...) and
// protocol-relative URLs (//host) carry no scheme and are always allowed.
showdown.helper.safeUrlSchemes = ['http', 'https', 'ftp', 'ftps', 'mailto', 'tel', 'sms'];

/**
 * safeMode URL guard: decide whether a link/image destination is safe to emit.
 * Rejects dangerous schemes (javascript:, vbscript:, data:text/html, ...). The
 * scheme is resolved after decoding character references and stripping the
 * characters browsers ignore when parsing a scheme (whitespace and control
 * chars), so evasions like `java&#115;cript:` or `java\tscript:` are caught.
 * `data:` is only permitted when opts.allowDataImage is set and the payload is a
 * `data:image/...` URL (so inline base64 images keep working under safeMode).
 * @param {string} url
 * @param {{allowDataImage?: boolean}} [opts]
 * @returns {boolean}
 */
showdown.helper.isSafeUrl = function (url, opts) {
  'use strict';
  let allowDataImage = !!(opts && opts.allowDataImage);
  // resolve character references (numeric + named) that could hide the scheme
  let decoded = showdown.helper.cmDecodeEntities(String(url));
  // restore showdown's internal escape placeholders (¨E<code>E) to their chars
  decoded = showdown.helper.unescapePlaceholders(decoded);
  // remove whitespace/control chars browsers ignore while resolving the scheme
  // eslint-disable-next-line no-control-regex -- intentionally stripping ASCII control chars used to obfuscate schemes
  let stripped = decoded.replace(/[\u0000-\u0020\u00a0]+/g, '');
  let m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(stripped);
  if (!m) {
    // no scheme: relative path, fragment (#...) or protocol-relative (//host)
    return true;
  }
  let scheme = m[1].toLowerCase();
  if (scheme === 'data') {
    return allowDataImage && /^data:image\//i.test(stripped);
  }
  return showdown.helper.safeUrlSchemes.indexOf(scheme) !== -1;
};

showdown.helper.URLUtils = function (url, baseURL) {
  const pattern2 = /^([^:/?#]+:)?(?:\/\/(?:([^:@/?#]*)(?::([^:@/?#]*))?@)?(([^:/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;

  let m = String(url)
    .trim()
    .match(pattern2);
  if (!m) {
    throw new RangeError();
  }
  let protocol = m[1] || '';
  let username = m[2] || '';
  let password = m[3] || '';
  let host = m[4] || '';
  let hostname = m[5] || '';
  let port = m[6] || '';
  let pathname = m[7] || '';
  let search = m[8] || '';
  let hash = m[9] || '';
  if (baseURL !== undefined) {
    let base = new showdown.helper.URLUtils(baseURL);
    let flag = protocol === '' && host === '' && username === '';
    if (flag && pathname === '' && search === '') {
      search = base.search;
    }
    if (flag && pathname.charAt(0) !== '/') {
      pathname = (pathname !== '' ? (((base.host !== '' || base.username !== '') && base.pathname === '' ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + pathname) : base.pathname);
    }
    // dot segments removal
    let output = [];
    pathname.replace(/^(\.\.?(\/|$))+/, '')
      .replace(/\/(\.(\/|$))+/g, '/')
      .replace(/\/\.\.$/, '/../')
      .replace(/\/?[^/]*/g, function (p) {
        if (p === '/..') {
          output.pop();
        } else {
          output.push(p);
        }
      });
    pathname = output.join('').replace(/^\//, pathname.charAt(0) === '/' ? '/' : '');
    if (flag) {
      port = base.port;
      hostname = base.hostname;
      host = base.host;
      password = base.password;
      username = base.username;
    }
    if (protocol === '') {
      protocol = base.protocol;
    }
  }
  //this.origin = protocol + (protocol !== '' || host !== '' ? '//' : '') + host;
  this.href = protocol + (protocol !== '' || host !== '' ? '//' : '') + (username !== '' ? username + (password !== '' ? ':' + password : '') + '@' : '') + host + pathname + search + hash;
  this.protocol = protocol;
  this.username = username;
  this.password = password;
  this.host = host;
  this.hostname = hostname;
  this.port = port;
  this.pathname = pathname;
  this.search = search;
  this.hash = hash;
};

/**
 *
 * @param {string} url
 * @returns {string}
 */
showdown.helper.urlASCIIEncoding = function (url) {
  url = url
    .replace(/\\/g, '%5C')
    .replace(/ /g, '%20');

  return url;
};
