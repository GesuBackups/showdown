/**
 * Swap back in all the special characters we've hidden.
 */
showdown.subParser('makehtml.unescapeSpecialChars', function (text, options, globals) {
  'use strict';
  let startEvent = showdown.Event.dispatchStart('makehtml.unescapeSpecialChars.onStart', text, options, globals);
  text = startEvent.output;

  text = showdown.helper.unescapePlaceholders(text);

  let afterEvent = showdown.Event.dispatchEnd('makehtml.unescapeSpecialChars.onEnd', text, options, globals);
  return afterEvent.output;
});
