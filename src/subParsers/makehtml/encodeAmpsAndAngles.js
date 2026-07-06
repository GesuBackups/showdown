////
// makehtml/encodeAmpsAndAngles.js
// Copyright (c) 2018 ShowdownJS
//
// Smart processing for ampersands and angle brackets that need to be encoded.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeAmpsAndAngles = function (text) {
  'use strict';

  // Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
  // http://bumppo.net/projects/amputator/
  text = text.replace(/&(?!#?[xX]?(?:[\da-fA-F]+|\w+);)/g, '&amp;');

  // Encode naked <'s
  text = text.replace(/<(?![a-z/?$!])/gi, '&lt;');

  // Encode <
  text = text.replace(/</g, '&lt;');

  // Encode >
  text = text.replace(/>/g, '&gt;');

  // encode "
  text = text.replace(/"/g, '&quot;');

  return text;
};
