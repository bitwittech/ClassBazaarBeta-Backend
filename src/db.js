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
    port: '32768',
    host: '206.189.138.80',
    user: 'classbazaar',
    password: 'CBPassword2019!',
    database: 'postgres',
  },
  pool: {
    min: 1,
    max: 400,
  },
  debug: process.env.DATABASE_DEBUG === 'true',
});

export default db;
