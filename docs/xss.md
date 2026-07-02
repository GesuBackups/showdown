# Markdown's XSS vulnerability

## Introduction

Cross-Site Scripting (XSS) is a well-known technique to gain access to the private information of users on a website. The attacker injects spurious HTML content (a script) on the web page. This script can read the user’s cookies and do other malicious actions (like steal credentials). As a countermeasure, you should always filter user input for suspicious content. Showdown doesn’t include an XSS filter, so you must provide your own. But be careful in how you do it.

## Markdown is inherently unsafe

Markdown syntax allows the inclusion of arbitrary HTML. For example, below is a perfectly valid Markdown:

```md
This is a regular paragraph.

<table>
    <tr><td>Foo</td></tr>
</table>

This is another regular paragraph.
```

This means that an attacker could do something like this:

```md
This is a regular paragraph.

<script>alert('xss');</script>

This is another regular paragraph.
```

While `alert('xss');` is hardly problematic (maybe just annoying) a real-world scenario might be a lot worse. Obviously, you can easily prevent this kind of this straightforward attack. For example, you can define a whitelist for Showdown that will contain a limited set of allowed HTML tags. However, an attacker can easily circumvent this "defense".

## Whitelist / blacklist can't prevent XSS

Consider the following Markdown content:

```md
hello <a href="www.google.com">*you*</a>
```

As you can see, it's a link, nothing malicious about this. And `<a>` tags are pretty innocuous, right? Showdown should definitely allow them. But what if the content is slightly altered, like this:

```md
hello <a name="n" href="javascript:alert('xss')">*you*</a>
```

Now this is a lot more problematic. Once again, it's not that hard to filter Showdown's input to expunge problematic attributes (such as `href` in `<a>` tags) of scripting attacks. In fact, a regular HTML XSS prevention library should catch this kind of straightforward attack.

At this point you're probably thinking that the best way is to follow Stackoverflow's cue and disallow embedded HTML in Markdown. Unfortunately it's still not enough.

## Strip HTML tags is not enough

Consider the following Markdown input:

```md
[some text](javascript:alert('xss'))
```

Showdown will correctly parse this piece of Markdown input as:

```html
<a href="javascript:alert('xss')">some text</a>
```

In this case, it was Markdown's syntax itself to create the dangerous link. HTML XSS filter cannot catch this. And unless you start striping dangerous words like *javascript* (which would make this article extremely hard to write), there's nothing you can really do to filter XSS attacks from your input. Things get even harder when you tightly mix HTML with Markdown.

## Mixed HTML/Markdown XSS attack

Consider the following piece of Markdown:

```md
> hello <a name="n"
> href="javascript:alert('xss')">*you*</a>
```

If you apply an XSS filter to filter bad HTML in this Markdown input, the XSS filter, expecting HTML, will likely think the `<a>` tag ends with the first character on the second line and will leave the text snippet untouched. It will probably fail to see that the `href="javascript:…"` is part of the `<a>` element and leave it alone. But when Markdown converts this to HTML, you get this:

```html
<blockquote>
 <p>hello <a name="n"
 href="javascript:alert('xss')"><em>you</em></a></p>
</blockquote>
```

After parsing with Markdown, the first `>` on the second line disappears because it was the blockquote marker in the Markdown blockquote syntax. As a result, you’ve got a link containing an XSS attack!

Did Markdown generate the HTML? No, the HTML was already in plain sight in the input. The XSS filter couldn’t catch it because the input doesn’t follow HTML rules: it’s a mix of Markdown and HTML, and the filter doesn’t know a dime about Markdown.

## Showdown's built-in hardening

Showdown still follows the **trusted-input** model — it is **not** an HTML sanitizer, and by default it passes raw HTML and arbitrary URL schemes straight through. However, recent versions add opt-in and always-on hardening you should be aware of:

### `safeMode` (opt-in, recommended for untrusted input)

