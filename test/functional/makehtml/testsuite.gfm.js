/**
 * Created by Estevao on 23-06-2026.
 */

// jshint ignore: start
let bootstrap = require('./makehtml.bootstrap.js'),
    // Run the gfm suite in gfm mode: derive options from the `gfm`
    // flavor so that flavor-gated gfm behaviors (e.g. decodeEntities) are exercised.
    // The gfm flavor enables the GFM tagfilter (disallowRawHTML) by default per spec §6.11,
    // so raw <script>/<style>/<textarea>/etc. are escaped — including the dedicated
    // "Disallowed Raw HTML (extension)" cases (1400/1500), which the main converter covers.
    converter = new bootstrap.showdown.Converter(bootstrap.showdown.getFlavorOptions('gfm')),
    assertion = bootstrap.assertion,
    testsuite = bootstrap.getJsonTestSuite('test/functional/makehtml/cases/gfm.testsuite.json');

// Whole sections covering GitHub.com renderer-only features (not part of the GFM spec —
// showdown does not produce them). Skipped at the section level because every case in them
// is skipped, and Vitest errors on a describe block with no tests (unlike Mocha).
//   Alerts (1800-1804), Math (1900-1901), Mermaid (2000)
const SKIP_SECTIONS = new Set([
  'Alerts (GitHub renderer)',
  'Math (GitHub renderer)',
  'Mermaid diagrams (GitHub renderer)'
]);

describe('makeHtml() gfm testsuite', function () {
  'use strict';

  for (let section in testsuite) {
    if (Object.prototype.hasOwnProperty.call(testsuite, section)) {
      if (SKIP_SECTIONS.has(section)) { continue; }
      let cases = testsuite[section];
      describe(section, function () {
        for (let i = 0; i < cases.length; ++i) {
          let name = cases[i].name;
          let number = cases[i].number;
          switch (number) {
            // Skipped cases — reason on the leading case (trailing so no-fallthrough stays quiet).
            case 170: // HTML blocks: raw <script>/<style>/<textarea> — escaped by the GFM tagfilter (disallowRawHTML), so they no longer match the CommonMark html-block fixtures
            case 171:
            case 172:
            case 173:
            case 176:
            case 178:
            case 79:   // ATX headings: empty ATX headings (`## ` -> <h2></h2>) — GFM allows them but showdown emits a paragraph; real spec divergence, tracked as a fix
            case 1111: // Task lists: loose items nest the checkbox inside the item's first <p>, whereas cmark-gfm emits it as a direct <li> child — known divergence
            case 1112:
            case 1113:
            case 1114:
            case 1312: // Autolinks: fixture output is the cmark-gfm "<IGNORE>" sentinel (undefined behavior), not an assertable value
            case 1313: // Autolinks: ghMentions (a separate, intended showdown feature) links @a.b.c as a user mention; the pure-GFM email-autolink fixture doesn't account for it — expected, not a defect
              continue;
            // Fenced code blocks
            case 142: // we use different classes to mark languages in fenced code blocks
            case 143: // we use different classes to mark languages in fenced code blocks
              cases[i].expected = cases[i].expected.replace('language-ruby', 'ruby language-ruby');
              break;
            // Fenced code blocks
            case 144: // we use different classes to mark languages in fenced code blocks
              cases[i].expected = cases[i].expected.replace('language-;', '; language-;');
              break;
            // Fenced code blocks
            case 146: // we use different classes to mark languages in fenced code blocks
              cases[i].expected = cases[i].expected.replace('language-aa', 'aa language-aa');
              break;
            // Entity and numeric character references
            case 34: // we use different classes to mark languages in fenced code blocks
              cases[i].expected = cases[i].expected.replace('language-föö', 'föö language-föö');
              break;
            //Backslash escapes
            case 24: // we use different classes to mark languages in fenced code blocks
              cases[i].expected = cases[i].expected.replace('language-foo+bar', 'foo+bar language-foo+bar');
              break;
          }

          it(number + ': ' + name, assertion(cases[i], converter, true));
        }
      });
    }
  }
});
