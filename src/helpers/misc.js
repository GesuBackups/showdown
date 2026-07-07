/**
 * @file      helpers/misc.js
 * @summary   Environment polyfills and assorted showdown helpers that do not belong to a themed group.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The `console`/`Math.imul` polyfills, `stdExtName`, `cloneObject`, `_populateAttributes`, `_hashHTMLSpan`, `applyFlavor` and `validateOptions`. Load-order safe: the polyfills are self-contained and every helper reference happens inside function bodies (call time).
 */

/**
 * POLYFILLS
 */
// use this instead of builtin is undefined for IE8 compatibility
if (typeof (console) === 'undefined') {
  // eslint-disable-next-line no-global-assign -- deliberate polyfill for environments without console
  console = {
    warn: function (msg) {
      'use strict';
      alert(msg);
    },
    log: function (msg) {
      'use strict';
      alert(msg);
    },
    error: function (msg) {
      'use strict';
      throw msg;
    }
  };
}

// Math.imul() polyfill
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
if (!Math.imul) {
  Math.imul = function (opA, opB) {
    opB |= 0; // ensure that opB is an integer. opA will automatically be coerced.
    // floating points give us 53 bits of precision to work with plus 1 sign bit
    // automatically handled for our convienence:
    // 1. 0x003fffff /*opA & 0x000fffff*/ * 0x7fffffff /*opB*/ = 0x1fffff7fc00001
    //    0x1fffff7fc00001 < Number.MAX_SAFE_INTEGER /*0x1fffffffffffff*/
    let result = (opA & 0x003fffff) * opB;
    // 2. We can remove an integer coersion from the statement above because:
    //    0x1fffff7fc00001 + 0xffc00000 = 0x1fffffff800001
    //    0x1fffffff800001 < Number.MAX_SAFE_INTEGER /*0x1fffffffffffff*/
    if (opA & 0xffc00000 /*!== 0*/) {
      result += (opA & 0xffc00000) * opB | 0;
    }
    return result | 0;
  };
}

/**
 * Standardize extension name
 * @static
 * @param {string} s extension name
 * @returns {string}
 */
showdown.helper.stdExtName = function (s) {
  'use strict';
  return s.replace(/[_?*+/\\.^-]/g, '').replace(/\s/g, '').toLowerCase();
};

/**
 * Clones an object . If the second parameter is true, it deep clones the object.
 * Note: It should not be used in other contexts than showdown, since this algorithm might fail for
 * cyclic references, and dataypes such as Dates, RegExps, Typed Arrays, etc...
 * @param {{}} obj Object to clone
 * @param {boolean} [deep] [optional] If it should deep clone the object. Default is false
 */
showdown.helper.cloneObject = function (obj, deep) {
  deep = !!deep;
  if (obj === null || typeof (obj) !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj);
  }

  if (!deep) {
    let newObj = {};
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = obj[key];
      }
    }
    return newObj;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  } else {
    // note: This is not a real deep clone, and might work in weird ways if used in a dif
    //this is costly and should be used sparsly
    return JSON.parse(JSON.stringify(obj));
  }
};

/**
 * Populate attributes in output text
 * @param {{}} attributes
 * @returns {string}
 */
showdown.helper._populateAttributes = function (attributes) {
  let text = '';
  if (!attributes || !showdown.helper.isObject(attributes)) {
    return text;
  }

  for (let attr in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
      let key = attr,
          val;

      // since class is a javascript reserved word we use classes
      if (attr === 'classes') {
        key = 'class';
      }
      if (attributes[attr] === null || showdown.helper.isUndefined(attributes[attr])) {
        val = null;
      } else if (showdown.helper.isArray(attributes[attr])) {
        val = attributes[attr].join(' ');
        if (val === '') {
          val = null;
        }
      } else if (showdown.helper.isString(attributes[attr])) {
        val = attributes[attr];
      } else if (showdown.helper.isNumber(attributes[attr])) {
        val = String(attributes[attr]);
      } else {
        throw new TypeError('Attribute "' + attr + '" must be either an array or string but ' + typeof attributes[attr] + ' given');
      }
      // special attributes
      switch (attr) {
        // these attributes don't expect a value. If they are false, they should be removed. If they are true,
        // they should be present but without any value
        case 'checked':
        case 'disabled':
          if (val === true || val === 'true' || val === attr) {
            text += ' ' + key;
          }
          // if falsy, they are just ignored
          break;

        // default behavior for all other attributes types
        default:
          // Encode any literal double-quote so an attribute value cannot break out of
          // the quoted attribute. Core callers already pre-escape their values (so this
          // is a no-op for them); this closes the hole for values injected via an
          // extension/listener through the setAttributes() event API.
          text += (val === null) ? '' : ' ' + key + '="' + String(val).replace(/"/g, '&quot;') + '"';
          break;
      }
    }
  }

  return text;
};

showdown.helper._hashHTMLSpan = function (html, globals) {
  return '¨C' + (globals.gHtmlSpans.push(html) - 1) + 'C';
};

/**
 * Merge a flavor preset's option overrides into a target options object. Shared by
 * showdown.setFlavor (global) and Converter#setFlavor (instance).
 * @param {{}} preset
 * @param {{}} target
 */
showdown.helper.applyFlavor = function (preset, target) {
  for (let option in preset) {
    if (Object.prototype.hasOwnProperty.call(preset, option)) {
      target[option] = preset[option];
    }
  }
};

/**
 * Validate options
 * @param {{}} options
 * @returns {{}}
 */
showdown.helper.validateOptions = function (options) {
  if (!showdown.helper.isObject(options)) {
    throw new TypeError('Options must be an object, but ' + typeof options + ' given');
  }

  let defaultOptions = getDefaultOpts(false);

  for (let opt in defaultOptions) {
    if (!Object.prototype.hasOwnProperty.call(defaultOptions, opt)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(options, opt)) {
      options[opt] = defaultOptions[opt].defaultValue;
    }

    switch (opt) {
      case 'headerIds':
        // accepts `false` (or any boolean) or a plain object {prefix, raw}
        if (typeof options[opt] !== 'boolean' && !showdown.helper.isObject(options[opt])) {
          throw new TypeError('Option headerIds must be `false` or an object but ' + typeof options[opt] + ' given');
        }
        break;
      default:
        if (typeof options[opt] !== defaultOptions[opt].type) {
          throw new TypeError('Option ' + opt + ' must be of type ' + defaultOptions[opt].type + ' but ' + typeof options[opt] + ' given');
        }
    }
  }
  //options.headerLevelStart = (isNaN(parseInt(options.headerLevelStart))) ? 1 : parseInt(options.headerLevelStart);
  return options;
};