Enabling the [`safeMode`](options.md#safemode) option provides defense-in-depth:

```js
const converter = new showdown.Converter({ safeMode: true });
converter.makeHtml("[click](javascript:alert(1))"); // => <p><a href="">click</a></p>
converter.makeHtml("<img src=x onerror=alert(1)>"); // => <p><img src=x></p>
converter.makeHtml("<script>alert(1)</script>");    // => &lt;script>alert(1)&lt;/script>
```

It (1) blocks dangerous URL schemes (`javascript:`, `vbscript:`, `data:` — except `data:image/...`), resolving entity/whitespace obfuscations, and (2) escapes all raw HTML tags and strips inline event-handler attributes (`onerror`, `onload`, …). It directly addresses the `[text](javascript:…)` and mixed HTML/Markdown attacks shown above.

!!! danger "Still not a full sanitizer"
    `safeMode` is **defense-in-depth, not a replacement** for a dedicated sanitizer. Treat it as one layer, not the whole defense.

### Always-on hardening

These apply regardless of options:

* **Front-matter metadata is HTML-escaped** before being written into the document head, so a `metadata` value like `</title><script>…` can no longer break out of `<title>`/`<meta>` when `completeHTMLDocument` is enabled.
* **Generated attribute values are quote-escaped** at emit time, so values injected via an extension/listener (through the `setAttributes()` event API) cannot break out of an attribute.
* **`makeMarkdown` (HTML → Markdown) parses into an *inert* document.** Assigning untrusted HTML never executes `<script>` nor fires `on*` handlers such as `<img onerror>`/`<svg onload>`, even in a browser.
* **`makeMarkdown` escapes emitted destinations/titles**, so a crafted attribute cannot inject a brand-new `[link](javascript:…)` when the Markdown is round-tripped back through `makeHtml`.
* **Link/image and reference parsing are bounded**, so pathological inputs cannot cause catastrophic (quadratic) backtracking — a denial-of-service vector when converting large untrusted inputs.

## Mitigate XSS

So, is it all lost? Not really. Combine the built-in hardening above with output filtering:

1. **Enable [`safeMode`](options.md#safemode)** when the Markdown is untrusted.
2. **Filter the *output*, not the input.** After the input is converted to full-fledged HTML, apply a dedicated sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify). Filtering the *input* breaks Markdown features and still leaves holes (as shown above).
3. **Serve a [Content-Security-Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP)** (e.g. a `script-src` without `unsafe-inline`) as a backstop.
4. **Bound untrusted input size and/or use a timeout.** Converting very large adversarial inputs can be CPU-intensive; cap the size and/or convert off the request thread.
5. **Only load extensions you trust** — extensions run with full trust and can inject arbitrary HTML.

Also, client-side validations are not reliable. It should be a given, but in case you're wondering, you should (almost) never trust data sent by the client. If there's some critical operation you must perform on the data (such as XSS filtering), you should do it *SERVER-SIDE* not client-side.

HTML XSS filtering libraries are useful here since they prevent most of the attacks. However, you should not use them blindly: a library can't predict all the contexts and situations your application may face.

## Conclusion

Showdown converts the input text as closely as possible; by default it does not itself filter for XSS or malicious intent. So, the basic rules are:

* **enable [`safeMode`](options.md#safemode) for untrusted input** — it blocks dangerous URL schemes and neutralizes raw HTML/event handlers as defense-in-depth (but is not a full sanitizer).
* **removing HTML entities from Markdown does not prevent XSS**. Markdown syntax can generate XSS attacks.
* **XSS filtering should be done after Showdown has processed input, not before or during**. If you filter before, it will break some of Markdown’s features and will leave security holes. Use a dedicated sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify) on the output, and serve a [CSP](https://developer.mozilla.org/docs/Web/HTTP/CSP).
* **perform the necessary filtering server-side, not client-side**. XSS filtering libraries are useful but should not be used blindly.
* **bound the size of untrusted input** to avoid CPU-intensive conversions of adversarial payloads.

## Disclaimer

This page is based on the excellent article: ["Markdown and XSS"][1] by [Michel Fortin][2] 

[1]: https://michelf.ca/blog/2010/markdown-and-xss/
[2]: https://github.com/michelf
