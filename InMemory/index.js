'use strict';

const Promise = require('bluebird');
const _isSet = require('hodash.is-set');

const errors = require('../errors');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 *
 */
class InMemoryCache {
  constructor(config) {
    config = config || {};
    p(this).cache = config.cache;

    p(this).data = {};

    this.set = Object.freeze({
      add: (key, values, config) => {
        let result = p(this).data[key];
        if (result && !_isSet(result)) {
          if (config.force) {
            return p(this).cache.delete(key)
            .then(() => p(this).cache.string.set(key, values, config));
          }
          return Promise.reject(new Error(errors.WRONG_TYPE({key})));
        }
        result = result || new Set();
        let newCount = 0;
        values.forEach(value => {
          if (!result.has(value)) {
            newCount++;
            result.add(value);
          }
        });
        return Promise.resolve(newCount);
      }
    });

    this.string = Object.freeze({
      get: (key) => {
        return Promise.resolve(p(this).data[key])
        .then(enforceNull);
      },
      set: (key, value, config) => {
        const self = this;

        const get = () => p(this).cache.string.get(key);

        // Handle conditionals.
        if (config.onlyIfExists ||
            config.onlyIfNotExists) {

          let prep = Promise.resolve();

          if (config.onlyIfExists) {
            prep = prep.then(() => get(key)).then(value => value !== null);
          }
          else if (config.onlyIfNotExists) {
            prep = prep.then(() => get(key)).then(value => enforceNull(value) === null);
          }

          return prep
          .then(result => result === false ? false : set());
        }

        // No conditionals.
        return set();

        function set() {
          return Promise.resolve(p(self).data[key] = value)
          .then(result => {
            return config.returning ? get(key) : enforceNull(result) !== null;
          });
        }
      }
    });
  }
  
  connect() {
    return Promise.resolve();
  }
}


/**
 * Turn undefined values null to enforce Redis interface.
 */
function enforceNull(value) {
  if (value !== undefined && value !== null) return value;
  return null;
}

module.exports = InMemoryCache;
