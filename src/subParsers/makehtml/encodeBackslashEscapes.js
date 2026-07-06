////
// makehtml/encodeBackslashEscapes.js
// Copyright (c) 2018 ShowdownJS
//
// Returns the string, with after processing the following backslash escape sequences.
//
// The polite way to do this is with the new escapeCharacters() function:
//
// text = escapeCharacters(text,"\\",true);
// text = escapeCharacters(text,"`*_{}[]()>#+-.!",true);
//
// ...but we're sidestepping its use of the (slow) RegExp constructor
// as an optimization for Firefox.  This function gets called a LOT.
//
// ***Author:***
// - attacklab
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Mechanism (not a construct): a character-level encoding pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.encodeBackslashEscapes = function (text) {
  'use strict';

  text = text
    .replace(/\\(\\)/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\([!#%'()*+,\-./:;=?@[\]\\^_`{|}~])/g, showdown.helper.escapeCharactersCallback)
    .replace(/\\¨D/g, '¨D') // escape $ (which was already escaped as ¨D) (charcode is 36)
    .replace(/\\&/g, '&amp;') // escape &
    .replace(/\\"/g, '&quot;') // escaping "
    .replace(/\\</g, '&lt;') // escaping <
    .replace(/\\>/g, '&gt;'); // escaping >

  return text;
};
