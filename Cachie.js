'use strict';

const Promise = require('bluebird');


// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}

const TYPE = Object.freeze({
  IN_MEMORY: 'inMemory',
  REDIS: 'redis'
});

const TYPES = new Set();
Object.keys(TYPE).forEach(key => TYPES.add(TYPE[key]));



/**
 *
 */
class Cachie {
  /**
   *
   */
  constructor(config) {
    config = config || {};
    if (!TYPES.has(config.type)) throw new Error(`${config.type} not valid cache type. Must be one of: [${Array.from(TYPES).join(', ')}]`);
    p(this).type = config.type;

    if (config.collection) {
      p(this).collection = Array.isArray(config.collection) ? config.collection : [config.collection];
    }

    p(this).keyDelimiter = config.keyDelimiter || ' > ';
    
    p(this).cache = new (({
      [TYPE.IN_MEMORY]: require('./InMemory')
    })[p(this).type])(config);

    p(this).connected = false;
    p(this).awaitingConnection = new Set();
  }

  /**
   *
   */
  connect(config) {
    return p(this).cache.connect(config)
    .tap((response) => {
      p(this).connected = true;
      p(this).awaitingConnection.forEach(deferred => deferred.resolve(response));
    })
    .catch(err => {
      p(this).awaitingConnection.forEach(deferred => deferred.reject(err));
      return Promise.reject(err);
    })
    .finally(() => p(this).awaitingConnection.clear());
  }

  /**
   *
   */
  awaitConnection() {
    if (p(this).connected) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      p(this).awaitingConnection.add({resolve, reject});
    });
  }

  /**
   *
   */
  childCollection(config) {
    config = config || {};
    if (!config.collection) throw new Error('Must specify a collection to create child collection.');
    let collection = p(this).collection || [];
    config.collection = collection.concat(Array.isArray(config.collection) ? config.collection : [config.collection]);
    config.keyDelimiter = p(this).keyDelimiter;
    return new Cachie(config);
  }

  /**
   *
   */
  constructKey(key) {
    return (p(this).collection || []).concat(key).join(p(this).keyDelimiter);
  }
  
  /**
   *
   */
  set(key, value, config) {
    return this.awaitConnection()
    .then(() => {
      config = config || {};
      const nestedKey = this.constructKey(key);
      return p(this).cache.set(nestedKey, value)
      .then(result => {
        if (config.includeKey) return {key: nestedKey, result};
        return result;
      });
    });
  }
  
  /**
   *
   */
  get(key, config) {
    return this.awaitConnection()
    .then(() => {
      config = config || {};
      const nestedKey = this.constructKey(key);
      return p(this).cache.get(nestedKey)
      .then(result => {
        if (config.includeKey) return {key: nestedKey, result};
        return result;
      });
    });
  }
  
  /**
   *
   */
  add(key, value, config) {
    return this.awaitConnection()
    .then(() => {
      config = config || {};
      const nestedKey = this.constructKey(key);
      return p(this).cache.add(nestedKey, value)
      .then(result => {
        if (config.includeKey) return {key: nestedKey, result};
        return result;
      });
    });
  }
}


Object.assign(Cachie, {
  TYPE,
  TYPES
});

module.exports = Cachie;
