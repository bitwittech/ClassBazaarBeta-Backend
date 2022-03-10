/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */
/* eslint-disable no-console, no-shadow */

import app from './app';
import db from './db';
import errors from './errors';
import { mainConnect } from './mongoclient';
import redis from './redis';


const port = process.env.PORT || 8080;
const host = process.env.HOSTNAME || '0.0.0.0';

// shedular by Yashwant Sahu Added 

const axios = require('axios');
const cron = require('node-cron');



// 0 0 * * * Time for 1 day at the 12pm reupdation

cron.schedule('0 0 * * *', async() => {
  console.log('Schedular Running');

  let response = await axios.get('https://api.classbazaar.com/api/getFeedsFutureLearn');

  if(response.status == 200)
  {
    response = await axios.get('https://api.classbazaar.com/api/getEdx');
    if(response.status == 200)
    {
      console.log('Done')
    }
  }
});



// Connect to all the mongoDB
mainConnect()
  .then(() => {
    console.log('MONGO CLIENTS CONNECTED');
  })
  .catch((error) => {
    console.log('MONGO CLIENTS CONNECTION FAILED', error);
  });
// Launch Node.js server
const server = app.listen(port, host, () => {
  console.log(`Node.js API server is listening on http://${host}:${port}/`);
});

// Shutdown Node.js app gracefully
function handleExit(options, err) {
  if (options.cleanup) {
    const actions = [server.close, db.destroy, redis.quit];
    actions.forEach((close, i) => {
      try {
        close(() => {
          if (i === actions.length - 1) process.exit();
        });
      } catch (err) {
        if (i === actions.length - 1) process.exit();
      }
    });
  }
  if (err) errors.report(err);
  if (options.exit) process.exit();
}

process.on('exit', handleExit.bind(null, { cleanup: true }));
process.on('SIGINT', handleExit.bind(null, { exit: true }));
process.on('SIGTERM', handleExit.bind(null, { exit: true }));
process.on('uncaughtException', handleExit.bind(null, { exit: true }));
