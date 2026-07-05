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
// Examples are numbered sequentially in document order. The `section` of an example is the
// nearest preceding level-2 heading (deeper headings do not start a new section, matching
// how the CommonMark spec groups its tests).
//
// Usage: node scripts/extract-spec-tests.mjs [specFile] [outFile]
// Defaults: specs/original.md -> test/functional/makehtml/cases/original.testsuite.json

import fs from 'node:fs';
import path from 'node:path';
import { root } from './concat.mjs';

const specFile = path.resolve(root, process.argv[2] || 'specs/original.md');
const outFile = path.resolve(root, process.argv[3] ||
  'test/functional/makehtml/cases/' + path.basename(specFile, '.md') + '.testsuite.json');

const EXAMPLE_FENCE = '`'.repeat(32);

const lines = fs.readFileSync(specFile, 'utf8').split(/\r\n|\r|\n/);

let section = '',
    tests = [],
    i = 0;

while (i < lines.length) {
  const line = lines[i];

  // an example block: collect markdown until the `.` separator, then html until the fence
  if (line === EXAMPLE_FENCE + ' example') {
    const start = i + 1;
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
    tests.push({
      markdown: md.join('\n') + '\n',
      html: html.length ? html.join('\n') + '\n' : '',
      section: section,
      number: tests.length + 1
    });
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
