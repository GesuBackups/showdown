/**
 * @file      helpers/types.js
 * @summary   Runtime type guards and iteration helper (`isString`, `isNumber`, `isArray`, `forEach`, …).
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * The `showdown.helper.*` type-checking primitives used throughout the codebase. Load-order safe:
 * files in src/helpers/ are concatenated alphabetically, so nothing here reads another helper's
 * state at load time — only inside function bodies (call time).
 */

/**
 * Check if var is string
 * @static
 * @param {*} a
 * @returns {boolean}
 */
showdown.helper.isString = function (a) {
  'use strict';
  return (typeof a === 'string' || a instanceof String);
};

/**
 * Check if var is a number
 * @static
 * @param {*} a
 * @returns {boolean}
 */
showdown.helper.isNumber = function (a) {
  return !isNaN(a);
};

/**
 * Check if var is a function
 * @static
 * @param {*} a
 * @returns {boolean}
 */
showdown.helper.isFunction = function (a) {
  'use strict';
  let getType = {};
  return a && getType.toString.call(a) === '[object Function]';
};

/**
 * isArray helper function
 * @static
 * @param {*} a
 * @returns {boolean}
 */
showdown.helper.isArray = function (a) {
  'use strict';
  let isArray;
  if (!Array.isArray) {
    isArray = function (arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    };
  } else {
    isArray = Array.isArray;
  }
  return isArray(a);
};

/**
 * Check if value is undefined
 * @static
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
 */
showdown.helper.isUndefined = function (value) {
  'use strict';
  return typeof value === 'undefined';
};

/**
 * Check if value is an object (excluding arrays)
 * @param {*} value
 * @returns {boolean}
 */
showdown.helper.isObject = function (value) {
  'use strict';
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value !== null
  );
};

/**
 * ForEach helper function
 * Iterates over Arrays and Objects (own properties only)
 * @static
 * @param {*} obj
 * @param {function} callback Accepts 3 params: 1. value, 2. key, 3. the original array/object
 */
showdown.helper.forEach = function (obj, callback) {
  'use strict';
  // check if obj is defined
  if (showdown.helper.isUndefined(obj)) {
    throw new Error('obj param is required');
  }

  if (showdown.helper.isUndefined(callback)) {
    throw new Error('callback param is required');
  }

  if (!showdown.helper.isFunction(callback)) {
    throw new Error('callback param must be a function/closure');
  }

  if (typeof obj.forEach === 'function') {
    obj.forEach(callback);
  } else if (showdown.helper.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      callback(obj[i], i, obj);
    }
  } else if (typeof (obj) === 'object') {
    for (let prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        callback(obj[prop], prop, obj);
      }
    }
  } else {
    throw new Error('obj does not seem to be an array or an iterable object');
  }
};
