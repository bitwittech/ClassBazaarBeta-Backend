import { Router } from 'express';
import db from '../db';
const assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
const router = new Router();

router.get('/api/courses/', async (req, res) => {
  let st, en;
  if (req.query.sort === undefined) {
    st = 0;
    en = 25;
  } else {
    console.log('inside else');
    try {
      const totalLength = req.query.sort.length - 4;
      const range = JSON.parse(req.query.range);
      const sort = req.query.sort
        .replace(/[/'"]+/g, '')
        .substring(1, totalLength - 1)
        .split(',');
      const filter = req.query.filter;
      st = range[0];
      en = range[1];
    } catch (e) {
      console.log(e);
    }
  }

  db
    .table('data')
    .orderBy('ranking_points', 'desc')
    .limit(en - st)
    .then(result => {
      res.send({ data: result, total: 1500 });
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
