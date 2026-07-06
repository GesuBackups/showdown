////
// makehtml/emoji.js
// Copyright (c) 2018 ShowdownJS
//
// Encode/escape certain characters inside Markdown code runs.
// The point is that in code, these characters are literals,
// and lose their special Markdown meanings.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.encodeCode', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.encodeCode.onStart', text, options, globals);
  text = startEvent.output;

  // Encode all ampersands; HTML entities are not
  // entities within a Markdown code span.
  text = text
    .replace(/&/g, '&amp;')
  // Do the angle bracket song and dance:
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // encode "
    .replace(/"/g, '&quot;')
  // Now, escape characters that are magic in Markdown:
    .replace(/([*_{}[\]\\=~-])/g, showdown.helper.escapeCharactersCallback);

  let afterEvent = showdown.Event.dispatchEnd('makehtml.encodeCode.onEnd', text, options, globals);
  return afterEvent.output;
});
