'use strict';

const Promise = require('bluebird');
const errors = require('../errors');
const cachieErrors = require('../../errors');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 *
 */
class RedisString {
  constructor(config) {
    config = config || {};
    p(this).cache = config.cache; // Sets instance of cachie.
    p(this).client = config.client;
  }

  get(key, config) {
    config = config || {};

    return p(this).client.get(key)
    .catch(err => errors.handle({err, key}));
  }
  
  set(key, value, config) {
    config = config || {};
    let args = [key, value];
    // Add expiration in MS.
    if (config.expiresIn) args = args.concat(['PX', config.expiresIn]);

    // Handle conditionals.
    if (config.onlyIfExists) args.push('XX');
    else if (config.onlyIfNotExists) args.push('NX');

    const redis = p(this).client;
    return Promise.resolve(redis.set.apply(redis, args))
    .then(response => {
      if (response === 'OK') {
        if (config.returning) return p(this).cache.string.get(key);
        return true;
      }
      return Promise.reject(new Error(cachieErrors.SET({key, value})));
    })
    .catch(err => {
      const meta = {err, key, value};
      if (config.force) {
        // If wrong type and forced, deletes old key and adds new value as a set.
        if (errors.ERRORS.WRONG_TYPE.TEST(meta)) {
          return p(this).cache.delete(key)
          .then(() => p(this).cache.set.add(key, value, config));
        }
      }
      return errors.handle(meta);
    });
  }
}

module.exports = RedisString;
