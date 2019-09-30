import { Router } from 'express';
import db from '../db';
import { filter } from 'rxjs/operators';
const assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
const router = new Router();

router.get('/api/courses/', async (req, res) => {
  let st, en, searchQuery, filter;
  console.log(req.query);
  if (req.query.sort === undefined && req.query.range === undefined) {
    st = 0;
    en = 25;
  } else {
    console.log('inside else');
    try {
      const range = JSON.parse(req.query.range);
      searchQuery = req.query['q'];
      filter = req.query.filter;
      console.log(filter);
      // const sort = req.query.sort
      //   .replace(/[/'"]+/g, '')
      //   .substring(1, totalLength - 1)
      //   .split(',');
      st = range[0];
      en = range[1];
    } catch (e) {
      console.log(e);
    }
  }

  console.log({ st }, { en }, { searchQuery });

  db
    .table('data')
    .count('index as CNT')
    .then(function(total) {
      return total[0].CNT;
    })
    .then(t => {
      db
        .table('data')
        .where(qb => {
          if (searchQuery !== '' && filter === '') {
            qb.where('title', 'ilike', `%${searchQuery}%`);
          }

          if (filter === 'price:free') {
            console.log('Query for free courses');
            qb.havingNull('price');
          }

          if (filter === 'start:flexible') {
            console.log('Query for flexible start date');
            qb.where('is_flexible', '=', true);
          }
          if (filter === 'certificates') {
            console.log('Query for certificates');
            qb.where('has_paid_certificates', '=', true);
          }
        })
        .orderBy('ranking_points', 'desc')
        .limit(en - st)
        .offset(st)
        .then(result => {
          res.send({ data: result, total: t });
        });
    });
});

router.get('/api/course/', async (req, res) => {
  console.log(req.query);
  const provider = req.query.provider;
  const uuid = req.query.uuid;
  let mongoDBURL, dbName, collectionName, key;
  if (provider === 'EDx') {
    mongoDBURL =
      'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj';
    dbName = 'heroku_h05wbcsj';
    collectionName = 'edx';
    key = 'uuid';
  } else if (provider === 'FutureLearn') {
    mongoDBURL =
      'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj';
    dbName = 'heroku_h05wbcsj';
    collectionName = 'futureLearn';
    key = 'uuid';
  } else {
    res.send({ data: [] });
  }
  console.log({ key });
  MongoClient.connect(mongoDBURL, function(err, client) {
    assert.equal(null, err);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    var query = {};
    query[key] = uuid;
    collection.findOne(query, (err, result) => {
      res.send({ data: result });
    });
  });
});

export default router;
