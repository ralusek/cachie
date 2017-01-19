'use strict';

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

    p(this).data = {};
  }
  
  connect() {
    return Promise.resolve();
  }
  
  set(key, value) {
    return Promise.resolve(p(this).data[key] = value);
  }
  
  get(key) {
    return Promise.resolve(p(this).data[key]);
  }
  
  add(key, value) {
    return this.get(key)
    .then(result => {
      result = result || new Set();
      result.add(value);
      this.set(key, result);
    });
  }
}

module.exports = InMemoryCache;
