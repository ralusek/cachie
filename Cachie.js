'use strict';

const Promise = require('bluebird');
const Deferrari = require('deferrari');

const CONNECTED = 'connected';


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

    p(this).deferrari = new Deferrari({Promise: Promise});
  }

  /**
   *
   */
  connect(config) {
    config = config || {};
    if (config.cacheClient) p(this).cacheClient = config.cacheClient;
    if (p(this).cacheClient) return p(this).deferrari.resolve(CONNECTED, p(this).cacheClient);

    return p(this).cache.connect(config)
    .tap(client => {
      p(this).cacheClient = client;
      return p(this).deferrari.resolve(CONNECTED, client);
    });
  }

  /**
   *
   */
  childCollection(config) {
    config = config || {};
    if (!config.collection) throw new Error('Must specify a collection to create child collection.');
    const collection = p(this).collection || [];
    config.collection = collection.concat(Array.isArray(config.collection) ? config.collection : [config.collection]);

    config.type = config.type || p(this).type;
    config.keyDelimiter = p(this).keyDelimiter;
    config.cacheClient = config.cacheClient || p(this).cacheClient;
    
    const childCollection = new Cachie(config);
    p(this).deferrari.deferUntil(CONNECTED)
    .then(client => childCollection.connect({cacheClient: client}));

    return childCollection;
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
    return p(this).deferrari.deferUntil(CONNECTED)
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
    return p(this).deferrari.deferUntil(CONNECTED)
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
    return p(this).deferrari.deferUntil(CONNECTED)
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
