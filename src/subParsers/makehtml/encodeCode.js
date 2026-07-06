////
// makehtml/encodeCode.js
// Copyright (c) 2018 ShowdownJS
//
// Encode/escape certain characters inside Markdown code runs.
// The point is that in code, these characters are literals,
// and lose their special Markdown meanings.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeCode = function (text) {
  'use strict';

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

  return text;
};
