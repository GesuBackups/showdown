/**
 * @file      helpers/hashBlock.js
 * @summary   Replaces a finished block of HTML with a `¨K…K` placeholder stored in `globals.gHtmlBlocks`.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Core hash plumbing so processed blocks aren't reparsed. A `showdown.helper.*` mechanism, not a
 * construct; emits no events.
 */

showdown.helper.hashBlock = function (text, options, globals) {
  'use strict';

  text = text.replace(/(^\n+|\n+$)/g, '');
  text = '\n\n¨K' + (globals.gHtmlBlocks.push(text) - 1) + 'K\n\n';

  return text;
};
