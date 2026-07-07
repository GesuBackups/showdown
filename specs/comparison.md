# Flavor comparison

A syntax-by-syntax comparison of the four Markdown dialects specified in this
directory, showing **concrete input → output differences taken from the specs
themselves**:

| Flavor         | Spec                           | One-line description                                                                                              |
|----------------|--------------------------------|-------------------------------------------------------------------------------------------------------------------|
| **Original**   | [original.md](original.md)     | John Gruber's Markdown 1.0.1 (`Markdown.pl`), formalized.                                                         |
| **CommonMark** | [CommonMark.md](CommonMark.md) | The strict, unambiguous CommonMark specification.                                                                 |
| **GFM**        | [gfm.md](gfm.md)               | GitHub Flavored Markdown — a strict superset of CommonMark plus five extensions.                                  |
| **Showdown**   | [showdown.md](showdown.md)     | Showdown's `vanilla` flavor: Original Markdown at heart, with a few extras on by default and many opt-in options. |

## How to read this document

Every input/output pair below is quoted from the four spec files. Two rules keep
the comparison from being circular:

1. **CommonMark is the baseline.** Where a spec says nothing about a construct, it
   is taken to behave like CommonMark. A flavor is only listed as *differing* when
   its own spec documents a different result.
2. **GFM = CommonMark + extensions.** GFM's core is CommonMark byte-for-byte;
   it only adds the five marked extensions (tables, strikethrough, task lists,
   extended autolinks, tag filter). So "CommonMark · GFM" are shown together
   except in those extension sections.

Outputs are grouped: flavors that produce identical HTML share a column. Flavors
not shown for a given example match the baseline.

