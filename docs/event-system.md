## Introduction

The **event system** is the foundation of Showdown's main extension mode: [`listener` extensions](create-extension.md#listener-extensions). As Showdown parses a document, its sub-parsers emit events, and a listener can subscribe to any of them to inspect or modify the conversion in flight. It supersedes the legacy [`lang`/`output` extensions](extensions.md#extension-modes), which are now deprecated and reimplemented as listeners on top of it.

In short, the event system lifecycle looks as follows:

1. A sub-parser emits an event.

    !!! note ""
        Each sub-parser can emit a batch of events (see the list below)

2. Extension A (which is a _Listener Extension_) registers and listens to a specific event.

    !!! note ""
        An extension can only register for a specific event

3. Extension A receives an event object and modifies it.

    !!! note ""
        Certain properties of the event object can be changed, which will change the behavior or output of the sub-parser

4. Extension A returns the event object to the converter.

5. The converter passes the received event object to the next extension in the chain.


## Sub-parser taxonomy: constructs vs. mechanisms

Not every function in the conversion pipeline emits events. The registry distinguishes two
kinds of pass:

* **Constructs** — a pass that recognizes a piece of Markdown syntax and produces output
  (headings, lists, links, emphasis, code, tables, footnotes, …). Constructs are registered
  sub-parsers and emit the full event set: `onStart`/`onEnd` always, plus `onCapture`/`onHash`
  per match (for constructs that match discrete pieces). These are the events listener
  extensions hook.
* **Mechanisms** — internal plumbing that has no syntax of its own: the character-level
  encoders (`encodeCode`, `encodeAmpsAndAngles`, `encodeBackslashEscapes`,
  `escapeSpecialCharsWithinTagAttributes`), the hash/unhash helpers (`hashBlock`,
  `hashHTMLBlocks`, `hashHTMLSpans`, `hashCodeTags`, `hashPreCodeTags`, `unhashHTMLSpans`,
  `unescapeSpecialChars`) and the heading-id generator. These are plain `showdown.helper.*`
  functions and emit **no events**.

Two further passes emit no events even though they are registered sub-parsers:

* the inline/block **dispatchers** `spanGamut` and `blockGamut` — they only route text through
  the constructs above and match nothing themselves (the document-level events below cover
  whole-text hooks);
* **`decodeEntities`** — its output is bare characters, so per-entity events would be noise.

The one deliberate exception to "mechanisms have no events": **`heading.id`** is a helper, but
it still emits a single `makehtml.heading.id.onCapture` event so extensions can implement
custom slug generation (see below).

## Event Object

### Properties

#### matches

**matches** is an object that holds the content captured by the sub-parser. The main captured
content is always exposed under the **`text`** property (for every construct that has inner
content); construct-specific extras use descriptive names (`url`, `title`, `format`, `level`, …).
Properties whose names start with `_` (underscore) are read-only context — mutating them has no
effect. A few constructs with no inner content (e.g. `horizontalRule`, `stripLinkDefinitions`)
omit `text` entirely.

!!! example "blockquote `onCapture` event"

    ```js
    {
      _wholeMatch: "> some awesome quote",
      text: "some awesome quote"
    }
    ```

## Event types

