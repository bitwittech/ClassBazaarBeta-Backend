/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */
/* eslint-disable no-param-reassign, no-underscore-dangle, max-len */

import db from './db';
import passport from 'passport';
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');

passport.serializeUser((user, done) => {
  done(null, {
    id: user.id,
    displayName: user.displayName,
    imageUrl: user.imageUrl,
  });
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Creates or updates the external login credentials
// and returns the currently authenticated user.
async function login(req, provider, profile, tokens) {
  let user;

  if (req.user) {
    user = await db.table('users').where({ id: req.user.id }).first();
  }

  if (!user) {
    user = await db
      .table('logins')
      .innerJoin('users', 'users.id', 'logins.user_id')
      .where({ 'logins.provider': provider, 'logins.id': profile.id })
      .first('users.*');
    if (
      !user &&
      profile.emails &&
      profile.emails.length &&
      profile.emails[0].verified === true
    ) {
      user = await db
        .table('users')
        .innerJoin('emails', 'emails.user_id', 'users.id')
        .where({
          'emails.email': profile.emails[0].value,
          'emails.verified': true,
        })
        .first('users.*');
    }
  }

  if (!user) {
    [user] = await db
      .table('users')
      .insert({
        display_name: profile.displayName,
        image_url:
          profile.photos && profile.photos.length
            ? profile.photos[0].value
            : null,
      })
      .returning('*');

    if (profile.emails && profile.emails.length) {
      await db.table('emails').insert(
        profile.emails.map((x) => ({
          user_id: user && user.id,
          email: x.value,
          verified: x.verified || false,
        })),
      );
    }
  }

  const loginKeys = { user_id: user.id, provider, id: profile.id };
  const { count } = await db
    .table('logins')
    .where(loginKeys)
    .count('id')
    .first();

  if (count === '0') {
    await db.table('logins').insert({
      ...loginKeys,
      username: profile.username,
      tokens: JSON.stringify(tokens),
      profile: JSON.stringify(profile._json),
    });
  } else {
    await db
      .table('logins')
      .where(loginKeys)
      .update({
        username: profile.username,
        tokens: JSON.stringify(tokens),
        profile: JSON.stringify(profile._json),
        updated_at: db.raw('CURRENT_TIMESTAMP'),
      });
  }

  return {
    id: user.id,
    displayName: user.display_name,
    imageUrl: user.image_url,
  };
}

passport.use(
  new LocalStrategy((email, password, cb) => {
    console.log('Inside local strategy', email, password);
    db.table('users')
      .innerJoin('emails', 'emails.user_id', 'users.id')
      .where({
        'emails.email': email,
      })
      .first('users.*')
      .then((user) => {
        console.log(user);
        if (!user || user === undefined) cb(null, false);
        else {
          const result = bcrypt.compareSync(password, user.password_hash);
          console.log('Pass matched? ::', result);
          if (result) cb(null, user);
          else cb(null, false);
        }
      });
  }),
);

export default passport;
