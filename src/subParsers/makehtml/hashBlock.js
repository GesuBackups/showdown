////
// makehtml/hashBlock.js
// Copyright (c) 2018 ShowdownJS
//
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////


showdown.subParser('makehtml.hashBlock', function (text, options, globals) {
  'use strict';
  let startEvent = showdown.Event.dispatchStart('makehtml.hashBlock.onStart', text, options, globals);
  text = startEvent.output;

  text = text.replace(/(^\n+|\n+$)/g, '');
  text = '\n\n¨K' + (globals.gHtmlBlocks.push(text) - 1) + 'K\n\n';

  let afterEvent = showdown.Event.dispatchEnd('makehtml.hashBlock.onEnd', text, options, globals);
  return afterEvent.output;
});
