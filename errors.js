'use strict';

const _get = require('lodash.get');

module.exports = Object.freeze({
  SET: (meta) => `Unable to set value ${_get(meta, 'key')}: ${_get(meta, 'value')}.`,

  WRONG_TYPE: (meta) => `Key: ${_get(meta, 'key')} already holds a value that is of a different type.`
});
