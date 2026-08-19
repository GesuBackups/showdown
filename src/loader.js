// noinspection JSUnresolvedReference

/**
 * @file      loader.js
 * @summary   The UMD/CommonJS export epilogue that publishes the `showdown` object.
 * @author    Estêvão Soares dos Santos (Tivie) <https://github.com/tivie>
 * @copyright 2018-2026 ShowdownJS
 * @license   MIT
 *
 * Detects the module environment and exports `showdown` via AMD `define`, CommonJS `module.exports`
 * or a browser global. Concatenated last and omitted from the ESM build and the test virtual
 * module. No conversion logic, no events.
 */

let root = this || globalThis;

// AMD Loader
if (typeof define === 'function' && define.amd) {
  define(function () {
    'use strict';
    return showdown;
  });

// CommonJS/nodeJS Loader
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = showdown;

// Regular Browser loader
} else {
  root.showdown = showdown;
}