Events are emitted when a sub-parser runs (or is about to be run).
The `makehtml` (Markdown to HTML) sub-parsers emit up to four events, in this strict order: [`onStart`](#onstart) -> [`onCapture`](#oncapture) -> [`onHash`](#onhash) -> [`onEnd`](#onend).

The `makeMarkdown` (HTML to Markdown) sub-parsers emit a subset of these — see [makeMarkdown events](#makemarkdown-html-to-markdown-events) below.

### onStart

**`<converter>.<subparser>.onStart`**: **always runs** except if the sub-parser is disabled.

Emitted when the sub-parser has started, but no capturing or modifications to the text were done.

**Always runs** except if the sub-parser is disabled via options.

!!! hint "When to use `onStart` event"
    Use this event when you want to change the input passed to the sub-parser. 

!!! warning ""
    Please note that the input is the **full text** that was passed to the converter.
    
**Properties**
         
| property     | type     | access  | description                                                    |
|--------------|----------|---------|----------------------------------------------------------------|
| `input`      | `string` | `read`  | Full text that was passed to the subparser                     |
| `output`     | `string` | `write` | Full text with modification that will be passed along the chain |
| `regexp`     | `null`   |         |                                                                |
| `matches`    | `null`   |         |                                                                |
| `attributes` | `null`   |         |                                                                |

### onCapture

**`<converter>.<subparser>.onCapture`**: *might not be run*.
 
Emitted when a regex match is found and capture was successful.
Further normalization and modification of the regex captured groups might be performed.

Might not be run if no regex match found.

!!! hint "When to use `onCapture` event"
    Use this event if you want to:

    * modify the sub-parser behavior, text;
    * modify the HTML output of the sub-parser.

**Properties**

| property     | type     | access       | description                                                       |
|--------------|----------|--------------|-------------------------------------------------------------------|
| `input`      | `string` | `readonly`   | The captured text                                                 |
| `output`     | `string` | `write`      | `null` or well-formed HTML (see the Important Note below)         |
| `regexp`     | `RegExp` | `readonly`   | Regular Expression to capture groups                              |
| `matches`    | `object` | `read/write` | Match groups. Changes to this object are reflected in the output. |
| `attributes` | `object` | `read/write` | Attributes to add to the HTML output                              |

!!! warning "IMPORTANT NOTE"
    Extensions listening to the `onCapture` event **should avoid** changing the output property.
    Instead, they should modify the values of the matches and attribute objects.
    
    The reason is that the **output property takes precedence over the matches objects** and
    **prevents showdown from calling other sub-parsers** inside the captured fragment.

    The above means the following:

    1. If something is passed as the output property, any changes to the matches and attributes objects will be ignored.
    1. Any changes made by other extensions to the matches or attributes objects will be ignored.
    1. Showdown will not call other sub-parsers, such as encode code or span gamut in the text fragment, which may lead to unexpected results.

    **Example**

    !!! example ""

        ```js hl_lines="4"
        // Showdown extension 1 that is listening to makehtml.blockquote.onCapture
        function extension_1 (showdownEvent) {
          // Let's imagine you're a bad person who writes to output
          showdownEvent.output = '<blockquote>foo</blockquote>'; // must be a well-formed HTML
          showdownEvent.matches.text = 'some nice quote'; 
        }

        // Showdown extension 2 that is also listening to makehtml.blockquote.onCapture
        function extension_2 (showdownEvent) {
          // I make blockquotes bold
          let quote = showdownEvent.matches.text;
          showdownEvent.matches.text = '<strong>' + quote + '</strong>'; 
        }
        ```

        In the example above, the result will always be `<blockquote>foo</blockquote>`, regardless of the order of extension loading and call.

!!! danger "Infinite loop"
    Do not pass the input as output to the `onCapture` event, or you might trigger an infinite loop.

!!! example "Open external links in a new tab"
    The link sub-parsers expose the anchor's `attributes` on their `onCapture` event, so a
    listener can add `target`/`rel` to the generated `<a>`. This replaces the removed
    `openLinksInNewWindow` option — and, unlike the old option, you control exactly which links
    are affected.

    The link sub-parsers emit one event per link type (`inline`, `reference`, `angleBrackets`,
    `autoLink`), so register a listener for each type you want to cover:

    ```js
    const converter = new showdown.Converter();

    ['inline', 'reference', 'angleBrackets', 'autoLink'].forEach(function (type) {
      converter.listen('makehtml.link.' + type + '.onCapture', function (evt) {
        // leave in-page hash links (#section) opening in the same tab
        if (!/^#/.test(evt.attributes.href)) {
          evt.attributes.target = '_blank';
          evt.attributes.rel = 'noopener noreferrer';
        }
        return evt;
      });
    });

    converter.makeHtml('[showdown](https://github.com/showdownjs/showdown)');
    // <p><a href="https://github.com/showdownjs/showdown" target="_blank"
    //       rel="noopener noreferrer">showdown</a></p>
    ```

!!! example "Customizing GFM task-list checkboxes"
    GFM task-list items (`- [ ] todo` / `- [x] done`, enabled with the `tasklists` option) have
    their checkbox rendered by a dedicated sub-parser that both list parsers — the default one
    and the `commonmark`-flavor one — delegate to. Because of that, a single listener covers
    task lists in **every flavor**.

    It runs on the item's **raw source line**, before any inline/block parsing, and emits two
    events under the `makehtml.list.taskListItem` namespace:

    * **`makehtml.list.taskListItem.checkbox.onCapture`** — fired on a matched task line. The
      `attributes` object holds the `<input>` checkbox attributes, so a listener can re-style or
      tag the checkbox; the `matches` object exposes the whole line. As with every `onCapture`
      event, prefer mutating `matches`/`attributes` over writing `output` (see the note above).
    * **`makehtml.list.taskListItem.checkbox.onHash`** — fired with the rendered line
      (`<input ...> todo`) just before it is handed back to the list parser.

    **`onCapture` properties**

    | property     | type     | access       | description                                                              |
    |--------------|----------|--------------|--------------------------------------------------------------------------|
    | `input`      | `string` | `readonly`   | The full task source line, e.g. `[ ] buy milk`                           |
    | `output`     | `string` | `write`      | `null`, or well-formed HTML for the whole line (takes precedence)        |
    | `regexp`     | `RegExp` | `readonly`   | The marker-matching regular expression                                   |
    | `matches`    | `object` | `read/write` | See below                                                                |
    | `attributes` | `object` | `read/write` | Attributes of the `<input>` checkbox (`type`, `disabled`, `checked`, …)  |

    The `matches` object:

    ```js
    {
      _wholeMatch: "[ ] buy milk",   // the matched source line
      _taskListButton: "[ ]",         // the literal marker (read-only)
      _taskListButtonChecked: " ",    // the marker char: " ", "x" or "X" (read-only)
      text: " buy milk"               // everything after the marker (write to relabel)
    }
    ```

    ```js
    const converter = new showdown.Converter({ tasklists: true });

    // Give every checkbox a class and tag completed items.
    converter.listen('makehtml.list.taskListItem.checkbox.onCapture', function (evt) {
      evt.attributes.classes = ['task-checkbox'];
      if (evt.attributes.checked) {
        evt.attributes.classes.push('is-done');
      }
      return evt;
    });

    converter.makeHtml('- [x] ship it');
    // <ul>
    // <li><input checked disabled type="checkbox" class="task-checkbox is-done"> ship it</li>
    // </ul>
    ```

    !!! note "The `makehtml.list.taskListItem` namespace"
        These checkbox events are nested under the broader **`makehtml.list`** event family.
        Both list parsers — the default one and the `commonmark`-flavor one — emit the same set,
        so every event below fires in **every flavor**:

        * **`makehtml.list.{onStart,onCapture,onHash,onEnd}`** — the whole list block.
        * **`makehtml.list.listItem.{onCapture,onHash}`** — each non-task `<li>`.
        * **`makehtml.list.taskListItem.{onCapture,onHash}`** — each task `<li>` (the surrounding
          item, carrying the full item — which for a loose item may span several blocks). This is
          the event to use to read or rewrite a task **item** (checkbox **and** label).
        * **`makehtml.list.taskListItem.checkbox.{onCapture,onHash}`** — just the checkbox/label
          line (above), via the shared sub-parser.

### onHash

**`<converter>.<subparser>.onHash`**: *always runs*.
 
Raised before the output is hashed.

**Always runs** (except if the sub-parser is disabled via options), even if no hashing is performed. 

!!! hint "When to use `onHash` event"
    Use this event when you want to change the sub-parser's raw output before it is hashed.

**Properties**
        
| property     | type     | access  | description                                  |
|--------------|----------|---------|----------------------------------------------|
| `input`      | `string` | `read`  | The captured text                            |
| `output`     | `string` | `write` | The text that will be passed along the chain |
| `regexp`     | `null`   |         |                                              |
| `matches`    | `null`   |         |                                              |
| `attributes` | `null`   |         |                                              |

### onEnd
 
**`<converter>.<subparser>.onEnd`**: **always runs**;
 
Emitted when the sub-parser has finished its work and is about to exit.

**Always runs** (except if the sub-parser is disabled via options).

!!! hint "When to use `onEnd` event"
    Use this event when you want to run code or perform changes to the text after the subparser has run and its output was hashed.

!!! warning ""
    Please note that the input is the **full text** and might contain hashed elements.

**Properties**
    
| property  | type     | access  | description                                                 |
|-----------|----------|---------|-------------------------------------------------------------|
| `input`   | `string` | `read`  | Full text with the subparser modifications (contains hashes) |
| `output`  | `string` | `write` | The text that will be passed to other subparsers            |
| `regexp`  | `null`   |         |                                                             |
| `matches` | `null`   |         |                                                             |

## Construct capture events reference

Every construct emits `onStart`/`onEnd`; the ones that match discrete pieces additionally emit
`onCapture`/`onHash`. The `matches.text` key carries the main captured content for constructs
that have inner content; a handful with no inner content (`horizontalRule`, `hardLineBreaks`,
`stripLinkDefinitions`, `footnotes.reference`) omit `text` and expose only read-only `_`-context
plus `attributes`/output-override.

### Complete event-family list (makehtml)

| Family | Lifecycle (`onStart`/`onEnd`) | Capture (`onCapture`/`onHash`) |
|---|---|---|
| `makehtml.blockquote` | ✓ | ✓ |
| `makehtml.codeBlock` | ✓ | ✓ |
| `makehtml.codeSpan` | ✓ | ✓ |
| `makehtml.disallowedHtmlTags` | ✓ | ✓ (per neutralized tag) |
| `makehtml.ellipsis` | ✓ | ✓ |
| `makehtml.emoji` | ✓ | ✓ |
| `makehtml.emphasisAndStrong` | ✓ | at `.emphasis` / `.strong` / `.emphasisAndStrong` |
| `makehtml.footnotes` | ✓ | at `.definition` / `.reference` |
| `makehtml.githubCodeBlock` | ✓ | ✓ |
| `makehtml.hardLineBreaks` | ✓ | ✓ (per break, no `text`) |
| `makehtml.heading` | ✓ (also `.atx` / `.setext` own lifecycle) | at `.atx` / `.setext`; plus the capture-only `.id` hook |
| `makehtml.horizontalRule` | ✓ | ✓ (no `text`) |
| `makehtml.image` | ✓ | at `.inline` / `.reference` |
| `makehtml.link` | ✓ | at `.inline` / `.reference` / `.angleBrackets` / `.autoLink` |
| `makehtml.list` | ✓ | ✓; plus `.listItem`, `.taskListItem`, `.taskListItem.checkbox` (checkbox also has its own lifecycle) |
| `makehtml.metadata` | ✓ | ✓ |
| `makehtml.paragraphs` | ✓ | ✓ (per paragraph, `regexp` is `null`) |
| `makehtml.strikethrough` | ✓ | ✓ |
| `makehtml.stripLinkDefinitions` | ✓ | ✓ (per definition, no `text`) |
| `makehtml.table` | ✓ | ✓; plus `.header` / `.cell` capture |
| `makehtml.underline` | ✓ | ✓ |
| `makehtml.completeHTMLDocument` | ✓ | — (document wrapper, lifecycle only) |
| `makehtml.cmInline` | ✓ | — (the `commonmark`/`github`-flavor inline engine; lifecycle only — its links currently re-emit `makehtml.link.reference`/`.autoLink` capture events) |
| *(document level)* `makehtml.onStart` / `.onPreParse` / `.onEnd` | — | — (see [below](#makehtml-document-level-events)) |

`decodeEntities`, the dispatchers (`blockGamut`, `spanGamut`) and every `showdown.helper.*`
mechanism emit **no events** — see the [taxonomy](#sub-parser-taxonomy-constructs-vs-mechanisms).

Notable per-construct events:

* **`makehtml.paragraphs.onCapture` / `.onHash`** — one event per paragraph. `matches.text` is
  the paragraph's Markdown (mutable and honored); `attributes` are applied to the generated
  `<p>`. `regexp` is `null` (paragraphs are found by a blank-line split, not a regex).
* **`makehtml.hardLineBreaks.onCapture` / `.onHash`** — one event per hard break. No `text`
  key; `attributes` are applied to the emitted `<br>`, and a listener may override `output`.
* **`makehtml.disallowedHtmlTags.onCapture` / `.onHash`** — one event per neutralized tag
  (only runs under the `disallowRawHTML`/`safeMode` options). `matches.text` is the matched tag
  opening (`<script`, `</iframe`, …); a listener can **whitelist** a tag by setting `output` to
  the original tag so it is left unescaped.
* **`makehtml.footnotes.definition.onCapture` / `.onHash`** — one event per collected footnote
  definition (`[^id]: body`). `matches.text` is the footnote body (mutable and honored — it is
  later rendered via a nested conversion); `_label`/`_rawLabel` are read-only context.
* **`makehtml.footnotes.reference.onCapture` / `.onHash`** — one event per footnote reference
  (`[^id]`). No `text` key (the reference renders as a generated `<sup>`); `_label`,
  `_rawLabel` and `_number` are read-only context and a listener may override `output`.
* **`makehtml.heading.id.onCapture`** — capture-only (a helper, no lifecycle/hash). Fired with
  the generated heading id under `matches.text` (mutable and honored), so a listener can supply
  a custom slug; `_headingText` is read-only context. Deduplication of duplicate ids runs after
  the hook, so a custom slug is still made unique within the document.

    ```js
    // Custom-slugify: replace showdown's id generation
    converter.listen('makehtml.heading.id.onCapture', function (evt) {
      evt.matches.text = evt.matches._headingText.trim().toLowerCase().replace(/\s+/g, '_');
      return evt;
    });
    ```

The GFM task-list checkbox sub-parser (`makehtml.list.taskListItem.checkbox`) is a registered
sub-parser, so it now also emits the lifecycle `onStart`/`onEnd` events in addition to its
`onCapture`/`onHash` (documented under [onCapture](#oncapture) above).

## makeHtml document-level events

Besides the per-sub-parser events above, `makeHtml()` emits three **document-level** events that wrap the whole conversion. They are the place to transform the entire document before or after parsing, and are what `lang`/`output` extensions are built on:

* **`makehtml.onStart`** — emitted once with the **raw** Markdown, *before* any escaping or line-ending normalization. Listeners here see the literal source (real `$`, `¨`, `\r\n`, …) and can rewrite it wholesale.
* **`makehtml.onPreParse`** — emitted once *after* escaping/normalization and immediately *before* the sub-parsers run. This is where [`lang` extensions](create-extension.md#type) run (as listeners). The input at this stage contains Showdown's internal placeholders — e.g. an escaped `$` appears as `¨D` and an escaped `¨` as `¨T` — so prefer `onStart` if you need the untouched source.
* **`makehtml.onEnd`** — emitted once with the **final HTML**, after every sub-parser and the optional complete-document wrapping. This is where [`output` extensions](create-extension.md#type) run (as listeners); use it to post-process the generated HTML.

### Properties

| property     | type     | access  | description                                                                                  |
|--------------|----------|---------|----------------------------------------------------------------------------------------------|
| `input`      | `string` | `read`  | `onStart`: raw Markdown. `onPreParse`: escaped/normalized Markdown. `onEnd`: the final HTML.  |
| `output`     | `string` | `write` | The text that will be passed along (return a string from the listener, or set this and return the event). |
| `regexp`     | `null`   |         |                                                                                              |
| `matches`    | `null`   |         |                                                                                              |
| `attributes` | `null`   |         |                                                                                              |

!!! example ""

    ```js
    // Add a class to every paragraph in the final HTML
    converter.listen('makehtml.onEnd', function (evt) {
      return evt.input.replace(/<p>/g, '<p class="md">');
    });
    ```

## makeMarkdown (HTML to Markdown) events

The reverse converter — `<converter>.makeMarkdown()`, which turns HTML back into Markdown — also emits namespaced events. Because its sub-parsers operate on **DOM nodes** (one construct at a time) rather than running regular expressions over text, they emit only two of the lifecycle events: [`onStart`](#onstart) and [`onEnd`](#onend). There is no `onCapture`/`onHash` phase, since there is no regex capture step.

Event names follow the same `<converter>.<subparser>.<event>` convention, with `makeMarkdown` as the converter prefix:

* **`makeMarkdown.<subparser>.onStart`**
* **`makeMarkdown.<subparser>.onEnd`**

emitted by each of these sub-parsers: `blockquote`, `break`, `codeBlock`, `codeSpan`, `emphasis`, `header`, `hr`, `image`, `input`, `links`, `list`, `listItem`, `paragraph`, `pre`, `strikethrough`, `strong`, `table`, `tableCell`, `txt`, `underline`.

The recursive `node` dispatcher (the analogue of makehtml's `blockGamut`/`spanGamut`) also emits **`makeMarkdown.node.onStart`** / **`makeMarkdown.node.onEnd`** for every node it processes. Because every node passes through it, this is the one place to observe (or override) content that has no dedicated sub-parser — HTML comments and unknown/raw elements.

In addition, two **document-level** events wrap the whole conversion:

* **`makeMarkdown.onStart`** — emitted once with the raw HTML source, before it is parsed into a DOM. Listeners can rewrite the source.
* **`makeMarkdown.onEnd`** — emitted once with the final generated Markdown. Listeners can post-process it.

### Properties

Unlike the makehtml events, the `input` of a makeMarkdown event is a single node/fragment, **not** the full document text:

| property     | type     | access  | description                                                                                             |
|--------------|----------|---------|---------------------------------------------------------------------------------------------------------|
| `input`      | `string` | `read`  | `onStart`: the serialized HTML (or text value) of the node being processed. `onEnd`: the generated Markdown. |
| `output`     | `string` | `write` | The Markdown string that will be used / passed along (see the override note below).                     |
| `matches`    | `object` | `read`  | Holds `{ node }` — the source DOM node currently being converted.                                       |
| `regexp`     | `null`   |         |                                                                                                         |
| `attributes` | `null`   |         |                                                                                                         |

!!! hint "Overriding a node's rendering with `onStart`"
    The `onStart` event's `output` starts as `null`. If a listener sets it to a non-empty string, that string is used as the sub-parser's result and the **default rendering of the node is skipped** (the matching `onEnd` event still runs). This is the makeMarkdown equivalent of the `onCapture` output-precedence behavior.

    !!! example ""

        ```js
        // Render every <a> as bare text instead of a Markdown link
        converter.listen('makeMarkdown.links.onStart', function (evt) {
          evt.output = evt.matches.node.textContent;
          return evt;
        });
        ```

## Special Events

!!! warning "Removed"
    The `.before.{subparserName}` and `.after.{subparserName}` special events were **deprecated in 2.0** and have been **removed in 3.0**. Use the per-sub-parser [`onStart`](#onstart) and [`onEnd`](#onend) events instead.
