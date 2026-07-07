/**
 * @file      helpers/lazyDocument.js
 * @summary   Lazily resolves a DOM for `makeMarkdown` (`showdown.helper.document`) and exposes the inert-parse `showdown.helper.parseHTML`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Resolution is lazy (first access of `showdown.helper.document`) so Node users that only call
 * makeHtml never pay the cost of loading happy-dom; in environments with an ambient window/document
 * (browsers, DOM test environments) the require branch is never reached, so happy-dom never ends up
 * in bundles. `parseHTML` parses untrusted HTML inside an inert document so `<script>` /
 * `<img onerror>` never execute. A `showdown.helper.*` mechanism, not a construct; emits no events.
 */
let lazyDocument = null;
Object.defineProperty(showdown.helper, 'document', {
  get: function () {
    'use strict';
    if (lazyDocument === null) {
      if (typeof window !== 'undefined' && window.document) {
        lazyDocument = window.document;
      } else if (typeof document !== 'undefined') {
        lazyDocument = document;
      } else if (typeof require === 'function') {
        let happyDom = require('happy-dom');
        lazyDocument = new happyDom.Window().document;
      } else {
        throw new Error('makeMarkdown requires a DOM: provide a global window/document, ' +
          'or run in Node (CommonJS) with happy-dom installed.');
      }
    }
    return lazyDocument;
  }
});

/**
 * Parse an untrusted HTML string into a detached <div> and return it, for
 * makeMarkdown to walk. The HTML is parsed inside an *inert* document (one with
 * no browsing context, obtained via document.implementation.createHTMLDocument)
 * whenever the host DOM supports it. In an inert document, assigning to innerHTML
 * never executes <script> and never triggers resource loads or fires on* handlers
 * such as `<img onerror>` / `<svg onload>` — so parsing attacker HTML client-side
 * cannot run script. happy-dom (Node) is already inert; using the same path keeps
 * behavior uniform.
 * @param {string} html
 * @returns {Object} a detached div element whose innerHTML is the parsed html
 */
let lazyInertDocument = null;
showdown.helper.parseHTML = function (html) {
  'use strict';
  let ownerDoc = showdown.helper.document;
  if (ownerDoc.implementation && typeof ownerDoc.implementation.createHTMLDocument === 'function') {
    if (lazyInertDocument === null) {
      lazyInertDocument = ownerDoc.implementation.createHTMLDocument('');
    }
    ownerDoc = lazyInertDocument;
  }
  let div = ownerDoc.createElement('div');
  div.innerHTML = html;
  return div;
};
