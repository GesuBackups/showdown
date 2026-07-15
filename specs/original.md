---
title: Original Markdown Spec
author: ShowdownJS (formalizing the work of John Gruber)
version: '0.1'
date: '2026-07-05'
...

# Introduction

## What is Markdown?

Markdown is a plain text format for writing structured documents, created
by John Gruber (with substantial contributions from Aaron Swartz) and
released in 2004 in the form of a syntax description and a Perl script
(`Markdown.pl`) that converts the format to HTML.  Its design goal is
stated in the original documentation:

> Markdown is intended to be as easy-to-read and easy-to-write as is
> feasible.  Readability, however, is emphasized above all else.  A
> Markdown-formatted document should be publishable as-is, as plain text,
> without looking like it's been marked up with tags or formatting
> instructions.

Markdown is a *writing* format, not a publishing format: its syntax
intentionally covers only a small subset of HTML, and anything it does
not cover can be written as literal HTML inside the document.

## Why is a spec needed?

John Gruber's canonical syntax description
(<https://daringfireball.net/projects/markdown/syntax>) is written as user
documentation, not as a specification.  It does not define the syntax
unambiguously: it is silent on questions such as how block structure and
span structure interact, how much indentation is required or allowed in
edge cases, what happens with unbalanced delimiters, or in which order
constructs take precedence when more than one could apply.

The reference implementation, `Markdown.pl` 1.0.1, answers those questions
implicitly — but some of its answers are accidents of its regex-based
implementation, and a few contradict the documentation itself.  Because of
this, every Markdown implementation that aims to be "original flavored"
diverges in its own way.

The CommonMark specification solved this problem for a *modernized* dialect
of Markdown, but it deliberately changes original behavior in many places
(intraword emphasis, indentation rules, required space after `#`, fenced
code blocks, the list of backslash-escapable characters, entity decoding,
and more).  It is therefore not usable as a normative reference for the
original syntax.

This document specifies **Original Markdown**: the syntax described by
John Gruber's documentation for Markdown 1.0.1, made precise.  Where the
documentation is ambiguous or silent, this spec resolves the question the
way `Markdown.pl` 1.0.1 does.  Where `Markdown.pl`'s observed behavior is
an implementation artifact that contradicts the documentation, this spec
follows the documentation and records the divergence in the
[appendix](#appendix-b-resolved-ambiguities-and-divergences-from-markdownpl).

In ShowdownJS, this document is the normative reference for the `original`
flavor.

## About this document

This document attempts to specify Original Markdown syntax unambiguously.
It contains many examples with side-by-side Markdown and HTML.  These are
intended to double as conformance tests.  An example is written as:

    ```````````````````````````````` example
    Markdown source
    .
    Expected HTML output
    ````````````````````````````````

Examples are identified by their position in the document: extraction
tools should number them sequentially in document order.

The following conventions are used in examples:

  - The `→` character stands for a tab character (U+0009) in both the
    source and the output.  A literal `→` does not occur in any example.
  - Trailing spaces that are significant to an example (hard line breaks)
    are called out in the surrounding prose, since they are invisible.
  - The HTML output shown is a canonical rendering.  *Insignificant*
    whitespace differences — indentation of block-level tags, the number
    of newlines between block-level elements, and whitespace immediately
    adjacent to a `<br />` tag — are **not** normative.  A conforming
    implementation may produce output that differs from an example only
    in insignificant whitespace.
  - Email address obfuscation (see [Automatic links](#automatic-links)) is
    randomized in the original implementation.  Examples show the
    *decoded* output; conformance should be checked after decoding
    numeric character references.

The words *MUST*, *MUST NOT*, *SHOULD*, *SHOULD NOT* and *MAY* are used as
in RFC 2119.

# Preliminaries

## Characters and lines

Any sequence of characters is a valid Original Markdown document.

A **character** is a Unicode code point.  This spec does not specify an
encoding; it thinks of lines as composed of characters rather than bytes.

A **line** is a sequence of zero or more characters other than line feed
(U+000A) or carriage return (U+000D), followed by a line ending or by the
end of the document.

A **line ending** is a line feed (U+000A), a carriage return (U+000D) not
followed by a line feed, or a carriage return followed by a line feed.
Implementations SHOULD normalize all line endings to a single line feed
before processing, and MUST treat the three forms identically.

A **blank line** is a line containing no characters, or containing only
spaces (U+0020) or tabs (U+0009).

A **whitespace character** is a space (U+0020) or tab (U+0009).  Line
endings separate lines and are not part of them.

## Tabs

Tabs in the source are not expanded to spaces globally.  Wherever this
spec requires an indentation of four spaces (code blocks, continuation
paragraphs of list items, nested list markers), one tab MAY be used in
place of four spaces, and wherever it requires eight spaces, two tabs MAY
be used.  When one level of indentation is stripped (for example from the
lines of a code block), an implementation MUST treat one leading tab as
equivalent to four leading spaces.

```````````````````````````````` example
→foo
.
<pre><code>foo
</code></pre>
````````````````````````````````

```````````````````````````````` example
    foo
→bar
.
<pre><code>foo
bar
</code></pre>
````````````````````````````````

## Backslash escapes

A backslash before any of the following characters produces the literal
character instead of its Markdown meaning:

```
\   backslash
`   backtick
*   asterisk
_   underscore
{}  curly braces
[]  square brackets
()  parentheses
#   hash mark
+   plus sign
-   minus sign (hyphen)
.   dot
!   exclamation mark
>   greater-than sign
```

The `>` escape is not mentioned in the original syntax documentation, but
is implemented by `Markdown.pl` (it allows escaping a [blockquote](#blockquotes)
marker) and is part of this spec.

```````````````````````````````` example
\*literal asterisks\*
.
<p>*literal asterisks*</p>
````````````````````````````````

A backslash before any other character is a literal backslash:

```````````````````````````````` example
\a \" \$ \< \>
.
<p>\a \" \$ \&lt; ></p>
````````````````````````````````

Note that unlike in CommonMark, `<`, `"` and `&` are **not**
backslash-escapable; they are handled by [automatic
escaping](#automatic-escaping) instead.

Backslash escapes do not work in [code spans](#code-spans) or [code
blocks](#indented-code-blocks), where all characters are literal:

```````````````````````````````` example
`\*foo\*`
.
<p><code>\*foo\*</code></p>
````````````````````````````````

```````````````````````````````` example
    \*foo\*
.
<pre><code>\*foo\*
</code></pre>
````````````````````````````````

Backslash-escaped characters are treated as regular characters: they do
not open or close any construct.

```````````````````````````````` example
1986\. What a great season.
.
<p>1986. What a great season.</p>
````````````````````````````````

# Blocks and spans

A document is a sequence of **blocks** — structural elements like
paragraphs, headers, blockquotes, lists and code blocks.  Some blocks
(like blockquotes and list items) contain other blocks; others (like
headers and paragraphs) contain **span** elements — text, links, emphasis,
code spans and inline HTML.

## Precedence

Block structure is determined before span structure.  Indicators of block
structure always take precedence over indicators of span structure:

```````````````````````````````` example
- `one
- two`
.
<ul>
<li>`one</li>
<li>two`</li>
</ul>
````````````````````````````````

Within block parsing, the constructs of this spec are recognized in the
following order of precedence, which resolves inputs that could be read
two ways:

 1. [HTML blocks](#html-blocks)
 2. [Headers](#atx-headers) (ATX and setext)
 3. [Horizontal rules](#horizontal-rules)
 4. [Lists](#lists)
 5. [Indented code blocks](#indented-code-blocks)
 6. [Blockquotes](#blockquotes)
 7. [Paragraphs](#paragraphs)

For example, `---` under a line of text is a [setext header](#setext-headers),
not a [horizontal rule](#horizontal-rules), because headers are recognized
first; and `* * *` is a horizontal rule, not a list item, because
horizontal rules are recognized before lists.

## Container blocks and leaf blocks

Blocks divide into two types: **container blocks** ([blockquotes](#blockquotes)
and [list items](#list-items)), which can contain other blocks, and
**leaf blocks** (all others), which cannot.
# Leaf blocks

This section describes the blocks that cannot contain other blocks.

## Horizontal rules

A line consisting of three or more matching `-`, `_`, or `*` characters,
each optionally separated from the next by spaces, forms a
**horizontal rule**:

```````````````````````````````` example
* * *

***

*****

- - -

---------------------------------------

___
.
<hr />
<hr />
<hr />
<hr />
<hr />
<hr />
````````````````````````````````

Fewer than three characters do not produce a rule:

```````````````````````````````` example
**
.
<p>**</p>
````````````````````````````````

All characters of the rule must be the same:

```````````````````````````````` example
*-*
.
<p><em>-</em></p>
````````````````````````````````

No characters other than `-`, `_`, `*` and spaces may occur in the line
(trailing spaces and tabs are allowed):

```````````````````````````````` example
---a---
.
<p>---a---</p>
````````````````````````````````

A horizontal rule may be indented by up to three spaces:

```````````````````````````````` example
 ***
.
<hr />
````````````````````````````````

Four spaces of indentation is a code block:

```````````````````````````````` example
    ***
.
<pre><code>***
</code></pre>
````````````````````````````````

Because [setext headers](#setext-headers) are recognized before horizontal
rules, a line of dashes directly below a line of text is a header, not a
rule:

```````````````````````````````` example
Foo
---
bar
.
<h2>Foo</h2>
<p>bar</p>
````````````````````````````````

Because horizontal rules are recognized before [lists](#lists), `* * *`
is a rule even where a list item could otherwise start:

```````````````````````````````` example
* Foo
* * *
* Bar
.
<ul>
<li>Foo</li>
</ul>
<hr />
<ul>
<li>Bar</li>
</ul>
````````````````````````````````

## ATX headers

An **ATX header** consists of one to six `#` characters at the very start
of a line, followed by the header text.  The number of `#` characters
gives the header level.

```````````````````````````````` example
# This is an H1

## This is an H2

###### This is an H6
.
<h1>This is an H1</h1>
<h2>This is an H2</h2>
<h6>This is an H6</h6>
````````````````````````````````

The whitespace between the `#` characters and the header text is optional.
This differs from CommonMark, which requires it:

```````````````````````````````` example
#Foo

#5 bolt
.
<h1>Foo</h1>
<h1>5 bolt</h1>
````````````````````````````````

More than six `#` characters is a level-six header whose text begins with
the extra hashes:

```````````````````````````````` example
####### foo
.
<h6># foo</h6>
````````````````````````````````

The opening `#` must be the first character of the line; an escaped `#`
or an indented `#` does not start a header:

```````````````````````````````` example
\## foo
.
<p>## foo</p>
````````````````````````````````

ATX headers may be "closed" with any number of trailing `#` characters,
which need not match the number of opening hashes.  The closing sequence
is purely cosmetic and is removed, along with any whitespace before it:

```````````````````````````````` example
# This is an H1 #

## This is an H2 ##

### This is an H3 ######
.
<h1>This is an H1</h1>
<h2>This is an H2</h2>
<h3>This is an H3</h3>
````````````````````````````````

No space is required before the closing sequence:

```````````````````````````````` example
# foo#
.
<h1>foo</h1>
````````````````````````````````

The header text is parsed as spans:

```````````````````````````````` example
# Foo *bar*
.
<h1>Foo <em>bar</em></h1>
````````````````````````````````

An ATX header does not need to be preceded or followed by a blank line;
it can interrupt a paragraph:

```````````````````````````````` example
foo
# bar
baz
.
<p>foo</p>
<h1>bar</h1>
<p>baz</p>
````````````````````````````````

## Setext headers

A **setext header** is a line of text "underlined" by a line consisting
entirely of `=` characters (level one) or `-` characters (level two).
Any number of underline characters — one or more — works:

```````````````````````````````` example
This is an H1
=============

This is an H2
-------------
.
<h1>This is an H1</h1>
<h2>This is an H2</h2>
````````````````````````````````

```````````````````````````````` example
Foo
=

Bar
-
.
<h1>Foo</h1>
<h2>Bar</h2>
````````````````````````````````

The header text is the *single* line immediately preceding the underline.
When the underline follows a multi-line paragraph, only the last line
becomes a header; the preceding lines remain a paragraph:

```````````````````````````````` example
foo
bar
===
.
<p>foo</p>
<h1>bar</h1>
````````````````````````````````

The underline must start at the beginning of the line and may contain
only the underline character, optionally followed by trailing whitespace.
A line that mixes in other characters or internal spaces is paragraph
text:

```````````````````````````````` example
Foo
= =
.
<p>Foo
= =</p>
````````````````````````````````

The header text is parsed as spans:

```````````````````````````````` example
Foo *bar*
=========
.
<h1>Foo <em>bar</em></h1>
````````````````````````````````

## Indented code blocks

An **indented code block** is one or more lines, each indented by at least
four spaces or one tab, preceded by a blank line (or the start of the
document).  Its contents are interpreted literally: no span parsing occurs,
and `&`, `<` and `>` are converted to HTML entities.  A code block is
rendered wrapped in both `<pre>` and `<code>` tags, with a line ending
before the closing `</code>`:

```````````````````````````````` example
This is a normal paragraph:

    This is a code block.
.
<p>This is a normal paragraph:</p>
<pre><code>This is a code block.
</code></pre>
````````````````````````````````

One level of indentation — four spaces or one tab — is removed from each
line of the code block; further indentation is preserved:

```````````````````````````````` example
Here is an example of AppleScript:

    tell application "Foo"
        beep
    end tell
.
<p>Here is an example of AppleScript:</p>
<pre><code>tell application "Foo"
    beep
end tell
</code></pre>
````````````````````````````````

Ampersands and angle brackets are converted to entities, and Markdown
syntax is not processed:

```````````````````````````````` example
    <div class="footer">
        &copy; 2004 Foo Corporation
    </div>
.
<pre><code>&lt;div class="footer"&gt;
    &amp;copy; 2004 Foo Corporation
&lt;/div&gt;
</code></pre>
````````````````````````````````

```````````````````````````````` example
    *this is not emphasis*
.
<pre><code>*this is not emphasis*
</code></pre>
````````````````````````````````

A code block continues until a line that is not indented (blank lines do
not end it, and are preserved when further indented lines follow):

```````````````````````````````` example
    chunk one

    chunk two
.
<pre><code>chunk one

chunk two
</code></pre>
````````````````````````````````

An indented line that is not preceded by a blank line does **not** start a
code block; it is a continuation of the paragraph:

```````````````````````````````` example
Foo
    bar
.
<p>Foo
    bar</p>
````````````````````````````````

Trailing blank lines are not part of the code block:

```````````````````````````````` example
    foo


bar
.
<pre><code>foo
</code></pre>
<p>bar</p>
````````````````````````````````
## HTML blocks

Markdown is not a replacement for HTML: for any markup not covered by
Markdown's syntax, HTML itself is used.  An **HTML block** is a block-level
HTML element written directly in the document.  It is passed through to
the output verbatim, and its content is **not** processed as Markdown.

As the one exception, a block-level opening tag carrying the attribute
`markdown="1"` has its content parsed as Markdown; the attribute itself is
removed from the output.  (See the [HTML blocks section of the Showdown
spec](showdown.md) for examples — the behavior is identical in both
flavors.)

The **block-level elements** are: `blockquote`, `del`, `div`, `dl`,
`fieldset`, `form`, `h1`–`h6`, `iframe`, `ins`, `math`, `noscript`,
`ol`, `p`, `pre`, `script`, `table`, `ul`, plus `hr` and HTML comments.
(Implementations MAY recognize additional block-level elements
introduced by later HTML versions.)

An HTML comment is terminated by `-->` or by `--!>` (the HTML "comment
end bang" sequence); the `--!>` form is honored so that content an author
believes is commented out cannot reach the browser as live HTML.

An HTML block begins with the opening tag of a block-level element (or an
HTML comment) at the very start of a line, preceded by a blank line or the
start of the document.  It ends with the corresponding closing tag at the
start of a line (or, for comments and void elements such as `<hr />`, with
the end of the construct), followed by a blank line or the end of the
document.

```````````````````````````````` example
This is a regular paragraph.

<table>
    <tr>
        <td>Foo</td>
    </tr>
</table>

This is another regular paragraph.
.
<p>This is a regular paragraph.</p>
<table>
    <tr>
        <td>Foo</td>
    </tr>
</table>
<p>This is another regular paragraph.</p>
````````````````````````````````

Markdown syntax is not processed inside an HTML block, and no extra `<p>`
tags are added around it:

```````````````````````````````` example
<div>
*this is not emphasis*
</div>
.
<div>
*this is not emphasis*
</div>
````````````````````````````````

The opening and closing tags of the outermost block element MUST NOT be
indented with tabs or spaces:

```````````````````````````````` example
<div>
    <div>
    indented inner tags are fine
    </div>
</div>
.
<div>
    <div>
    indented inner tags are fine
    </div>
</div>
````````````````````````````````

The documentation instructs authors to separate block-level HTML from
surrounding content with blank lines, but a *preceding* blank line is not
in fact required: a block-level tag at the start of a line interrupts a
paragraph:

```````````````````````````````` example
Foo
<div>
bar
</div>
.
<p>Foo</p>
<div>
bar
</div>
````````````````````````````````

HTML comments at the block level are passed through verbatim:

```````````````````````````````` example
Foo

<!-- this is a
comment -->

Bar
.
<p>Foo</p>
<!-- this is a
comment -->
<p>Bar</p>
````````````````````````````````

Void block-level elements are passed through as well:

```````````````````````````````` example
Foo

<hr />

Bar
.
<p>Foo</p>
<hr />
<p>Bar</p>
````````````````````````````````

Note that span-level HTML tags are **not** HTML blocks; they flow with
paragraph content and Markdown *is* processed around and inside them (see
[Inline HTML](#inline-html)).

## Link reference definitions

A **link reference definition** names a link destination (and optionally a
title) so that it can be used by [reference-style links](#links) and
[images](#images) elsewhere in the document.  It consists of:

  - a link identifier in square brackets, optionally indented by up to
    three spaces;
  - followed by a colon;
  - optionally followed by spaces or tabs (the destination MAY instead be
    placed on the next line);
  - followed by the destination URL, optionally surrounded by angle
    brackets;
  - optionally followed (separated by whitespace) by a title in double
    quotes, single quotes, or parentheses.  The title MAY be placed on the
    next line, indented by any amount of whitespace.

A link reference definition is metadata: it produces no output itself.

Identifiers are matched case-insensitively, with runs of internal
whitespace collapsed to a single space.  When the same identifier is
defined more than once, the **first** definition wins.  A definition
cannot interrupt a paragraph — it is only recognized at the start of a
block.

Note that a bare bracketed string like `[foo]` is **not** a link in
Original Markdown; a reference-style link always requires a second pair
of brackets (see [Links](#links)).

```````````````````````````````` example
[foo]: http://example.com/  "Optional Title Here"

[foo][]
.
<p><a href="http://example.com/" title="Optional Title Here">foo</a></p>
````````````````````````````````

The three title styles are equivalent:

```````````````````````````````` example
[a]: http://example.com/  "Title"
[b]: http://example.com/  'Title'
[c]: http://example.com/  (Title)

[foo][a], [foo][b], [foo][c]
.
<p><a href="http://example.com/" title="Title">foo</a>, <a href="http://example.com/" title="Title">foo</a>, <a href="http://example.com/" title="Title">foo</a></p>
````````````````````````````````

The URL may be surrounded by angle brackets:

```````````````````````````````` example
[id]: <http://example.com/>  "Optional Title Here"

[id][]
.
<p><a href="http://example.com/" title="Optional Title Here">id</a></p>
````````````````````````````````

The title may be on the following line:

```````````````````````````````` example
[id]: http://example.com/longish/path/to/resource/here
    "Optional Title Here"

[id][]
.
<p><a href="http://example.com/longish/path/to/resource/here" title="Optional Title Here">id</a></p>
````````````````````````````````

Link identifiers are **not** case sensitive, and may consist of letters,
numbers, spaces and punctuation:

```````````````````````````````` example
[link text][A]

[a]: http://example.com/
.
<p><a href="http://example.com/">link text</a></p>
````````````````````````````````

A definition may appear anywhere in the document — before or after its
use.  A definition that is never used still produces no output:

```````````````````````````````` example
[unused]: http://example.com/
.
````````````````````````````````

## Paragraphs

A **paragraph** is one or more consecutive lines of text, separated from
other blocks by one or more blank lines.  Its content is parsed as spans
and wrapped in `<p>` tags:

```````````````````````````````` example
aaa

bbb
.
<p>aaa</p>
<p>bbb</p>
````````````````````````````````

Markdown supports "hard-wrapped" text: line endings inside a paragraph
are preserved as soft breaks and do **not** produce `<br />` tags (see
[Hard line breaks](#hard-line-breaks) for how to force one):

```````````````````````````````` example
aaa
bbb
ccc
.
<p>aaa
bbb
ccc</p>
````````````````````````````````

Normal paragraphs should not be indented with spaces or tabs.  A first
line indented by one to three spaces is still a paragraph (the
indentation is removed); four spaces or a tab produce an [indented code
block](#indented-code-blocks):

```````````````````````````````` example
   aaa
.
<p>aaa</p>
````````````````````````````````

## Blank lines

Blank lines — including lines containing only spaces or tabs — separate
blocks.  More than one blank line between blocks has the same effect as
one, and blank lines at the start or end of the document are ignored:

```````````````````````````````` example


aaa



bbb


.
<p>aaa</p>
<p>bbb</p>
````````````````````````````````
# Container blocks

Container blocks contain other blocks as their content.

## Blockquotes

A **blockquote** is marked with the email-style `>` character.  A line
beginning with `>` (optionally indented up to three spaces) opens a
blockquote; the `>` marker and one optional following space are stripped
from each line, and the remaining content is parsed as blocks:

```````````````````````````````` example
> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
> consectetuer adipiscing elit.
>
> Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
.
<blockquote>
<p>This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
consectetuer adipiscing elit.</p>
<p>Donec sit amet nisl. Aliquam semper ipsum sit amet velit.</p>
</blockquote>
````````````````````````````````

The space after `>` is optional:

```````````````````````````````` example
>foo
.
<blockquote>
<p>foo</p>
</blockquote>
````````````````````````````````

Markdown allows "lazy" blockquotes: if a paragraph is hard-wrapped, only
the first line of each paragraph needs the `>` marker.  Subsequent
non-blank lines continue the quoted paragraph.  Note that quoted
paragraphs separated by blank lines belong to the *same* blockquote:

```````````````````````````````` example
> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
consectetuer adipiscing elit.

> Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
.
<blockquote>
<p>This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
consectetuer adipiscing elit.</p>
<p>Donec sit amet nisl. Aliquam semper ipsum sit amet velit.</p>
</blockquote>
````````````````````````````````

A blockquote ends only at a non-blank line that is not part of it:

```````````````````````````````` example
> quoted

not quoted
.
<blockquote>
<p>quoted</p>
</blockquote>
<p>not quoted</p>
````````````````````````````````

Blockquotes can be nested by adding additional levels of `>`:

```````````````````````````````` example
> This is the first level of quoting.
>
> > This is nested blockquote.
>
> Back to the first level.
.
<blockquote>
<p>This is the first level of quoting.</p>
<blockquote>
<p>This is nested blockquote.</p>
</blockquote>
<p>Back to the first level.</p>
</blockquote>
````````````````````````````````

A blockquote can contain any other Markdown element, including headers,
lists and code blocks:

```````````````````````````````` example
> ## This is a header.
>
> 1.   This is the first list item.
> 2.   This is the second list item.
>
> Here's some example code:
>
>     return shell_exec("echo $input | $markdown_script");
.
<blockquote>
<h2>This is a header.</h2>
<ol>
<li>This is the first list item.</li>
<li>This is the second list item.</li>
</ol>
<p>Here's some example code:</p>
<pre><code>return shell_exec("echo $input | $markdown_script");
</code></pre>
</blockquote>
````````````````````````````````

A blockquote does not need a preceding blank line; it can interrupt a
paragraph:

```````````````````````````````` example
foo
> bar
.
<p>foo</p>
<blockquote>
<p>bar</p>
</blockquote>
````````````````````````````````

## List items

A **list marker** is either a **bullet marker** — a `*`, `+` or `-`
character — or an **ordered marker** — a sequence of digits followed by a
period.  A **list item** begins with a list marker, optionally indented by
up to three spaces, followed by one or more spaces or a tab, followed by
the item's content:

```````````````````````````````` example
*   Red
*   Green
*   Blue
.
<ul>
<li>Red</li>
<li>Green</li>
<li>Blue</li>
</ul>
````````````````````````````````

A marker not followed by whitespace does not start a list item:

```````````````````````````````` example
*foo*
.
<p><em>foo</em></p>
````````````````````````````````

The marker may be indented up to three spaces:

```````````````````````````````` example
   * foo
.
<ul>
<li>foo</li>
</ul>
````````````````````````````````

Item content may be laid out with a hanging indent aligned with the text,
or "lazily", with continuation lines not indented at all.  Both of the
following are a single two-item list:

```````````````````````````````` example
*   Lorem ipsum dolor sit amet, consectetuer adipiscing elit.
    Aliquam hendrerit mi posuere lectus.
*   Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
    Suspendisse id sem consectetuer libero luctus adipiscing.
.
<ul>
<li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.
Aliquam hendrerit mi posuere lectus.</li>
<li>Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
Suspendisse id sem consectetuer libero luctus adipiscing.</li>
</ul>
````````````````````````````````

```````````````````````````````` example
*   Lorem ipsum dolor sit amet, consectetuer adipiscing elit.
Aliquam hendrerit mi posuere lectus.
*   Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
Suspendisse id sem consectetuer libero luctus adipiscing.
.
<ul>
<li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.
Aliquam hendrerit mi posuere lectus.</li>
<li>Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
Suspendisse id sem consectetuer libero luctus adipiscing.</li>
</ul>
````````````````````````````````

To put a second paragraph (or any other additional block) in a list item,
it must be separated by a blank line and indented by four spaces or one
tab.  As with the first paragraph, only the first line of a continuation
paragraph needs the indentation; the rest may be lazy:

```````````````````````````````` example
1.  This is a list item with two paragraphs. Lorem ipsum dolor
    sit amet, consectetuer adipiscing elit.

    Vestibulum enim wisi, viverra nec, fringilla in, laoreet
    vitae, risus.

2.  Suspendisse id sem consectetuer libero luctus adipiscing.
.
<ol>
<li><p>This is a list item with two paragraphs. Lorem ipsum dolor
sit amet, consectetuer adipiscing elit.</p>
<p>Vestibulum enim wisi, viverra nec, fringilla in, laoreet
vitae, risus.</p></li>
<li><p>Suspendisse id sem consectetuer libero luctus adipiscing.</p></li>
</ol>
````````````````````````````````

```````````````````````````````` example
*   This is a list item with two paragraphs.

    This is the second paragraph in the list item. You're
only required to indent the first line.

*   Another item in the same list.
.
<ul>
<li><p>This is a list item with two paragraphs.</p>
<p>This is the second paragraph in the list item. You're
only required to indent the first line.</p></li>
<li><p>Another item in the same list.</p></li>
</ul>
````````````````````````````````

To put a blockquote in a list item, the `>` delimiters must be indented
(four spaces or one tab):

```````````````````````````````` example
*   A list item with a blockquote:

    > This is a blockquote
    > inside a list item.
.
<ul>
<li><p>A list item with a blockquote:</p>
<blockquote>
<p>This is a blockquote
inside a list item.</p>
</blockquote></li>
</ul>
````````````````````````````````

To put a code block in a list item, it must be indented **twice** — eight
spaces or two tabs:

```````````````````````````````` example
*   A list item with a code block:

        <code goes here>
.
<ul>
<li><p>A list item with a code block:</p>
<pre><code>&lt;code goes here&gt;
</code></pre></li>
</ul>
````````````````````````````````

A nested list is created by indenting its markers relative to the markers
of the enclosing list.  The conventional (and recommended) indent is four
spaces or one tab, but *any* additional indentation — even a single
space — nests.  A nested list does not need a preceding blank line:

```````````````````````````````` example
*   Item
    *   Nested item
    *   Another nested item
*   Second top-level item
.
<ul>
<li>Item
<ul>
<li>Nested item</li>
<li>Another nested item</li>
</ul>
</li>
<li>Second top-level item</li>
</ul>
````````````````````````````````

```````````````````````````````` example
* foo
  * bar
.
<ul>
<li>foo
<ul>
<li>bar</li>
</ul>
</li>
</ul>
````````````````````````````````

What matters is *relative* indentation: markers at the same indentation
as the current item's marker are siblings (the whole list may sit
anywhere within the three-space margin):

```````````````````````````````` example
  * foo
  * bar
.
<ul>
<li>foo</li>
<li>bar</li>
</ul>
````````````````````````````````

## Lists

A **list** is a sequence of one or more consecutive list items.  A list
is **ordered** (`<ol>`) if its *first* item has an ordered marker, and
**unordered** (`<ul>`) otherwise.

At the top level of the document, a list must be preceded by a blank line
(or start the document); a list marker cannot interrupt a paragraph:

```````````````````````````````` example
Foo
* bar
.
<p>Foo
* bar</p>
````````````````````````````````

Inside list items and blockquotes, a nested list needs no preceding blank
line (see [List items](#list-items)).

The bullet characters `*`, `+` and `-` are interchangeable; changing
marker (or, in an ordered list, the numbers used) does **not** start a new
list:

```````````````````````````````` example
* Red
+ Green
- Blue
.
<ul>
<li>Red</li>
<li>Green</li>
<li>Blue</li>
</ul>
````````````````````````````````

The actual numbers of ordered markers have no effect on the output.  All
of the following produce the same HTML — an ordered list numbered from
one:

```````````````````````````````` example
1.  Bird
2.  McHale
3.  Parish
.
<ol>
<li>Bird</li>
<li>McHale</li>
<li>Parish</li>
</ol>
````````````````````````````````

```````````````````````````````` example
1.  Bird
1.  McHale
1.  Parish
.
<ol>
<li>Bird</li>
<li>McHale</li>
<li>Parish</li>
</ol>
````````````````````````````````

```````````````````````````````` example
3. Bird
1. McHale
8. Parish
.
<ol>
<li>Bird</li>
<li>McHale</li>
<li>Parish</li>
</ol>
````````````````````````````````

Lists SHOULD be written starting with number 1 nonetheless; future
versions of this spec may assign meaning to the starting number.

Because the list type is decided by the first item's marker, a change
from ordered to bullet markers (or vice versa) does not split the list
either; the later markers merely continue it:

```````````````````````````````` example
1. one
* two
.
<ol>
<li>one</li>
<li>two</li>
</ol>
````````````````````````````````

### Loose and tight lists

A list is **loose** if any two of the blocks it directly contains — two
adjacent items, or two blocks inside one item — are separated by a blank
line.  Otherwise it is **tight**.

In a tight list, item content is *not* wrapped in `<p>` tags:

```````````````````````````````` example
*   Bird
*   Magic
.
<ul>
<li>Bird</li>
<li>Magic</li>
</ul>
````````````````````````````````

In a loose list, the paragraphs of every item are wrapped in `<p>` tags:

```````````````````````````````` example
*   Bird

*   Magic
.
<ul>
<li><p>Bird</p></li>
<li><p>Magic</p></li>
</ul>
````````````````````````````````

An item containing two blocks makes the list loose even if no blank line
separates the items themselves:

```````````````````````````````` example
* a

  continuation of a

* b
* c
.
<ul>
<li><p>a</p>
<p>continuation of a</p></li>
<li><p>b</p></li>
<li><p>c</p></li>
</ul>
````````````````````````````````

Looseness applies to a list as a whole; a nested list may be tight inside
a loose list, or vice versa:

```````````````````````````````` example
*   First

    *   Nested A
    *   Nested B

*   Second
.
<ul>
<li><p>First</p>
<ul>
<li>Nested A</li>
<li>Nested B</li>
</ul>
</li>
<li><p>Second</p></li>
</ul>
````````````````````````````````

### Ending a list

Blank lines between items make a list loose but never end it.  A list
ends at a non-blank line that is neither a new list item nor indented
item content:

```````````````````````````````` example
* item one

* item two

not an item
.
<ul>
<li><p>item one</p></li>
<li><p>item two</p></li>
</ul>
<p>not an item</p>
````````````````````````````````

### Accidental lists

A paragraph beginning with a number-period-space sequence would be read
as an ordered list.  To prevent this, backslash-escape the period:

```````````````````````````````` example
1986. What a great season.
.
<ol>
<li>What a great season.</li>
</ol>
````````````````````````````````

```````````````````````````````` example
1986\. What a great season.
.
<p>1986. What a great season.</p>
````````````````````````````````
# Spans

Span elements occur within the content of paragraphs, headers, list items
and blockquotes.  They are parsed in the following order of precedence:
[code spans](#code-spans) first, then [images](#images) and
[links](#links), then [automatic links](#automatic-links), then
[emphasis](#emphasis-and-strong-emphasis).  An earlier construct's content
is not re-parsed for later constructs.

## Code spans

A **code span** begins with a run of one or more backticks and ends with a
run of backticks *of the same length*.  Its content is the text between
the runs, with leading and trailing whitespace stripped.  The content is
treated literally: no span parsing, no backslash escapes, and `&`, `<` and
`>` are converted to HTML entities.

```````````````````````````````` example
Use the `printf()` function.
.
<p>Use the <code>printf()</code> function.</p>
````````````````````````````````

To include a literal backtick, use multiple backticks as delimiters:

```````````````````````````````` example
``There is a literal backtick (`) here.``
.
<p><code>There is a literal backtick (`) here.</code></p>
````````````````````````````````

Because leading and trailing whitespace is stripped, a code span can
begin or end with a backtick:

```````````````````````````````` example
A single backtick in a code span: `` ` ``

A backtick-delimited string in a code span: `` `foo` ``
.
<p>A single backtick in a code span: <code>`</code></p>
<p>A backtick-delimited string in a code span: <code>`foo`</code></p>
````````````````````````````````

Ampersands and angle brackets are encoded automatically, which makes it
easy to mention HTML tags and entities:

```````````````````````````````` example
Please don't use any `<blink>` tags.
.
<p>Please don't use any <code>&lt;blink&gt;</code> tags.</p>
````````````````````````````````

```````````````````````````````` example
`&#8212;` is the decimal-encoded equivalent of `&mdash;`.
.
<p><code>&amp;#8212;</code> is the decimal-encoded equivalent of <code>&amp;mdash;</code>.</p>
````````````````````````````````

A backtick run with no matching closer is literal text:

```````````````````````````````` example
`foo
.
<p>`foo</p>
````````````````````````````````

## Emphasis and strong emphasis

Text wrapped in single `*` or `_` delimiters is **emphasis** (`<em>`);
text wrapped in double `**` or `__` delimiters is **strong emphasis**
(`<strong>`).  The same character used to open a span must be used to
close it.

```````````````````````````````` example
*single asterisks*

_single underscores_

**double asterisks**

__double underscores__
.
<p><em>single asterisks</em></p>
<p><em>single underscores</em></p>
<p><strong>double asterisks</strong></p>
<p><strong>double underscores</strong></p>
````````````````````````````````

An emphasis span cannot begin or end with whitespace: the opening
delimiter must be immediately followed by a non-space character, and the
closing delimiter immediately preceded by one.  Delimiters surrounded by
spaces are literal:

```````````````````````````````` example
un * frigging * believable
.
<p>un * frigging * believable</p>
````````````````````````````````

Emphasis can be used in the middle of a word, with either delimiter
character (unlike CommonMark, where intraword `_` is not emphasis):

```````````````````````````````` example
un*frigging*believable

un_frigging_believable
.
<p>un<em>frigging</em>believable</p>
<p>un<em>frigging</em>believable</p>
````````````````````````````````

Strong emphasis is matched before emphasis, so triple delimiters produce
emphasis nested in strong emphasis:

```````````````````````````````` example
***foo***

___foo___
.
<p><strong><em>foo</em></strong></p>
<p><strong><em>foo</em></strong></p>
````````````````````````````````

Emphasis and strong emphasis may span multiple words and may nest:

```````````````````````````````` example
*foo **bar** baz*
.
<p><em>foo <strong>bar</strong> baz</em></p>
````````````````````````````````

An unmatched delimiter is literal text:

```````````````````````````````` example
*foo
.
<p>*foo</p>
````````````````````````````````

Use backslash escapes to produce literal delimiters around a word:

```````````````````````````````` example
\*this text is surrounded by literal asterisks\*
.
<p>*this text is surrounded by literal asterisks*</p>
````````````````````````````````

## Links

Markdown supports two styles of links: **inline** and **reference**.  In
both styles, the link text is delimited by square brackets.

### Inline links

An **inline link** is the link text in square brackets, followed
immediately by the destination in parentheses: an URL, optionally followed
by whitespace and a title in single or double quotes.

```````````````````````````````` example
This is [an example](http://example.com/ "Title") inline link.

[This link](http://example.net/) has no title attribute.
.
<p>This is <a href="http://example.com/" title="Title">an example</a> inline link.</p>
<p><a href="http://example.net/">This link</a> has no title attribute.</p>
````````````````````````````````

Local resources can be referenced with relative paths:

```````````````````````````````` example
See my [About](/about/) page for details.
.
<p>See my <a href="/about/">About</a> page for details.</p>
````````````````````````````````

The URL may be wrapped in angle brackets:

```````````````````````````````` example
[link](<http://example.com/>)
.
<p><a href="http://example.com/">link</a></p>
````````````````````````````````

### Reference links

A **reference link** is the link text in square brackets, followed by a
second pair of square brackets containing the identifier of a [link
reference definition](#link-reference-definitions).  A single space is
allowed between the two bracket pairs.  Identifiers match definitions
case-insensitively.

```````````````````````````````` example
This is [an example][id] reference-style link.

[id]: http://example.com/  "Optional Title Here"
.
<p>This is <a href="http://example.com/" title="Optional Title Here">an example</a> reference-style link.</p>
````````````````````````````````

```````````````````````````````` example
This is [an example] [id] reference-style link.

[id]: http://example.com/
.
<p>This is <a href="http://example.com/">an example</a> reference-style link.</p>
````````````````````````````````

The **implicit link name** shortcut uses an empty second pair of
brackets; the link text itself is used as the identifier:

```````````````````````````````` example
Visit [Daring Fireball][] for more information.

[Daring Fireball]: http://daringfireball.net/
.
<p>Visit <a href="http://daringfireball.net/">Daring Fireball</a> for more information.</p>
````````````````````````````````

A reference to an identifier with no matching definition is not a link;
the text is left as-is:

```````````````````````````````` example
[foo][undefined]
.
<p>[foo][undefined]</p>
````````````````````````````````

### Link text

The link text of either style is parsed as spans:

```````````````````````````````` example
[*emphasized* link](/url)
.
<p><a href="/url"><em>emphasized</em> link</a></p>
````````````````````````````````

The link text may contain balanced pairs of square brackets:

```````````````````````````````` example
[link [with brackets]](/url)
.
<p><a href="/url">link [with brackets]</a></p>
````````````````````````````````

## Images

Image syntax mirrors link syntax, prefixed with an exclamation mark.  The
bracketed text becomes the `alt` attribute; the optional title becomes
the `title` attribute.

Inline style:

```````````````````````````````` example
![Alt text](/path/to/img.jpg)

![Alt text](/path/to/img.jpg "Optional title")
.
<p><img src="/path/to/img.jpg" alt="Alt text" /></p>
<p><img src="/path/to/img.jpg" alt="Alt text" title="Optional title" /></p>
````````````````````````````````

Reference style:

```````````````````````````````` example
![Alt text][id]

[id]: url/to/image  "Optional title attribute"
.
<p><img src="url/to/image" alt="Alt text" title="Optional title attribute" /></p>
````````````````````````````````

Original Markdown has no syntax for image dimensions; use a literal HTML
`<img>` tag when they are needed.

## Automatic links

An URL in angle brackets becomes a link whose text is the URL itself.
Automatic links are recognized for `http`, `https` and `ftp` URLs:

```````````````````````````````` example
<http://example.com/>
.
<p><a href="http://example.com/">http://example.com/</a></p>
````````````````````````````````

Ampersands in the URL are entity-encoded in both the attribute and the
text, per [automatic escaping](#automatic-escaping):

```````````````````````````````` example
<http://example.com/?find=this&that>
.
<p><a href="http://example.com/?find=this&amp;that">http://example.com/?find=this&amp;that</a></p>
````````````````````````````````

An email address in angle brackets becomes a `mailto:` link.  To foil
address-harvesting spambots, implementations SHOULD obfuscate the address
(and the `mailto:` prefix) with random decimal and hexadecimal character
references.  Because the encoding is randomized, the example below shows
the decoded form; conformance MUST be checked after decoding character
references:

```````````````````````````````` example
<address@example.com>
.
<p><a href="mailto:address@example.com">address@example.com</a></p>
````````````````````````````````

## Inline HTML

Span-level HTML tags — for example `<span>`, `<cite>`, `<del>`, `<a>`,
`<img>` — can be used anywhere in paragraphs, headers and list items,
and are passed through verbatim.  Unlike in [HTML blocks](#html-blocks),
Markdown syntax **is** processed around and between span-level tags:

```````````````````````````````` example
<span>*foo*</span>
.
<p><span><em>foo</em></span></p>
````````````````````````````````

Markdown characters inside tag attributes are protected; they do not open
spans:

```````````````````````````````` example
<a href="http://example.com/_a_b_">link</a>
.
<p><a href="http://example.com/_a_b_">link</a></p>
````````````````````````````````

## Automatic escaping

In HTML, `<` and `&` are special.  Markdown lets you write them naturally
and escapes them for you when they are not markup.

An ampersand that is not part of an HTML entity is converted to `&amp;`;
an ampersand that is part of an entity is left alone:

```````````````````````````````` example
AT&T sells &quot;phones&quot; &mdash; for &#36;5.
.
<p>AT&amp;T sells &quot;phones&quot; &mdash; for &#36;5.</p>
````````````````````````````````

An angle bracket that does not delimit an HTML tag is converted to
`&lt;`.  A bare `>` is left unchanged:

```````````````````````````````` example
4 < 5 and 6 > 3
.
<p>4 &lt; 5 and 6 > 3</p>
````````````````````````````````

Inside [code spans](#code-spans) and [code
blocks](#indented-code-blocks), `&`, `<` and `>` are *always* encoded
automatically.

Entities are passed through verbatim; Original Markdown never decodes
character references into characters (unlike CommonMark).

## Hard line breaks

A line ending preceded by two or more spaces produces a hard line break
(`<br />`).  (The following example's first line ends with two spaces.)

```````````````````````````````` example
Roses are red,  
violets are blue.
.
<p>Roses are red,<br />
violets are blue.</p>
````````````````````````````````

A line ending *not* preceded by two spaces is a soft break, preserved as
a line ending in the output (see [Paragraphs](#paragraphs)).

## Textual content

Any text that is not part of another construct is passed through
unchanged, apart from [automatic escaping](#automatic-escaping):

```````````````````````````````` example
hello $.;'there
.
<p>hello $.;'there</p>
````````````````````````````````
# Appendix A: Differences from CommonMark

This informative appendix summarizes the main behavioral differences
between Original Markdown and CommonMark, as an aid to readers who know
one and not the other.  In each case this spec follows the original
behavior.

  - **No fenced code blocks.**  Only indented code blocks exist.
  - **ATX headers** do not require whitespace after the opening `#`
    (`#foo` is a header), always strip a trailing run of `#` (even
    unspaced), and treat seven or more `#` as a level-six header with
    the surplus hashes in the text.
  - **Setext headers** apply to the single preceding line only, never to
    a whole multi-line paragraph, and the underline must not be indented.
  - **Indented code blocks** must be preceded by a blank line; an
    indented line inside a paragraph is paragraph text in both dialects,
    but Original Markdown also refuses to open a code block after a
    non-blank line that is not itself indented.
  - **Emphasis** uses simple matching rules rather than CommonMark's
    flanking/delimiter-run algorithm.  Intraword `_` emphasis works.
  - **Backslash escapes** cover a smaller set of characters
    (`` \`*_{}[]()#+-.!> ``); `<`, `"`, `&`, `~` and `|` are not
    escapable, and a backslash before a non-escapable character is a
    literal backslash.  There is no backslash hard line break.
  - **Entities are not decoded.**  Character references pass through
    verbatim (CommonMark resolves them to characters).
  - **Lists**: any additional marker indentation (even one space) nests
    a sub-list; markers of different types are
    interchangeable *within* one list and never split it; the list type
    (`<ul>`/`<ol>`) is decided by the first item's marker; ordered-list
    numbers never produce a `start` attribute; a list cannot interrupt a
    paragraph; and `<p>` wrapping (looseness) is decided for the list as
    a whole.
  - **Ordered list markers** use only `.` as the delimiter (`)` is not
    recognized), and there is no limit on marker digits.
  - **Blockquotes** allow fully lazy continuation lines, and a `>` line
    can interrupt a paragraph.
  - **Automatic links** are recognized only for `http`, `https` and
    `ftp` URLs and email addresses; email autolinks are entity-obfuscated.
  - **HTML blocks** use a simpler model: an unindented block-level tag
    opens a block (interrupting a paragraph if need be), and everything
    up to the matching unindented closing tag is passed through.
    CommonMark's seven HTML block types do not apply.
  - **Code spans** strip *all* leading and trailing whitespace of their
    content (CommonMark strips at most one space from each end).
  - **Hard line breaks** require two or more trailing spaces; a backslash
    before the line ending has no such meaning.
  - **Tabs** are treated as equivalent to four spaces where indentation
    matters; there is no notion of expansion to tab stops.

# Appendix B: Resolved ambiguities and divergences from Markdown.pl

This informative appendix records the places where John Gruber's syntax
documentation is ambiguous or silent and where this spec's resolution
deliberately differs from the observable behavior of `Markdown.pl` 1.0.1.
The general rule: where documentation and implementation disagree, this
spec follows the documentation; where both are silent, it follows the
implementation unless the implementation's behavior is an evident
accident.

 1. **Loose-list `<p>` wrapping.**  The documentation says that if list
    items are separated by blank lines, Markdown wraps the items in
    `<p>` tags.  `Markdown.pl` implements this per *item* (an item is
    wrapped if it captures a leading or double trailing newline), which
    produces inconsistently mixed lists such as
    `<li>a</li><li><p>b</p></li><li>c</li>` for `* a` / `* b` / blank /
    `* c`.  This spec follows the documented intent: looseness is a
    property of the whole list, and in a loose list every item is
    wrapped.
 2. **Nested blockquote serialization.**  For the documentation's own
    nested-blockquote example, `Markdown.pl` emits the inner quote's
    closing `</blockquote>` wrapped in `<p>` tags
    (`<p></blockquote></p>`) — invalid HTML.  This spec specifies the
    evident intent: properly nested `<blockquote>` elements.
 3. **Blockquote marker indentation.**  `Markdown.pl` accepts a `>`
    marker after any amount of leading whitespace (the line becomes a
    code block only when it follows a blank line and is indented four or
    more spaces).  This spec allows up to three spaces of indentation
    before `>`, consistent with every other block marker.
 4. **Horizontal rule indentation.**  `Markdown.pl` accepts up to two
    (in some patterns effectively three) leading spaces.  This spec
    allows up to three, consistent with every other block marker.
 5. **Email obfuscation.**  `Markdown.pl` obfuscates email autolinks
    with *randomized* entity encoding, so its output is
    non-deterministic.  This spec requires only that the decoded output
    match; obfuscation is a SHOULD.
 6. **Code span whitespace.**  The documentation describes stripping
    "one space after the opening, one before the closing" delimiter;
    `Markdown.pl` strips all leading and trailing whitespace of the
    content.  This spec follows the implementation, which is a superset
    of the documented behavior.
 7. **Shortcut references.**  A bare `[foo]` with a matching definition
    is *not* a link in Markdown 1.0.1 (single-bracket shortcut
    references are a later extension popularized by other
    implementations).  This spec follows 1.0.1.
 8. **Sub-list indentation.**  The documentation does not state how much
    indentation nests a list inside a list item.  `Markdown.pl` nests on
    *any* additional marker indentation (its outdenting step strips one
    to four leading spaces), so even one extra space creates a sub-list;
    this spec adopts that resolution, while recommending the
    conventional four spaces or one tab.
 9. **Mixed list markers.**  The documentation presents `*`, `+` and
    `-` as interchangeable but shows no mixed-marker list.
    `Markdown.pl` never splits a list on a marker change and types the
    list by its first marker; this spec adopts that resolution.
10. **Single-quoted titles in link reference definitions.**  The
    documentation allows definition titles in double quotes, single
    quotes or parentheses, but `Markdown.pl` 1.0.1 fails to recognize
    the single-quoted form (the definition is neither stripped nor
    usable).  This spec follows the documentation: all three forms are
    valid.
11. **Empty `title` attribute on images.**  `Markdown.pl` emits
    `title=""` on inline images written without a title.  This spec
    treats that as an accident (it was removed in later 1.0.2 betas):
    an image without a title has no `title` attribute.
12. **The `>` backslash escape.**  `Markdown.pl`'s escape table includes
    `>` (allowing a blockquote marker to be escaped) although the
    documentation's list of escapable characters omits it.  This spec
    follows the implementation and includes it.

# About this specification

This specification formalizes the syntax described in *Markdown: Syntax*
by John Gruber (<https://daringfireball.net/projects/markdown/syntax>),
part of the Markdown 1.0.1 release (December 2004).  Markdown is
copyright © 2004 John Gruber.  Several examples in this document are
taken or adapted from that documentation.

This document follows the structure and conventions of the [CommonMark
specification](https://spec.commonmark.org/) by John MacFarlane, which is
licensed under Creative Commons BY-SA 4.0.

Maintained as part of the [ShowdownJS](https://github.com/showdownjs/showdown)
project, where it serves as the normative reference for the `original`
flavor.
