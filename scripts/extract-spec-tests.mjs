// Extract the example blocks from a spec document under specs/ into a JSON fixture the
// functional suite consumes (same shape as commonmark.testsuite.json: an array of
// { markdown, html, section, number }, with `→` standing for a tab character — the test
// bootstrap converts it back).
//
// A spec example is a fenced block of the form used by the CommonMark spec:
//
//     ```````````````````````````````` example
//     markdown source
//     .
//     expected html
//     ````````````````````````````````
//
// An example may declare the converter options it needs in its info string, after the
// word `example` (the grammar is specified in specs/showdown.md):
//
//     ```````````````````````````````` example options:tables
//     ```````````````````````````````` example options:headerLevelStart=3
//     ```````````````````````````````` example options:tables,tasklists
//     ```````````````````````````````` example options:headerIds.prefix=user-content
//
// `options:` is followed by a comma-separated list of entries; a bare key sets that option
// to `true`; `key=value` sets it to the given value (`true`, `false`, a number, or a
// string, coerced in that order); a dotted key such as `headerIds.prefix` sets a property
// of an object-valued option (shared roots are merged). An `options` field is emitted on a
// test only when the example carries an annotation, so specs with no annotated examples
// (original.md, gfm.md) extract byte-for-byte as before.
//
// Examples are numbered sequentially in document order. The `section` of an example is the
// nearest preceding level-2 heading (deeper headings do not start a new section, matching
// how the CommonMark spec groups its tests).
//
// Usage: node scripts/extract-spec-tests.mjs [specFile] [outFile]
// With no arguments, extracts original.md and showdown.md into their committed fixtures
// (the two suites this script owns). The gfm and commonmark fixtures are maintained
// separately — gfm.testsuite.json is a curated/consolidated suite and commonmark.testsuite.json
// comes from the commonmark-spec package (see extract-commonmark.mjs) — so they are not
// re-extracted here. A single specFile argument extracts just that spec.

import fs from 'node:fs';
import path from 'node:path';
import { root } from './concat.mjs';

const EXAMPLE_FENCE = '`'.repeat(32);
const EXAMPLE_OPEN = EXAMPLE_FENCE + ' example';

/**
 * Coerce a raw `key=value` value string to true / false / number / string (in that order).
 * @param {string} raw
 * @returns {boolean|number|string}
 */
function coerceValue (raw) {
  if (raw === 'true') { return true; }
  if (raw === 'false') { return false; }
  if (raw !== '' && !Number.isNaN(Number(raw))) { return Number(raw); }
  return raw;
}

/**
 * Parse an `options:...` annotation into a converter-options object. Bare keys set `true`;
 * `key=value` coerces the value; dotted keys build nested objects, merging shared roots.
 * @param {string} annotation the info string after `example` (e.g. `options:tables,tasklists`)
 * @returns {object}
 */
function parseOptions (annotation) {
  const m = annotation.match(/^options:(.*)$/);
  if (!m) {
    throw new Error('unrecognized example annotation: ' + JSON.stringify(annotation));
  }
  const opts = {};
  for (let entry of m[1].split(',')) {
    entry = entry.trim();
    if (entry === '') { continue; }
    let key, value;
    const eq = entry.indexOf('=');
    if (eq === -1) {
      key = entry;
      value = true;
    } else {
      key = entry.slice(0, eq);
      value = coerceValue(entry.slice(eq + 1));
    }
    const parts = key.split('.');
    let obj = opts;
    for (let p = 0; p < parts.length - 1; p++) {
      if (typeof obj[parts[p]] !== 'object' || obj[parts[p]] === null) {
        obj[parts[p]] = {};
      }
      obj = obj[parts[p]];
    }
    obj[parts[parts.length - 1]] = value;
  }
  return opts;
}

/**
 * Extract every example block from one spec file and write the JSON fixture.
 * @param {string} specFile absolute path to the spec markdown
 * @param {string} outFile absolute path to the output JSON
 * @returns {number} number of examples extracted
 */
function extract (specFile, outFile) {
  const lines = fs.readFileSync(specFile, 'utf8').split(/\r\n|\r|\n/);

  let section = '',
      tests = [],
      i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // an example block, optionally with an `options:` annotation: collect markdown until
    // the `.` separator, then html until the fence. A non-`options:` suffix (e.g. GFM's
    // `example table` extension markers) is not an annotation — it falls through to the
    // generic fenced-block skip below, exactly as the exact-match extractor did before.
    const isExample = line === EXAMPLE_OPEN ||
      (line.startsWith(EXAMPLE_OPEN + ' ') && line.slice(EXAMPLE_OPEN.length + 1).startsWith('options:'));
    if (isExample) {
      const start = i + 1;
      const annotation = line.slice(EXAMPLE_OPEN.length).trim();
      const options = annotation ? parseOptions(annotation) : null;
      let md = [],
          html = [],
          target = md;
      i++;
      for (; i < lines.length && lines[i] !== EXAMPLE_FENCE; i++) {
        if (lines[i] === '.' && target === md) {
          target = html;
        } else {
          target.push(lines[i]);
        }
      }
      if (i >= lines.length) {
        throw new Error(specFile + ':' + start + ': unclosed example block');
      }
      i++; // skip the closing fence
      const test = {
        markdown: md.join('\n') + '\n',
        html: html.length ? html.join('\n') + '\n' : '',
        section: section,
        number: tests.length + 1
      };
      // only carry `options` when annotated, so unannotated specs extract unchanged
      if (options) {
        test.options = options;
      }
      tests.push(test);
      continue;
    }

    // any other fenced code block: skip it wholesale, so headings and example-fence
    // look-alikes inside it are not misread (the spec quotes both)
    const fence = line.match(/^(`{3,})/);
    if (fence) {
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[1])) {
        i++;
      }
      i++; // skip the closing fence
      continue;
    }

    // section headings: level 1 and 2 both reset the section; deeper levels do not
    const heading = line.match(/^##? (.+?)\s*$/);
    if (heading) {
      section = heading[1];
    }
    i++;
  }

  fs.writeFileSync(outFile, JSON.stringify(tests, null, 2) + '\n', 'utf8');
  console.log('wrote ' + path.relative(root, outFile) + ' (' + tests.length + ' examples from ' + path.relative(root, specFile) + ')');
  return tests.length;
}

const specArg = process.argv[2];
const outArg = process.argv[3];

if (!specArg) {
  // no arguments: extract the per-flavor spec suites this script owns into their committed
  // fixtures (gfm/commonmark are maintained by other tooling — see the header note)
  for (const name of ['original', 'showdown']) {
    extract(
      path.resolve(root, 'specs/' + name + '.md'),
      path.resolve(root, 'test/functional/makehtml/cases/' + name + '.testsuite.json')
    );
  }
} else {
  const specFile = path.resolve(root, specArg);
  const outFile = path.resolve(root, outArg ||
    'test/functional/makehtml/cases/' + path.basename(specFile, '.md') + '.testsuite.json');
  extract(specFile, outFile);
}
