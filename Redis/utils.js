'use strict';

module.exports.argsForExpiration = function(config) {
  let args = [];

  // Add expiration in MS.
  if (config.expiresIn) args = args.concat(['PX', config.expiresIn]);
  if (config.expiresAt) {
    const expiresIn = (new Date(config.expiresAt).getTime() - Date.now());
    if (expiresIn < 0) throw new Error('Cannot expire key in the past.');
    args = args.concat(['PX', expiresIn]);
  }

  return args;
};
