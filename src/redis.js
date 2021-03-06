/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */

import bluebird from 'bluebird';
import errors from './errors';
import redis from 'redis';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

//const client = redis.createClient(process.env.REDIS_URL);
// client.on('error', errors.report); // eslint-disable-line no-console

const client = undefined;

export default client;
