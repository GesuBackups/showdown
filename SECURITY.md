# Security Policy

## Supported Versions

Security fixes are addressed for the following versions of Showdown.

| Version | Supported                                       |
|---------|-------------------------------------------------|
| 3.x.x   | :white_check_mark:                              |
| 2.0.x   | :warning: only really nasty finds               |
| 1.x.x   | :x: (Known security issue with yargs dependency) |

Showdown targets the node.js versions targeted in the [node.js release schedule](https://nodejs.org/en/about/releases/). Our test suite follows this release schedule. Consequently, older versions of node may become unusable.

## Reporting a Vulnerability

Please report security vulnerabilities **privately** — do **not** open a public GitHub issue, as that
discloses the problem before a fix is available. Use GitHub's private vulnerability reporting for this
repository: **Security → Report a vulnerability**
(https://github.com/showdownjs/showdown/security/advisories/new). If that is unavailable, contact a
maintainer privately instead of filing a public issue.

We aim to acknowledge a report within a few business days and will coordinate a fix and a disclosure
timeline with the reporter before any public disclosure.

## Security model & hardening

Showdown converts Markdown to HTML under a **trusted-input** model: by design it passes raw HTML 
and arbitrary URL schemes through to the output, because Markdown relies on this for many features. 
**Showdown is not an HTML sanitizer.** If the Markdown you convert can come from untrusted users, 
you are responsible for sanitizing the output.

Recommended controls for untrusted input:

- **Enable `safeMode`** (`new showdown.Converter({ safeMode: true })`). It provides defense-in-depth by 
    - (1) blocking dangerous URL schemes (`javascript:`, `vbscript:`, `data:` except `data:image/*` for image `src`) in both generated **and raw** URL attributes — link/image `href`/`src`, and form actions such as `<input formaction>`, and 
    - (2) escaping a blacklist of dangerous raw HTML tags (`script`, `iframe`, `svg`, `style`, `form`, …) and stripping inline event-handler attributes (`onerror`, `onload`, …). 
    - It is a hardening layer, **not** a full sanitizer: it does not escape *every* raw tag, so keep combining it with the controls below.
- **Sanitize the output** with a dedicated library such as [DOMPurify](https://github.com/cure53/DOMPurify) before inserting it into the DOM.
- **Serve a Content-Security-Policy** (e.g. `script-src` without `unsafe-inline`) as a backstop.
- **Bound input size / use a timeout.** Converting very large adversarial inputs can be CPU-intensive; cap the size of untrusted Markdown and/or run conversion off the request thread with a time budget.
- Note that **`disallowRawHTML`** is only the narrow GFM tagfilter blacklist, not a general sanitizer.
- Extensions run with full trust (they can inject arbitrary HTML and compile arbitrary regexes). Only load extensions you trust.
- The `makeMarkdown` (HTML → Markdown) direction parses input into an **inert** document, so it does not execute scripts or fire `on*` handlers even in a browser.
