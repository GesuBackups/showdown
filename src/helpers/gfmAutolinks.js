/**
 * @file      helpers/gfmAutolinks.js
 * @summary   The shared GFM anchor machinery used by the inline anchor constructs that route through it (nakedUrl/ghMentions).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `writeAnchorTag` (the `<a>` builder + `makehtml.link.<variant>.*` events), the `validAutolinkHost`
 * GFM host validator and the two `*_ANCHOR_URL_POLICY` href-policy constants. The real callers of
 * `writeAnchorTag` are nakedUrl.js and ghMentions.js — link.js and autolink.js build their `<a>`
 * directly via `_populateAttributes`/`_hashHTMLSpan` and do NOT route through here; `validAutolinkHost`
 * is shared by autolink.js and nakedUrl.js. The one real divergence — the CM/GFM href policy
 * deliberately does NOT run safeMode / cmNormalizeURL / the quote-angle attribute escape on the href
 * (doing so would corrupt the entity-encoded mailto emitted by encodeEmails) — is injected through the
 * `urlPolicy` argument rather than forked. Load-order safe: every cross-helper / subParser / Event
 * reference happens inside function bodies (call time).
 */

/**
 * The href post-processing a caller wants `writeAnchorTag` to apply. The legacy anchor policy
 * enables all three; the CM/GFM policy (cmSpec, and the GFM naked-URL/mention overlay) enables none
 * of them. Each flag still respects the relevant runtime option (`safeMode` also checks
 * `options.safeMode`; `cmNormalize` also checks `options.cmSpec`).
 */
showdown.helper.LEGACY_ANCHOR_URL_POLICY = {safeMode: true, cmNormalize: true, escapeAttr: true};
showdown.helper.CM_GFM_ANCHOR_URL_POLICY = {safeMode: false, cmNormalize: false, escapeAttr: false};

/**
 * Build an `<a>` anchor, resolving reference ids, applying the href post-processing selected by
 * `urlPolicy`, dispatching the `makehtml.link.<subEvtName>.onCapture`/`.onHash` events (so listener
 * extensions can rewrite the anchor) and hashing the result. Shared by the inline anchor constructs
 * that route through it (nakedUrl.js, ghMentions.js).
 * @param {string} subEvtName link variant (`inline`/`reference`/`angleBrackets`/`autoLink`)
 * @param {RegExp} pattern the matching regex (event metadata)
 * @param {string} wholeMatch
 * @param {string} text the link text
 * @param {string|null} [linkId]
 * @param {string|null} [url]
 * @param {string|null} [title]
 * @param {boolean} [emptyCase]
 * @param {{}} options
 * @param {{}} globals
 * @param {{safeMode: boolean, cmNormalize: boolean, escapeAttr: boolean}} urlPolicy
 * @returns {string}
 */
showdown.helper.writeAnchorTag = function (subEvtName, pattern, wholeMatch, text, linkId, url, title, emptyCase, options, globals, urlPolicy) {

  let matches = {
        _wholeMatch: wholeMatch,
        _linkId: linkId,
        _url: url,
        _title: title,
        text: text
      },
      otp,
      attributes = {};

  title = title || null;
  url = url || null;
  if (linkId) {
    // one label normalization for all flavors: definitions are stored under
    // cmNormalizeLabel (see stripLinkDefinitions), so uses must fold identically
    linkId = showdown.helper.cmNormalizeLabel(linkId);
  } else {
    linkId = null;
  }
  emptyCase = !!emptyCase;

  if (emptyCase) {
    url = '';
  } else if (!url) {
    if (!linkId) {
      // shortcut/collapsed reference: fold the link text as the label
      linkId = showdown.helper.cmNormalizeLabel(text);
    }
    if (!showdown.helper.isUndefined(globals.gUrls[linkId])) {
      url = globals.gUrls[linkId];
      if (!showdown.helper.isUndefined(globals.gTitles[linkId])) {
        title = globals.gTitles[linkId];
      }
    } else {
      return wholeMatch;
    }
  }

  url = showdown.helper.applyBaseUrl(options.relativePathBaseUrl, url);
  // safeMode: neutralize dangerous URL schemes (javascript:, vbscript:, data:, ...)
  if (urlPolicy.safeMode && options.safeMode && !showdown.helper.isSafeUrl(url)) {
    url = '';
  }
  // cmSpec flavors percent-encode the destination. The CommonMark GFM post-pass skips this
  // (urlPolicy.cmNormalize === false): cmNormalizeURL would decode the entity-encoded mailto:
  // href produced by encodeEmails, making the href/text inconsistent, so skipping it keeps the
  // output identical to the legacy (non-cmSpec) path.
  if (urlPolicy.cmNormalize && options.cmSpec) {
    url = showdown.helper.cmNormalizeURL(url);
  }
  url = url.replace(showdown.helper.regexes.asteriskDashTildeAndColon, showdown.helper.escapeCharactersCallback);
  // escape characters that would otherwise break out of the quoted href attribute
  // (a `"` in the destination is an attribute-injection vector). cmSpec flavors already
  // percent-encode the URL above, so this is a no-op there.
  if (urlPolicy.escapeAttr) {
    url = url
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  attributes.href = url;

  if (title && showdown.helper.isString(title)) {
    if (options.cmSpec) {
      title = showdown.helper.cmEscapeTitle(title);
    } else {
      title = title
        .replace(/"/g, '&quot;');
    }
    title = title.replace(showdown.helper.regexes.asteriskDashTildeAndColon, showdown.helper.escapeCharactersCallback);
    attributes.title = title;
  }

  let captureStartEvent = showdown.Event.dispatchCapture('makehtml.link.' + subEvtName + '.onCapture', wholeMatch, {
    regexp: pattern,
    matches: matches,
    attributes: attributes
  }, options, globals);

  // if something was passed as output, it takes precedence
  // and will be used as output
  if (captureStartEvent.output && captureStartEvent.output !== '') {
    otp = captureStartEvent.output;
  } else {
    attributes = captureStartEvent.attributes;
    text = captureStartEvent.matches.text || '';
    // The only real callers pass plain anchor text — a ghMentions `@user` handle or the
    // pre-escaped naked-URL / mail address — which never contains inline markdown, so there
    // is nothing to re-parse here. The final hashHTMLSpans below protects the built anchor.
    otp = '<a' + showdown.helper._populateAttributes(attributes) + '>' + text + '</a>';
  }

  let beforeHashEvent = showdown.Event.dispatchHash('makehtml.link.' + subEvtName + '.onHash', otp, options, globals);
  otp = beforeHashEvent.output;
  return showdown.helper.hashHTMLSpans(otp, options, globals);
};

/**
 * GFM extended www autolink host validation: the host must have at least two labels and the last
 * two must not contain `_`. Explicit-scheme (http/https/ftp) urls are not domain-validated. Shared
 * (≥2 call sites → helper per the project's rule) by the autolink construct (the `<www...>` arm)
 * and the simplifiedAutoLink naked-URL post-pass.
 * @param {string} url
 * @param {boolean} isWww
 * @returns {boolean}
 */
showdown.helper.validAutolinkHost = function (url, isWww) {
  if (!isWww) { return true; }
  let host = url.split(/[/?#]/)[0],
      labels = host.split('.');
  if (labels.length < 2) { return false; }
  return !/_/.test(labels.slice(-2).join('.'));
};
