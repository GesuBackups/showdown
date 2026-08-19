/**
 * @file      makehtml/completeHTMLDocument.js
 * @summary   Wraps the converted HTML in a full document when `completeHTMLDocument` is enabled.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Gated behind the option; pulls title/charset/lang/meta from parsed document metadata
 * (`globals.metadata.parsed`) to build the `<head>`, then wraps the body in
 * `<!DOCTYPE>`/`<html>`/`<head>`/`<body>`. A lifecycle-only construct: emits `onStart`/`onEnd` with
 * no per-match capture.
 */
// noinspection HtmlRequiredLangAttribute


showdown.subParser('makehtml.completeHTMLDocument', function (text, options, globals) {
  'use strict';

  if (!options.completeHTMLDocument) {
    return text;
  }

  let startEvent = showdown.Event.dispatchStart('makehtml.completeHTMLDocument.onStart', text, options, globals);
  text = startEvent.output;

  let doctype = 'html',
      doctypeParsed = '<!DOCTYPE HTML>\n',
      title = '',
      charset = '<meta charset="utf-8">\n',
      lang = '',
      metadata = '';

  if (typeof globals.metadata.parsed.doctype !== 'undefined') {
    doctypeParsed = '<!DOCTYPE ' +  globals.metadata.parsed.doctype + '>\n';
    doctype = globals.metadata.parsed.doctype.toString().toLowerCase();
    if (doctype === 'html' || doctype === 'html5') {
      charset = '<meta charset="utf-8">';
    }
  }

  for (let meta in globals.metadata.parsed) {
    if (Object.prototype.hasOwnProperty.call(globals.metadata.parsed, meta)) {
      switch (meta.toLowerCase()) {
        case 'doctype':
          break;

        case 'title':
          title = '<title>' +  globals.metadata.parsed.title + '</title>\n';
          break;

        case 'charset':
          if (doctype === 'html' || doctype === 'html5') {
            charset = '<meta charset="' + globals.metadata.parsed.charset + '">\n';
          } else {
            charset = '<meta name="charset" content="' + globals.metadata.parsed.charset + '">\n';
          }
          break;

        case 'language':
        case 'lang':
          lang = ' lang="' + globals.metadata.parsed[meta] + '"';
          metadata += '<meta name="' + meta + '" content="' + globals.metadata.parsed[meta] + '">\n';
          break;

        default:
          metadata += '<meta name="' + meta + '" content="' + globals.metadata.parsed[meta] + '">\n';
      }
    }
  }

  text = doctypeParsed + '<html' + lang + '>\n<head>\n' + title + charset + metadata + '</head>\n<body>\n' + text.trim() + '\n</body>\n</html>';

  let afterEvent = showdown.Event.dispatchEnd('makehtml.completeHTMLDocument.onEnd', text, options, globals);
  return afterEvent.output;
});
