////
// makehtml/hashBlock.js
// Copyright (c) 2018 ShowdownJS
//
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Mechanism (not a construct): hash plumbing. Attached as a showdown.helper
// (no events) rather than registered as a subparser.
showdown.helper.hashBlock = function (text, options, globals) {
  'use strict';

  text = text.replace(/(^\n+|\n+$)/g, '');
  text = '\n\n¨K' + (globals.gHtmlBlocks.push(text) - 1) + 'K\n\n';

  return text;
};
