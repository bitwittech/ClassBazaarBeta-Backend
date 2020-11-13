/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */

import i18nextMiddleware, {
  LanguageDetector,
} from 'i18next-express-middleware';

import Context from './Context';
import PrettyError from 'pretty-error';
import accountRoutes from './routes/account';
import bodyParser from 'body-parser';
import compression from 'compression';
import connectRedis from 'connect-redis';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import courseListRoutes from './routes/courseList';
import edxRoutes from './routes/edx';
import errors from './errors';
import express from 'express';
import expressGraphQL from 'express-graphql';
import flash from 'express-flash';
import i18next from 'i18next';
import i18nextBackend from 'i18next-node-fs-backend';
import passport from './passport';
import path from 'path';
import { printSchema } from 'graphql';
import redis from './redis';
import schema from './schema';
import session from 'express-session';
import udemyRoutes from './routes/udemy';
import userRoutes from './routes/users';

i18next
  .use(LanguageDetector)
  .use(i18nextBackend)
  .init({
    preload: ['en', 'de'],
    ns: ['common', 'email'],
    fallbackNS: 'common',
    detection: {
      lookupCookie: 'lng',
    },
    backend: {
      loadPath: path.resolve(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      addPath: path.resolve(
        __dirname,
        '../locales/{{lng}}/{{ns}}.missing.json',
      ),
    },
  });

const app = express();

app.set('trust proxy', 'loopback');

// app.use(
//   cors({
//     origin(origin, cb) {
//       const whitelist = process.env.CORS_ORIGIN
//         ? process.env.CORS_ORIGIN.split(',')
//         : [];
//       cb(null, whitelist.includes(origin));
//     },
//     credentials: true,
//   }),
// );
app.use(
  cors({
    origin: function (origin, callback) {
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    store: new (connectRedis(session))({ client: redis, ttl: 6000000000 }),
    name: 'sid',
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 60000000000 },
  }),
);
app.use(i18nextMiddleware.handle(i18next));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(accountRoutes);
// app.use(edxRoutes);
// app.use(udemyRoutes);
app.use(courseListRoutes);
app.use(userRoutes);

// The following routes are intended to be used in development mode only
if (process.env.NODE_ENV !== 'production') {
  // A route for testing email templates
  app.get('/:email(email|emails)/:template', (req, res) => {
    const message = email.render(req.params.template, { t: req.t, v: 123 });
    res.send(message.html);
  });

  // A route for testing authentication/authorization
  app.get('/', (req, res) => {
    if (req.user) {
      res.send(
        `<p>${req.t('Welcome, {{user}}!', {
          user: req.user.displayName,
        })} (<a href="javascript:fetch('/login/clear', { method: 'POST', credentials: 'include' }).then(() => window.location = '/')">${req.t(
          'log out',
        )}</a>)</p>`,
      );
    } else {
      res.send(
        `<p>${req.t('Welcome, guest!')} (<a href="/login/facebook">${req.t(
          'sign in',
        )}</a>)</p>`,
      );
    }
  });
}

app.get('/graphql/schema', (req, res) => {
  res.type('text/plain').send(printSchema(schema));
});

app.use(
  '/graphql',
  expressGraphQL((req) => ({
    schema,
    context: new Context(req),
    graphiql: process.env.NODE_ENV !== 'production',
    pretty: process.env.NODE_ENV !== 'production',
    formatError: (error: any) => {
      errors.report(error.originalError || error);
      return {
        message: error.message,
        code: error.originalError && error.originalError.code,
        state: error.originalError && error.originalError.state,
        locations: error.locations,
        path: error.path,
      };
    },
  })),
);

const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => {
  console.log('session:\n', req.session);
  process.stderr.write(pe.render(err));
  next();
});

export default app;
