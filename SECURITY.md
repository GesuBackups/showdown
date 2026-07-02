# Security Policy

## Supported Versions

Security fixes are addressed for the following versions of Showdown.

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x: (Known security issue with yargs dependecy) |

Showdown targets the node.js versions targeted in the [node.js release schedule](https://nodejs.org/en/about/releases/). Our test suite follows this release schedule. Consequently, older versions of node may become unusable.

## Reporting a Vulnerability

To report a vulnerability, please add an issue to our main github page: https://github.com/showdownjs/showdown/issues

## Security model & hardening

Showdown converts Markdown to HTML under a **trusted-input** model: by design it passes raw HTML and arbitrary URL schemes through to the output, because Markdown relies on this for many features. **Showdown is not an HTML sanitizer.** If the Markdown you convert can come from untrusted users, you are responsible for sanitizing the output.

Recommended controls for untrusted input:

- **Enable `safeMode`** (`new showdown.Converter({ safeMode: true })`). It provides defense-in-depth by (1) blocking dangerous URL schemes (`javascript:`, `vbscript:`, `data:` except `data:image/*` for image `src`) in generated links/images, and (2) escaping all raw HTML tags and stripping inline event-handler attributes (`onerror`, `onload`, …). It is **not** a full sanitizer.
- **Sanitize the output** with a dedicated library such as [DOMPurify](https://github.com/cure53/DOMPurify) before inserting it into the DOM.
- **Serve a Content-Security-Policy** (e.g. `script-src` without `unsafe-inline`) as a backstop.
- **Bound input size / use a timeout.** Converting very large adversarial inputs can be CPU-intensive; cap the size of untrusted Markdown and/or run conversion off the request thread with a time budget.
- Note that **`disallowRawHTML`** is only the narrow GFM tagfilter blacklist, not a general sanitizer.
- Extensions run with full trust (they can inject arbitrary HTML and compile arbitrary regexes). Only load extensions you trust.
- The `makeMarkdown` (HTML → Markdown) direction parses input into an **inert** document, so it does not execute scripts or fire `on*` handlers even in a browser.
