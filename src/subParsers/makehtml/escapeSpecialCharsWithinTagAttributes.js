////
// makehtml/escapeSpecialCharsWithinTagAttributes.js
// Copyright (c) 2018 ShowdownJS
//
// Within tags -- meaning between < and > -- encode [\ ` * _ ~ =] so they
// don't conflict with their use in Markdown for code, italics and strong.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Mechanism (not a construct): a character-level escaping pass. Attached as a
// showdown.helper (no events) rather than registered as a subparser.
showdown.helper.escapeSpecialCharsWithinTagAttributes = function (text, options) {
  'use strict';

  // In CommonMark raw-HTML mode this escaping is skipped: inline raw HTML is instead
  // recognized with the strict grammar and hashed in spanGamut (makehtml.hashCmRawHTML),
  // after backslash escapes and link/image destinations have been resolved. Escaping
  // `=`/`_`/etc. here would corrupt that later strict tag recognition.
  if (!options.cmSpec) {
    // Build a regex to find HTML tags.
    let tags     = /<\/?[a-z\d_:-]+(?:\s+[\s\S]+?)?>/gi,
        comments = /<!(--(([^>-]|-[^>])([^-]|-[^-])*)--)>/gi;

    text = text.replace(tags, function (wholeMatch) {
      return wholeMatch
        .replace(/(.)<\/?code>(?=.)/g, '$1`')
        .replace(/([\\`*_~=|])/g, showdown.helper.escapeCharactersCallback);
    });

    text = text.replace(comments, function (wholeMatch) {
      return wholeMatch
        .replace(/([\\`*_~=|])/g, showdown.helper.escapeCharactersCallback);
    });
  }

  return text;
};
