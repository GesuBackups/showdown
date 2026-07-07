/**
 * @file      helpers/gfmAutolinks.js
 * @summary   The shared GFM anchor machinery used by both the legacy (link.js) and CommonMark (cmInline.js) paths.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * `writeAnchorTag` (the `<a>` builder + `makehtml.link.<variant>.*` events), `parseMail`
 * (mailto address encoding), `trimUrlPunctuation` (the naked-URL trailing-punctuation/balanced-
 * paren trim loop) and `applyGhMentions` (the `@mention` pass). These were copied verbatim between
 * link.js and cmInline.js; the CommonMark path's one real divergence — it deliberately does NOT run
 * safeMode / cmNormalizeURL / the quote-angle attribute escape on the href (doing so would corrupt
 * the entity-encoded mailto emitted by encodeEmails) — is injected through the `urlPolicy` argument
 * rather than forked. Load-order safe: every cross-helper / subParser / Event reference happens
 * inside function bodies (call time).
 */

/**
 * The href post-processing a caller wants `writeAnchorTag` to apply. The legacy link.js path
 * enables all three; the cmInline GFM post-pass enables none of them. Each flag still respects
 * the relevant runtime option (`safeMode` also checks `options.safeMode`; `cmNormalize` also
 * checks `options.cmSpec`).
 */
showdown.helper.LEGACY_ANCHOR_URL_POLICY = {safeMode: true, cmNormalize: true, escapeAttr: true};
showdown.helper.CM_GFM_ANCHOR_URL_POLICY = {safeMode: false, cmNormalize: false, escapeAttr: false};

/**
 * Build an `<a>` anchor, resolving reference ids, applying the href post-processing selected by
 * `urlPolicy`, dispatching the `makehtml.link.<subEvtName>.onCapture`/`.onHash` events (so listener
 * extensions can rewrite the anchor) and hashing the result. Shared verbatim between link.js and
 * cmInline.js.
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
    linkId = options.cmSpec ? showdown.helper.cmNormalizeLabel(linkId) : showdown.helper.caseFold(linkId);
  } else {
    linkId = null;
  }
  emptyCase = !!emptyCase;

  if (emptyCase) {
    url = '';
  } else if (!url) {
    if (!linkId) {
      // lower-case and turn embedded newlines into spaces
      linkId = options.cmSpec ? showdown.helper.cmNormalizeLabel(text) : showdown.helper.caseFold(text).replace(/ ?\n/g, ' ');
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
    // Text can be a markdown element, so we run through the appropriate parsers
    text = showdown.subParser('makehtml.codeSpan')(text, options, globals);
    text = showdown.subParser('makehtml.emoji')(text, options, globals);
    text = showdown.subParser('makehtml.underline')(text, options, globals);
    text = showdown.subParser('makehtml.emphasisAndStrong')(text, options, globals);
    text = showdown.subParser('makehtml.strikethrough')(text, options, globals);
    text = showdown.subParser('makehtml.ellipsis')(text, options, globals);
    text = showdown.helper.hashHTMLSpans(text, options, globals);
    otp = '<a' + showdown.helper._populateAttributes(attributes) + '>' + text + '</a>';
  }

  let beforeHashEvent = showdown.Event.dispatchHash('makehtml.link.' + subEvtName + '.onHash', otp, options, globals);
  otp = beforeHashEvent.output;
  return showdown.helper.hashHTMLSpans(otp, options, globals);
};

/**
 * Encode a bare email address into `{mail, url}` (a `mailto:` href), applying the entity
 * obfuscation of `encodeEmails` when enabled. Shared verbatim between link.js and cmInline.js.
 * @param {string} mail
 * @param {{}} options
 * @returns {{mail: string, url: string}}
 */
showdown.helper.parseMail = function (mail, options) {
  let url = 'mailto:';
  mail = showdown.helper.unescapePlaceholders(mail);
  if (options.encodeEmails) {
    url = showdown.helper.encodeEmailAddress(url + mail);
    mail = showdown.helper.encodeEmailAddress(mail);
  } else {
    url = url + mail;
  }
  return {
    mail: mail,
    url: url
  };
};

/**
 * The naked-URL trailing-punctuation trim: walk the captured URL from the back, moving trailing
 * `_*~,;:.!?` and unbalanced `)`/`]` into a suffix that is emitted after the link. Returns the
 * trimmed url and the accumulated suffix. Shared verbatim between link.js and cmInline.js (the
 * GFM-specific trimming cmInline layers on top stays in cmInline).
 * @param {string} url
 * @returns {{url: string, suffix: string}}
 */
showdown.helper.trimUrlPunctuation = function (url) {
  const len = url.length;
  let suffix = '';

  for (let i = len - 1; i >= 0; --i) {
    let char = url.charAt(i);
    if (/[_*~,;:.!?]/.test(char)) {
      // it's a punctuation char so we remove it from the url
      url = url.slice(0, -1);
      // and prepend it to the suffix
      suffix = char + suffix;
    } else if (/[)\]]/.test(char)) {
      // it's a parenthesis so we need to check for "balance" (kinda)
      let opPar, clPar;
      if (/\)/.test(char)) {
        // it's a curved parenthesis
        opPar = url.match(/\(/g) || [];
        clPar = url.match(/\)/g);
      } else {
        // it's a squared parenthesis
        opPar = url.match(/\[/g) || [];
        clPar = url.match(/]/g);
      }
      if (opPar.length < clPar.length) {
        // there are more closing Parenthesis than opening so chop it!!!!!
        url = url.slice(0, -1);
        // and prepend it to the suffix
        suffix = char + suffix;
      } else {
        // it's (kinda) balanced so our work is done
        break;
      }
    } else {
      // it's not a punctuation or a parenthesis so our work is done
      break;
    }
  }
  return {url: url, suffix: suffix};
};

/**
 * The GFM `@mention` pass: link `@username` mentions via `options.ghMentionsLink`. Shared
 * verbatim between link.js and cmInline.js; the two paths differ only in the href `urlPolicy`
 * handed to writeAnchorTag.
 * @param {string} text
 * @param {{}} options
 * @param {{}} globals
 * @param {{safeMode: boolean, cmNormalize: boolean, escapeAttr: boolean}} urlPolicy
 * @returns {string}
 */
showdown.helper.applyGhMentions = function (text, options, globals, urlPolicy) {
  if (!options.ghMentions) {
    return text;
  }
  let ghMentionsRegex = /(^|\s)(\\)?(@([a-z\d]+(?:[a-z\d._-]+?[a-z\d]+)*))/gi;
  return text.replace(ghMentionsRegex, function (wholeMatch, st, escape, mentions, username) {
    // bail if the mentions was escaped
    if (escape === '\\') {
      return st + mentions;
    }
    // check if options.ghMentionsLink is a string
    // TODO Validation should be done at initialization not at runtime
    if (!showdown.helper.isString(options.ghMentionsLink)) {
      throw new Error('ghMentionsLink option must be a string');
    }
    let url = options.ghMentionsLink.replace(/\{u}/g, username);
    return st + showdown.helper.writeAnchorTag('reference', ghMentionsRegex, wholeMatch, mentions, null, url, undefined, undefined, options, globals, urlPolicy);
  });
};
