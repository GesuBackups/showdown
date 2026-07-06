////
// makehtml/blockGamut.js
// Copyright (c) 2018 ShowdownJS
//
// These are all the transformations that form block-level
// tags like paragraphs, headers, and list items.
//
// ***Author:***
// - Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
////

// Dispatcher (not a construct): it matches nothing itself, only routes text through the
// block-level subparsers, so it emits no events (the document-level makehtml.onStart /
// onPreParse / onEnd cover whole-text hooks).
showdown.subParser('makehtml.blockGamut', function (text, options, globals, skip) {
  'use strict';

  skip = skip || false;

  if (skip !== 'makehtml.heading.setext') {
    text = showdown.subParser('makehtml.heading.setext')(text, options, globals);
  }
  if (skip !== 'makehtml.heading.atx') {
    text = showdown.subParser('makehtml.heading.atx')(text, options, globals);
  }

  // Do Horizontal Rules:
  if (skip !== 'makehtml.horizontalRule') {
    text = showdown.subParser('makehtml.horizontalRule')(text, options, globals);
  }

  text = showdown.subParser('makehtml.list')(text, options, globals);
  // In CommonMark container mode the converter-level githubCodeBlock pass only claims
  // indent-0 fences; list items own their indented fences (renderItem already ran
  // githubCodeBlock on the de-indented content). This pass picks up genuinely top-level
  // indented (1-3) fences here, after the list parser has claimed item content and before
  // codeBlock could mistake their content lines for indented code.
  if (options.cmSpec) {
    text = showdown.subParser('makehtml.githubCodeBlock')(text, options, globals);
  }
  text = showdown.subParser('makehtml.codeBlock')(text, options, globals);
  text = showdown.subParser('makehtml.table')(text, options, globals);
  text = showdown.subParser('makehtml.blockquote')(text, options, globals);
  // The block quote container can reveal top-level content that the earlier codeBlock pass
  // never saw (e.g. an indented-code line that followed a `>` line and so was not yet at the
  // start of a block). Re-run codeBlock in container mode so that revealed indented code is
  // recognized instead of falling through to a paragraph.
  if (options.cmSpec) {
    text = showdown.subParser('makehtml.codeBlock')(text, options, globals);
  }

  // We already ran _HashHTMLBlocks() before, in Markdown(), but that
  // was to escape raw HTML in the original Markdown source. This time,
  // we're escaping the markup we've just created, so that we don't wrap
  // <p> tags around block-level tags.
  text = showdown.helper.hashHTMLBlocks(text, options, globals);

  return text;
});
