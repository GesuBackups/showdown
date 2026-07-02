/**
 * ReDoS / algorithmic-complexity regression suite.
 *
 * Each case feeds a large, adversarial input through makeHtml and asserts it finishes well
 * within a wall-clock budget. All of these parsers are linear (or near-linear) after the
 * hardening in src/subParsers/makehtml/*; if a change reintroduces catastrophic backtracking
 * (or an O(n^2) loop), the input below blows past BUDGET_MS — and the hard per-test timeout —
 * instead of completing in tens of milliseconds.
 *
 * The margin is deliberately wide (linear finishes in well under ~500ms even on a slow box,
 * a reintroduced quadratic takes many seconds at this input size) so the threshold is not flaky.
 */
describe('ReDoS resistance', function () {
  'use strict';

  // ~120 KB of pathological input. Linear parsers handle this in well under BUDGET_MS;
  // a quadratic regression would take several seconds (and trip the hard timeout).
  var N = 60000;
  var BUDGET_MS = 4000;
  var HARD_TIMEOUT_MS = 30000;

  var cases = [
    // --- inline link / image destinations (nested-lazy paren scan) ---
    {name: 'inline link destination — unbalanced (', input: '[a](' + 'a('.repeat(N)},
    {name: 'inline link destination — unbalanced ( + )', input: '[a](' + 'a('.repeat(N) + ')'},
    {name: 'inline image destination — unbalanced (', input: '![a](' + 'a('.repeat(N)},
    {name: 'inline image destination — unbalanced ( + )', input: '![a](' + 'a('.repeat(N) + ')'},
    {name: 'link destination with many open parens', input: '[a](http://x/' + '('.repeat(N)},
    {name: 'balanced nested links', input: '[x]('.repeat(N) + 'u' + ')'.repeat(N)},
    {name: 'balanced nested images', input: '![x]('.repeat(N) + 'u' + ')'.repeat(N)},

    // --- reference labels / bracket runs ---
    {name: 'open square brackets', input: '['.repeat(N)},
    {name: 'open image brackets', input: '!['.repeat(N)},
    {name: 'close-bracket run', input: ']'.repeat(N)},

    // --- ATX headings (lazy text vs trailing closing-hash run) ---
    {name: 'atx: many # then text', input: '#'.repeat(N) + ' h'},
    {name: 'atx: text then many closing #', input: '# h ' + '#'.repeat(N)},
    {name: 'atx: only #', input: '#'.repeat(N)},

    // --- raw HTML span hashing (tag / closing-tag scan) ---
    {name: 'raw HTML: many < ', input: '<'.repeat(N)},
    {name: 'raw HTML: open tag, many attrs, no close', input: '<a ' + 'b=c '.repeat(N) + '>'},
    {name: 'raw HTML: open tag, many attrs, stray close', input: '<a ' + 'b=c '.repeat(N) + '></z>'},
    {name: 'raw HTML: many open tags, no close', input: '<a>'.repeat(N)},
    {name: 'raw HTML: many open tags + stray mismatched close', input: '<a>'.repeat(N) + '</z>'},
    {name: 'raw HTML: many close tags', input: '</a>'.repeat(N)},

    // --- emphasis / unhash spans (O(n) spans) ---
    {name: 'underscores a_ (many em spans)', input: 'a_'.repeat(N)},
    {name: 'asterisks', input: '*'.repeat(N)},
    {name: 'strong **', input: '**'.repeat(N)},
    {name: 'strikethrough ~~', input: '~~'.repeat(N)},

    // --- entities / autolinks / misc block starts ---
    {name: 'ampersands', input: '&'.repeat(N)},
    {name: 'numeric entity starts &#', input: '&#'.repeat(N)},
    {name: 'backticks', input: '`'.repeat(N)},
    {name: 'blockquote markers', input: '> '.repeat(N)},
    {name: 'list markers', input: '- '.repeat(N)},
    {name: 'setext underline', input: 'h\n' + '='.repeat(N)},
    {name: 'thematic-break asterisks', input: '*'.repeat(N) + '\n'},

    // --- option-gated parsers ---
    {name: 'footnote ref starts [^', input: '[^'.repeat(N), options: {footnotes: true}},
    {name: 'footnote ref starts [^ + space ]', input: '[^'.repeat(N) + ' ]', options: {footnotes: true}},
    {name: 'table: pipe-heavy row, no delimiter', input: '|a'.repeat(N), options: {tables: true}},
    {name: 'table: pipe-heavy row + fake delimiter', input: '|a'.repeat(N) + '\n|--|--|\n', options: {tables: true}},
    {name: 'gh mentions @', input: '@' + 'a'.repeat(N), options: {ghMentions: true}},
    {name: 'simplified autolink www', input: 'www.' + 'a.'.repeat(N), options: {simplifiedAutoLink: true}},
    {name: 'emoji colons', input: ':'.repeat(N), options: {emoji: true}}
  ];

  cases.forEach(function (tc) {
    it('should not blow up on: ' + tc.name, function () {
      var converter = new showdown.Converter(tc.options || {}),
          start = Date.now();
      converter.makeHtml(tc.input);
      var elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(BUDGET_MS);
    }, HARD_TIMEOUT_MS);
  });

  // Same pathological inputs must also be safe with safeMode on (its extra passes run over
  // the near-final output and must not reintroduce quadratic scanning).
  it('should not blow up under safeMode', function () {
    var converter = new showdown.Converter({safeMode: true, tables: true, footnotes: true}),
        start = Date.now();
    converter.makeHtml('[a](' + 'a('.repeat(N) + ')');
    converter.makeHtml('<a ' + 'b=c '.repeat(N) + '>');
    converter.makeHtml('#'.repeat(N) + ' h');
    var elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(BUDGET_MS);
  }, HARD_TIMEOUT_MS);
});
