////
// makehtml/encodeAmpsAndAngles.js
// Copyright (c) 2018 ShowdownJS
//
// Smart processing for ampersands and angle brackets that need to be encoded.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.encodeAmpsAndAngles', function (text, options, globals) {
  'use strict';

  let startEvent = showdown.Event.dispatchStart('makehtml.encodeAmpsAndAngles.onStart', text, options, globals);
  text = startEvent.output;

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

  let afterEvent = showdown.Event.dispatchEnd('makehtml.encodeAmpsAndAngles.onEnd', text, options, globals);
  return afterEvent.output;
});
