'use strict';

const Promise = require('bluebird');
const Redis = require('ioredis');
const _ensureArray = require('hodash.ensure-array');

const CLUSTER_RETRIES = 5;

/**
 * config.nodes should be an Array like this:
 * [{
 *    port: 6380,
 *    host: '127.0.0.1'
 *  }, {
 *    port: 6381,
 *    host: '127.0.0.1'
 * }]
 * If there are multiple nodes, it will be treated as a cluster.
 */
module.exports.connect = function(config) {
  config = config || {};
  let redisClient;
  return new Promise((resolve, reject) => {
    // Handle default, localhost.
    if (!config.nodes) config.nodes = {host: '127.0.0.1', port: 6379};

    const nodes = _ensureArray(config.nodes);

    // If mutliple nodes, treat as cluster.
    if (nodes.length > 1) {
      const nodes = config.nodes;

      console.log(`Redis is connecting to cluster nodes ${nodes}...`);

      redisClient = new Redis.Cluster(nodes, {
        scaleReads: 'slave', // slave nodes are read only
        clusterRetryStrategy: (times) => {
          const delay = times * 1000;
          if (times < CLUSTER_RETRIES) {
            console.log(`Reconnect to Redis cluster in ${delay / 1000} seconds.`);
            return delay;
          }
          else console.error('Max attempts reached for connecting redis server');
        }
      });
    }
    else redisClient = new Redis(nodes);

    redisClient.on('error', (err) => {
      console.log('Redis error ' + err);
      reject(err);
    });

    redisClient.on('connect', () => {
      console.log('Redis is ready');
      resolve(redisClient);
    });
  });
};
