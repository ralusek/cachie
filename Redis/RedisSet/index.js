'use strict';

const Promise = require('bluebird');
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
class RedisSet {
  constructor(config) {
    config = config || {};
    p(this).cache = config.cache; // Sets instance of cachie.
    p(this).client = config.client;
  }
  
  add(key, values, config) {
    config = config || {};
    return p(this).client.sadd(key, Array.from(values))
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

module.exports = RedisSet;
