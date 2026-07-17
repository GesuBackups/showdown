/**
 * @file      makehtml/taskListItem.js
 * @summary   Renders a GFM task-list marker (`[ ]`/`[x]`) as a disabled `<input type="checkbox">`, shared by both list parsers.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Given a raw list-item line, matches the leading marker and renders the checkbox, leaving the label
 * text for the caller to parse; gated by `tasklists`. Because `makehtml.list` (one engine for
 * every flavor) delegates here, a single listener covers task lists in every flavor. Emits lifecycle
 * `onStart`/`onEnd` plus `makehtml.list.taskListItem.checkbox.onCapture`/`onHash` — where `input`
 * and `_wholeMatch` are the full source line and `attributes` are the checkbox attributes.
 */


showdown.subParser('makehtml.list.taskListItem.checkbox', function (text, options, globals) {
  'use strict';

  if (!options.tasklists) {
    return text;
  }

  // Registered subparser ⇒ it emits the lifecycle events (onStart/onEnd) in addition to the
  // per-checkbox onCapture/onHash below.
  let startEvent = showdown.Event.dispatchStart('makehtml.list.taskListItem.checkbox.onStart', text, options, globals);
  text = startEvent.output;

  // Match the marker and the remainder of its (first) line. The text is captured so
  // the events expose the full line, not just the checkbox; everything after the line
  // is left untouched for the caller's block/span parsing.
  //
  // Per GFM the marker must be followed by at least one space/tab to be a task: a bare
  // `[ ]` (nothing after) or `[ ]x` (no whitespace) is left literal, matching cmark-gfm.
  const taskItemRgx = /^([ \t]*)\[([xX ])](?=[ \t])([^\n]*)/;
  text = text.replace(taskItemRgx, function (wm, prefix, checkedRaw, lineText) {
    let checked = checkedRaw.trim() !== '';

    // GFM spec output is a bare `<input disabled type="checkbox">` (checked items add a
    // leading `checked`). Only when `moreStyling` is enabled do we keep the legacy inline
    // style that visually aligns the checkbox.
    let attributes = options.moreStyling ?
      {
        type: 'checkbox',
        disabled: true,
        style: 'margin: 0px 0.35em 0.25em -1.6em; vertical-align: middle;',
        checked: checked
      } :
      (checked ?
        { checked: true, disabled: true, type: 'checkbox' } :
        { disabled: true, type: 'checkbox' });

    // the task line's text (everything after the checkbox) is the main captured content
    // (`text`, mutable + honored below); the checkbox markers are read-only context.
    let captureStartEvent = showdown.Event.dispatchCapture('makehtml.list.taskListItem.checkbox.onCapture', wm, {
      regexp: taskItemRgx,
      matches: {
        _wholeMatch: wm,
        _taskListButton: prefix + '[' + checkedRaw + ']',
        _taskListButtonChecked: checkedRaw,
        text: lineText
      },
      attributes: attributes
    }, options, globals);

    let otp;
    if (captureStartEvent.output && captureStartEvent.output !== '') {
      otp = captureStartEvent.output;
    } else {
      attributes = captureStartEvent.attributes;
      let txt = captureStartEvent.matches.text;
      otp = prefix + '<input' + showdown.helper._populateAttributes(attributes) + '>' + txt;
    }

    let beforeHashEvent = showdown.Event.dispatchHash('makehtml.list.taskListItem.checkbox.onHash', otp, options, globals);
    return beforeHashEvent.output;
  });

  let afterEvent = showdown.Event.dispatchEnd('makehtml.list.taskListItem.checkbox.onEnd', text, options, globals);
  return afterEvent.output;
});
