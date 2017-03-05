'use strict';

const Promise = require('bluebird');
const _ensureArray = require('hodash.ensure-array');
const _flattenToSet = require('hodash.flatten-to-set');
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

const INTERFACE = Object.freeze({
  lists: ['add', 'list'],
  sets: ['add', 'list'],
  strings: ['set', 'get']
});



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

    config.cache = this;
    
    p(this).cache = new (({
      [TYPE.IN_MEMORY]: require('./InMemory'),
      [TYPE.REDIS]: require('./Redis')
    })[p(this).type])(config);

    p(this).deferrari = new Deferrari({Promise: Promise});

    // Add interface methods.

    this.delete = (key, config) => {
      config = config || {};
      return this._prepare(key)
      .then(nestedKey => {
        return p(this).cache.delete(nestedKey, config)
        .then(result => {
          if (config.includeKey) return {key: nestedKey, result};
          return result;
        });
      });
    };
    
    this.string = Object.freeze({
      get: (key, config) => {
        config = config || {};
        return this._prepare(key)
        .then(nestedKey => {
          return p(this).cache.string.get(nestedKey, config)
          .then(result => {
            if (config.unstringify) result = JSON.parse(result);
            if (config.includeKey) return {key: nestedKey, result};
            return result;
          });
        });
      },
      set: (key, value, config) => {
        config = config || {};
        return this._prepare(key)
        .then(nestedKey => {
          if (config.stringify) value = JSON.stringify(value);
          return p(this).cache.string.set(nestedKey, value, config)
          .then(result => {
            if (config.includeKey) return {key: nestedKey, result};
            return result;
          });
        });
      },
      delete: (key, config) => {
        config = config || {};
        return this._prepare(key)
        .then(nestedKey => {
          return p(this).cache.string.delete(nestedKey, config)
          .then(result => {
            if (config.includeKey) return {key: nestedKey, result};
            return result;
          });
        });
      }
    });

    this.set = Object.freeze({
      add: (key, values, config) => {
        config = config || {};
        return this._prepare(key)
        .then(nestedKey => {
          values = _flattenToSet(_ensureArray(values));
          return p(this).cache.set.add(nestedKey, values, config)
          .then(result => {
            if (config.includeKey) return {key: nestedKey, result};
            return result;
          });
        });
      },
      delete: (key, config) => {
        config = config || {};
        return this._prepare(key)
        .then(nestedKey => {
          return p(this).cache.set.delete(nestedKey, config)
          .then(result => {
            if (config.includeKey) return {key: nestedKey, result};
            return result;
          });
        });
      }
    });
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
   * Prepare.
   */
  _prepare(key) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .return(this.constructKey(key));
  }
}


Object.assign(Cachie, {
  TYPE,
  TYPES
});

module.exports = Cachie;
