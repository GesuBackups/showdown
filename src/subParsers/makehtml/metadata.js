/**
 * Parse metadata at the top of the document
 */
showdown.subParser('makehtml.metadata', function (text, options, globals) {
  'use strict';

  if (!options.metadata) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.metadata.onStart', text, options, globals);
  text = startEvent.output;

  /**
   * @param {RegExp} pattern
   * @param {string} wholeMatch
   * @param {string} format
   * @param {string} content
   * @returns {string}
   */
  function parseMetadataContents (pattern, wholeMatch, format, content) {
    let otp;
    // the metadata block's body is the main captured content (`text`); the format tag
    // (`yaml`, `toml`, …) is a descriptive extra.
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.metadata.onCapture', content, {
      regexp: pattern,
      matches: {
        _wholeMatch: wholeMatch,
        format: format,
        text: content
      },
      attributes: {}
    }, options, globals);

    format = captureStartEvent.matches.format;
    content = captureStartEvent.matches.text;

    // if something was passed as output, it will be used as output
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      otp = '¨M';
    }

    // raw is raw so it's not changed in any way
    globals.metadata.raw = content;
    globals.metadata.format = format;

    // escape chars significant in html element and attribute contexts so metadata
    // values/keys can't break out of <title>, <meta ...> or the doctype when
    // completeHTMLDocument concatenates them into the document head
    // restore dollar signs and tremas, then collapse the indent that yaml wrapping adds
    content = showdown.helper.restoreDollarsAndTremas(showdown.helper.escapeHTMLEntities(content))
      .replace(/\n {4}/g, ' ');

    content.replace(/^([\S ]+): +([\s\S]+?)$/gm, function (wm, key, value) {
      globals.metadata.parsed[key] = value;
      return '';
    });
    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.metadata.onHash', otp, options, globals);
    otp = beforeHashEvent.output;
    if (!otp) {
      otp = '¨M';
    }
    return otp;
  }

  // 1. Metadata with «««»»» delimiters
  const rgx1 = /^\s*«««+\s*(\S*?)\n([\s\S]+?)\n»»»+\s*\n/;
  text = text.replace(rgx1, function (wholeMatch, format, content) {
    return parseMetadataContents(rgx1, wholeMatch, format, content);
  });

  // 2. Metadata with YAML delimiters
  const rgx2 = /^\s*---+\s*(\S*?)\n([\s\S]+?)\n---+\s*\n/;
  text = text.replace(rgx2, function (wholeMatch, format, content) {
    return parseMetadataContents(rgx2, wholeMatch, format, content);
  });
  text = text.replace(/¨M/g, '');
  let afterEvent = showdown.Event.dispatchEnd('makehtml.metadata.onEnd', text, options, globals);
  return afterEvent.output;
});
