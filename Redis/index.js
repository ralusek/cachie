'use strict';

const Promise = require('bluebird');
const connect = require('./connect').connect;

const RedisSet = require('./RedisSet');
const RedisString = require('./RedisString');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}



/**
 *
 */
class RedisCache {
  constructor(config) {
    config = config || {};
    p(this).cache = config.cache;
  }
  
  connect(config) {
    config = config || {};
    return Promise.resolve(config.cacheClient || connect(config))
    .tap(client => {
      p(this).client = client;
      // Methods for handling lists.
      // this.list = new RedisList();

      // Methods for handling strings.
      this.string = new RedisString({client, cache: p(this).cache});

      // Methods for handling sets.
      this.set = new RedisSet({client, cache: p(this).cache});
    });
  }

  delete(key, config) {
    return p(this).client.del(key);
  }
}

module.exports = RedisCache;
