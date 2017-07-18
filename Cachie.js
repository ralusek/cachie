'use strict';

const Promise = require('bluebird');
const _ensureArray = require('hodash.ensure-array');
const _flattenToSet = require('hodash.flatten-to-set');
const Deferrari = require('deferrari');
const Bunchie = require('bunchie');

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

    config.cache = this;
    
    p(this).cache = new (({
      [TYPE.IN_MEMORY]: require('./InMemory'),
      [TYPE.REDIS]: require('./Redis')
    })[p(this).type])(config);

    // Used for deferring actions until connected.
    p(this).deferrari = new Deferrari({Promise: Promise});

    // Used for clustering individual requests together into a multi-request
    configureBunchie(this, config);

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
          return (
            config.useBunching ?
              p(this).bunchie.string.get.bunch(nestedKey)
              .then(({handled}) => handled[nestedKey]) :
              p(this).cache.string.get(nestedKey, config)
          )
          .then(result => {
            if (config.unstringify) result = JSON.parse(result);
            if (config.includeKey) return {key: nestedKey, result};
            if (config.mapToKey) return {[nestedKey]: result};
            return result;
          });
        });
      },
      getMulti: (keys, config) => {
        config = config || {};
        return this._prepare(keys)
        .then(nestedKeys => {
          return p(this).cache.string.getMulti(nestedKeys, config)
          .then(results => {
            if (config.unstringify) result = JSON.parse(result);
            if (config.includeKey) return results.map((result, i) => ({key: nestedKeys[i], result}));
            if (config.mapToKey) return results.reduce((mapped, result, i)=> {
              mapped[nestedKeys[i]] = result;
              return mapped;
            }, {});
            return results;
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
  constructKeys(keys) {
    const isArray = Array.isArray(keys);
    keys = isArray ? keys : [keys];
    keys = keys.map(key => (p(this).collection || []).concat(key).join(p(this).keyDelimiter));
    return isArray ? keys : keys[0];
  }


  /**
   * Prepare.
   */
  _prepare(keys) {
    return p(this).deferrari.deferUntil(CONNECTED)
    .return(this.constructKeys(keys));
  }
}


/**
 *
 */
function configureBunchie(cachie, config) {
  p(cachie).bunchie = {
    string: {
      set: new Bunchie({
        type: 'set',
        minWaitTime: config.minBunchTime || 250
      }),
      get: new Bunchie({
        type: 'set',
        minWaitTime: config.minBunchTime || 250
      })
    }
  };

  p(cachie).bunchie.string.get.setBunchHandler(({bunch}) => {
    return cachie.string.getMulti(Array.from(bunch), {mapToKey: true});
  });
}


Object.assign(Cachie, {
  TYPE,
  TYPES
});

module.exports = Cachie;
