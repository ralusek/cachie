'use strict';

const Promise = require('bluebird');
const Redis = require('ioredis');

const CLUSTER_RETRIES = 5;

/**
 *
 */
module.exports.connect = function(config) {
  config = config || {};
  let redisClient;
  return new Promise((resolve, reject) => {
    if (config.isCluster) {
      const nodes  = config.url.split(',').map(item => ({port: 6379, host: item}));

      console.log(`Redis is connecting to cluster nodes ${nodes}...`);

      redisClient = new Redis.Cluster(nodes, {
        scaleReads: 'slave', // slave nodes are read only
        clusterRetryStrategy: (times) => {
          let delay = times * 1000;
          if (times < CLUSTER_RETRIES) {
            console.log(`Reconnect to Redis cluster in ${delay / 1000} seconds.`);
            return delay;
          }
          else console.error('Max attempts reached for connecting redis server');
        }
      });
    }
    else redisClient = new Redis(config.url || 'redis://:@127.0.0.1:6379');

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
