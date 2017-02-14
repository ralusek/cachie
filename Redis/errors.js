'use strict';

const Promise = require('bluebird');
const _get = require('lodash.get');
const cachieErrors = require('../errors');

const ERRORS = Object.freeze({
  WRONG_TYPE: Object.freeze({
    TEST: (meta) => _get(meta, 'err.message') === 'WRONGTYPE Operation against a key holding the wrong kind of value',
    MAP: (meta) => cachieErrors.WRONG_TYPE(meta)
  })
});

module.exports.ERRORS = ERRORS;

module.exports.handle = (errorMeta) => {
  for (let prop in ERRORS) {
    if (ERRORS[prop].TEST(errorMeta)) return Promise.reject(new Error(ERRORS[prop].MAP(errorMeta)));
  }
  return Promise.reject(errorMeta.err);
};