> **Heading `id`s omitted for brevity.** Showdown's `vanilla` flavor adds an `id`
> to *every* heading (e.g. `<h1 id="foo">`). To keep the heading examples focused
> on the structural difference, those `id`s are dropped from the outputs below —
> see [Heading ids](#heading-ids) for that one difference on its own.

## How the flavors relate

There are two lineages:

```
Markdown.pl 1.0.1
   │
   ├──────────────► Original  ──────────────► Showdown (vanilla)
   │                                          (Original + fenced code, strikethrough,
   │                                           heading ids, ellipsis, backslash breaks…
   │                                           + ~30 opt-in options)
   │
   └──► CommonMark ──────────────► GFM
                                   (CommonMark + tables, strikethrough,
                                    task lists, extended autolinks, tag filter)
```

Showdown can also *become* CommonMark or GFM by setting `cmSpec: true` (that is
what the `commonmark` and `gfm` **flavor presets** do); this document compares
Showdown's default (`vanilla`) parser, not that re-based mode. See
[Flavor presets](#flavor-presets) at the end.

## Feature availability matrix

The columns are the four **flavors** Showdown ships. The important thing about
Showdown: its converter **options are global, not flavor-gated** — every option
in [showdown.md](showdown.md) can be toggled under *any* flavor, and the flavor
preset only decides each option's *default*. So `tables: true` produces tables
under the `commonmark` flavor exactly as it does under `vanilla`. A cell means:

- **Default** — part of that flavor out of the box.
- **Option** (`name`) — off by default in that flavor, but enable-able there via
  the named converter option (options work under every flavor).
- **Extension** — a GFM-spec extension (and on in the `gfm` flavor).
- **—** — genuinely unavailable: no option turns it on for that flavor.

| Construct                           | Original     | CommonMark | GFM            | Showdown (vanilla)            |
|-------------------------------------|--------------|------------|----------------|-------------------------------|
| Thematic break / horizontal rule    | Default      | Default    | Default        | Default                       |
| ATX headings                        | Default      | Default    | Default        | Default                       |
| Setext headings                     | Default      | Default    | Default        | Default                       |
| Generated heading `id`s             | Option       | Option     | Option         | Default (`headerIds`)         |
| Indented code blocks                | Default      | Default    | Default        | Default                       |
| Fenced code blocks                  | Option       | Default    | Default        | Default (`ghCodeBlocks`)      |
| Tables                              | Option       | Option     | **Extension**  | Option (`tables`)             |
| HTML blocks                         | Default      | Default    | Default        | Default                       |
| Link reference definitions          | Default      | Default    | Default        | Default                       |
| Metadata front-matter               | Option       | Option     | Option         | Option (`metadata`)           |
| Block quotes                        | Default      | Default    | Default        | Default                       |
| Lists (ordered/unordered)           | Default      | Default    | Default        | Default                       |
| Task list items                     | Option       | Option     | **Extension**  | Option (`tasklists`)          |
| Footnotes                           | Option       | Option     | Option         | Option (`footnotes`)          |
| Code spans                          | Default      | Default    | Default        | Default                       |
| Emphasis / strong                   | Default      | Default    | Default        | Default                       |
| Strikethrough                       | Option       | Option     | **Extension**  | Default (`strikethrough`)     |
| Underline                           | Option       | Option     | Option         | Option (`underline`)          |
| Inline / reference / shortcut links | Inline + ref | All three  | All three      | All three                     |
| Images                              | Default      | Default    | Default        | Default                       |
| Image dimensions (`=WxH`)           | Option       | Option     | Option         | Option (`parseImgDimensions`) |
| Autolinks (`<…>`)                   | Default      | Default    | Default        | Default                       |
| Bare-URL / `www.` autolinks         | Option       | Option     | **Extension**  | Option (`simplifiedAutoLink`) |
| GitHub `@mentions`                  | Option       | Option     | Option         | Option (`ghMentions`)         |
| Emoji shortcodes (`:smile:`)        | Option       | Option     | Option         | Option (`emoji`)              |
| Ellipsis (`...` → `…`)              | Option       | Option     | Option         | Default (`ellipsis`)          |
| Entity / numeric refs decoded       | Option       | Default    | Default        | Option (`decodeEntities`)     |
| Disallowed raw HTML (tag filter)    | Option       | Option     | **Extension**  | Option (`disallowRawHTML`)    |
| Hard line break — two spaces        | Default      | Default    | Default        | Default                       |
| Hard line break — backslash         | —            | Default    | Default        | Default                       |

The `gfm` preset also turns on `footnotes`, `ghMentions` and `emoji` by default —
a Showdown convenience beyond the GFM spec's own extensions — so a `gfm`-flavored
converter renders those without extra configuration. See
[Flavor presets](#flavor-presets).

---

# Differences by syntax

Constructs where all four agree (thematic breaks, indented code blocks, HTML
blocks, link reference definitions, paragraphs, blank lines, images, inline HTML)
are omitted. Only the divergences are shown.

## Backslash escapes

The set of characters a leading `\` can turn into a literal differs by flavor.

**Original** — small set (`` \`*_{}[]()#+-.!> ``). `<`, `"`, `&` are **not**
escapable (they are handled by [automatic escaping](#automatic-escaping) instead),
so the backslash stays literal:

Input `\a \" \$ \< \>`:

```html
<p>\a \" \$ \&lt; ></p>
```

**CommonMark · GFM** — any ASCII-punctuation character is escapable; the backslash
is consumed and the character rendered literally (`"` → `&quot;`, `<` → `&lt;`):

Input `\" \< \& \~`:

```html
<p>&quot; &lt; &amp; ~</p>
```

**Showdown** — an even larger set than Original (adds `~ | : ; = ? @ % , / ^ ' " < > & $`),
so `<`, `>`, `"`, `&` *are* escapable and become character references:

Input `\< \> \" \&`:

```html
<p>&lt; &gt; &quot; &amp;</p>
```

## Entity and numeric character references

Input `&copy;`:

| Original · Showdown (default) | CommonMark · GFM     |
|-------------------------------|----------------------|
| `<p>&copy;</p>` (verbatim)    | `<p>©</p>` (decoded) |

Original never decodes references; Showdown matches it unless you set
`decodeEntities: true` (which the `commonmark`/`gfm` presets do).

## ATX headings

**No space after `#`** — input `#Foo`:

| Original · Showdown | CommonMark · GFM |
|---------------------|------------------|
| `<h1>Foo</h1>`      | `<p>#Foo</p>`    |

**Unspaced trailing hashes** — input `# foo#`:

| Original · Showdown       | CommonMark · GFM       |
|---------------------------|------------------------|
| `<h1>foo</h1>` (stripped) | `<h1>foo#</h1>` (kept) |

**Seven or more hashes** — input `####### foo`:

| Original · Showdown                               | CommonMark · GFM                     |
|---------------------------------------------------|--------------------------------------|
| `<h6># foo</h6>` (clamped to h6, surplus in text) | `<p>####### foo</p>` (not a heading) |

Original also requires the `#` to start in **column 0**; CommonMark, GFM and
Showdown allow up to three leading spaces.

## Setext headings

Original applies the underline to the **single preceding line** only; CommonMark,
GFM and Showdown apply it to the **whole preceding paragraph**.

Input:

```md
foo
bar
===
```

**Original** — only the last line is the heading:

```html
<p>foo</p>
<h1>bar</h1>
```

**CommonMark · GFM · Showdown** — the entire paragraph becomes the heading:

```html
<h1>foo
bar</h1>
```

## Heading ids

Only Showdown generates them. Input `# Foo *bar*`:

| Original · CommonMark · GFM | Showdown                                 |
|-----------------------------|------------------------------------------|
| `<h1>Foo <em>bar</em></h1>` | `<h1 id="foo-bar">Foo <em>bar</em></h1>` |

On by default in `vanilla` (off in the other presets via `headerIds: false`, but
re-enable-able under any flavor). GitHub renders ids on github.com, but that is
site post-processing and is not part of the GFM spec.

## Fenced code blocks

Original has **no** fenced code blocks — only indented ones. Input (three
backticks, `foo`, three backticks):

~~~md
```
foo
```
~~~

| Original                                          | CommonMark · GFM · Showdown     |
|---------------------------------------------------|---------------------------------|
| no fenced code block (only indented code exists)  | `<pre><code>foo\n</code></pre>` |

In Showdown this is the `ghCodeBlocks` option (on by default; the `original`
flavor sets it `false`).

## Tables

A GFM-spec extension; in Showdown a global `tables` option (any flavor). Not part
of the Original or CommonMark dialects — those render the pipes as a paragraph.

Input:

```md
| foo | bar |
| --- | --- |
| baz | bim |
```

**GFM · Showdown (`tables`)**:

```html
<table>
<thead>
<tr>
<th>foo</th>
<th>bar</th>
</tr>
</thead>
<tbody>
<tr>
<td>baz</td>
<td>bim</td>
</tr>
</tbody>
</table>
```

Colons in the delimiter row set alignment (`:-:` → `align="center"`,
`--:` → `align="right"`).

## Lists — nesting a sub-list

Original nests a sub-list on **any** extra marker indentation; CommonMark nests
when the child aligns under the parent's content; Showdown's `vanilla` flavor
requires **four spaces** (or a tab), so two spaces does *not* nest.

Input:

```md
* foo
  * bar
```

**Original · CommonMark** — two spaces nests:

```html
<ul>
<li>foo
<ul>
<li>bar</li>
</ul>
</li>
</ul>
```

**Showdown (vanilla)** — two spaces is not enough; the items stay siblings:

```html
<ul>
<li>foo</li>
<li>bar</li>
</ul>
```

(`disableForced4SpacesIndentedSublists` restores the loose behavior.)

## Lists — ordered-list `start` attribute

Input `3. Bird` / `1. McHale` / `8. Parish`:

| Original                | CommonMark · GFM · Showdown |
|-------------------------|-----------------------------|
| `<ol>` numbering from 1 | `<ol start="3">`            |

Original never emits a `start`; the other three honor the first item's number.

## Lists — changing the marker type

Input:

```md
1. one
* two
```

**Original** — a marker change never splits a list; it stays one list typed by its
first marker:

```html
<ol>
<li>one</li>
<li>two</li>
</ol>
```

**CommonMark · GFM · Showdown** — the marker change starts a new list:

```html
<ol>
<li>one</li>
</ol>
<ul>
<li>two</li>
</ul>
```

## Lists — interrupting a paragraph

Input:

```md
Foo
* bar
```

**Original** — a list cannot interrupt a paragraph:

```html
<p>Foo
* bar</p>
```

**CommonMark · GFM · Showdown** — the list interrupts:

```html
<p>Foo</p>
<ul>
<li>bar</li>
</ul>
```

(CommonMark restricts this for *ordered* lists — only a list starting at `1` may
interrupt a paragraph.)

## Task list items

A GFM-spec extension; in Showdown a global `tasklists` option (any flavor). Input:

```md
- [ ] foo
- [x] bar
```

**GFM · Showdown (`tasklists`)**:

```html
<ul>
<li><input disabled="" type="checkbox"> foo</li>
<li><input checked="" disabled="" type="checkbox"> bar</li>
</ul>
```

Original and CommonMark render the literal `[ ]` / `[x]` text.

## Code spans and automatic escaping

Inside code, Original (and Showdown) encode `&`, `<`, `>`. **Showdown additionally
encodes `"` as `&quot;`**; Original leaves it as a literal quote. Input (indented
code block):

```md
    tell application "Foo"
```

| Original                                           | Showdown                                                     |
|----------------------------------------------------|--------------------------------------------------------------|
| `<pre><code>tell application "Foo"\n</code></pre>` | `<pre><code>tell application &quot;Foo&quot;\n</code></pre>` |

The same applies to code spans. (Original also strips **all** leading/trailing
whitespace from a code span's content, where CommonMark strips at most one space
from each end.)

## Automatic escaping of a bare `>`

Input `4 < 5 and 6 > 3`:

| Original                                    | CommonMark · GFM · Showdown                   |
|---------------------------------------------|-----------------------------------------------|
| `<p>4 &lt; 5 and 6 > 3</p>` (bare `>` kept) | `<p>4 &lt; 5 and 6 &gt; 3</p>` (`>` → `&gt;`) |

Original leaves a bare `>` unchanged; the others encode it. Showdown likewise
encodes bare `"` as `&quot;`.

## Emphasis — intraword underscore

Input `un_frigging_believable`:

| Original · Showdown                    | CommonMark · GFM                              |
|----------------------------------------|-----------------------------------------------|
| `<p>un<em>frigging</em>believable</p>` | `<p>un_frigging_believable</p>` (no emphasis) |

Original/Showdown use simple matching (intraword `_` emphasizes); CommonMark/GFM
use the flanking-delimiter algorithm, under which intraword `_` does not.
(Showdown's `literalMidWordUnderscores` option turns this off.)

> The repo's `CommonMark.md` and `gfm.md` fixtures also differ on a handful of
> *pathological* nested-delimiter inputs (e.g. `****foo****`). That is an artifact
> of how the two fixtures were generated, not a designed GFM behavior — GFM's
> emphasis is CommonMark's — so it is not treated as a real flavor difference here.

## Strikethrough

A GFM-spec extension, and on by default in Showdown `vanilla`. Input `~~Hi~~ Hello`:

| Original · CommonMark           | GFM · Showdown               |
|---------------------------------|------------------------------|
| `<p>~~Hi~~ Hello</p>` (literal) | `<p><del>Hi</del> Hello</p>` |

Showdown also accepts a **single** tilde — `~foo~` → `<del>foo</del>` — where GFM
requires two.

## Links — shortcut references

A bare `[foo]` with a matching definition. Input:

```md
[foo]

[foo]: /url "title"
```

| Original                    | CommonMark · GFM · Showdown                   |
|-----------------------------|-----------------------------------------------|
| `<p>[foo]</p>` (not a link) | `<p><a href="/url" title="title">foo</a></p>` |

Original follows Markdown 1.0.1, where single-bracket shortcut references are not
links; the other three recognize them.

## Autolinks

**Angle-bracket scheme** — input `<made-up-scheme://foo,bar>`:

| Original · Showdown                               | CommonMark · GFM                                                         |
|---------------------------------------------------|--------------------------------------------------------------------------|
| not a link (only `http`/`https`/`ftp` recognized) | `<p><a href="made-up-scheme://foo,bar">made-up-scheme://foo,bar</a></p>` |

**Bare URLs in running text** — input `visit www.commonmark.org now`:

| Original · CommonMark · Showdown (default) | GFM                                                                           |
|--------------------------------------------|-------------------------------------------------------------------------------|
| left as plain text                         | `<p>visit <a href="http://www.commonmark.org">www.commonmark.org</a> now</p>` |

Bare-URL / `www.` autolinking is the GFM `autolink` extension; in Showdown it is
the `simplifiedAutoLink` option (off in `vanilla`, on in the `gfm` preset).

## Hard line breaks

A trailing **backslash** before the newline. Input (`foo\` then a line break):

```md
foo\
bar
```

| Original                           | CommonMark · GFM · Showdown |
|------------------------------------|-----------------------------|
| not a break (backslash is literal) | `<p>foo<br />\nbar</p>`     |

All four treat **two trailing spaces** as a hard break; only Original lacks the
backslash form. (Showdown's `simpleLineBreaks` option makes *every* newline a
`<br />`.)

## Ellipsis

Showdown-only, on by default in `vanilla`. Input `Wait... what...`:

| Original · CommonMark · GFM | Showdown             |
|-----------------------------|----------------------|
| `<p>Wait... what...</p>`    | `<p>Wait… what…</p>` |

---

# Reference

## Where each construct originates

The "Showdown features" below are converter **options**, so they are not locked to
one flavor — any of them can be enabled under the `original`, `commonmark` or
`gfm` flavor too (the flavor only sets the default). What is lineage-specific is
the *core parsing model*, not the optional add-ons.

**Core parsing differences in the CommonMark → GFM lineage** (things Showdown's
default parser does *not* do unless you set `cmSpec: true`):

- The flanking-based emphasis / delimiter-run algorithm
- Seven typed HTML blocks
- Entity decoding by default (Showdown exposes this as the `decodeEntities` option)
- The GFM spec's *spec-level* extensions: tables, strikethrough, task lists,
  extended autolinks, tag filter

**Core parsing differences in the Original → Showdown lineage:**

- Original's "any-indent nests a sublist" and "first-marker types the list" rules,
  and Showdown's four-space-sublist / marker-change-splits-list resolutions

**Showdown-implemented extras** (converter options/defaults, usable under any flavor):

- Generated heading ids, ellipsis, underline, footnotes, metadata, emoji,
  `@mentions`, image dimensions, bare-URL autolinks, simplified/https autolinks

## Showdown default extras vs. Original

On top of Original Markdown, **Showdown's `vanilla` defaults add** (from
[showdown.md, Appendix A](showdown.md#appendix-a-differences-from-original-markdown)):

- Fenced code blocks
- Strikethrough (`~x~` / `~~x~~`)
- Generated heading ids
- Ellipsis (`...` → `…`)
- Backslash hard line breaks
- Shortcut reference links
- `<www.…>` autolink scheme-prepending
- Image-dimension grammar (`=WxH`)

…and it **resolves shared syntax differently** from Original: larger backslash-escape
set, indentable ATX headings, multi-line setext headings, four-space sublists,
`start` attributes on ordered lists, marker-change splits a list, a list can
interrupt a paragraph, extra automatic escaping of `>` and `"`, and deterministic
email obfuscation.

## Flavor presets

Showdown ships these presets (`showdown.setFlavor(name)`); each is a bundle of
option overrides on top of the `vanilla` defaults specified by
[showdown.md](showdown.md):

| Flavor       | Overrides                                                                                                                                                                                                                  |
|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `vanilla`    | none (the defaults)                                                                                                                                                                                                        |
| `original`   | `headerIds: false`, `ghCodeBlocks: false`, `strikethrough: false` → targets [original.md](original.md)                                                                                                                     |
| `commonmark` | `cmSpec: true`, `decodeEntities: true`, `headerIds: false`, `strikethrough: false`, `encodeEmails: false` → targets [CommonMark.md](CommonMark.md)                                                                         |
| `gfm`        | everything in `commonmark`, plus `strikethrough`, `tables`, `tasklists`, `footnotes`, `ghMentions`, `simplifiedAutoLink`, `emoji`, `ghCodeBlocks`, `omitExtraWLInCodeBlocks`, `disallowRawHTML` → targets [gfm.md](gfm.md) |
| `github`     | alias of `gfm` (backwards compatibility)                                                                                                                                                                                   |

Setting `cmSpec: true` (the `commonmark` and `gfm` presets) re-bases Showdown's
parser on the CommonMark/GFM specs, so those two documents — not
[showdown.md](showdown.md) — become the normative reference for those flavors.

---

*This is an informative overview. Where it and a per-flavor spec disagree, the
per-flavor spec ([original.md](original.md), [CommonMark.md](CommonMark.md),
[gfm.md](gfm.md), [showdown.md](showdown.md)) governs.*
