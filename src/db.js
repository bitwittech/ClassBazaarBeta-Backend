/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */

import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: {
    port: '5432',
    host: '159.89.53.9',
    user: 'postgres',
    password: 'docker',
    database: 'postgres',
  },
  pool: { min: 0, max: 25 },
  debug: process.env.DATABASE_DEBUG === 'true',
});

export default db;
