import { Router } from 'express';
import db from '../db';
import { filter } from 'rxjs/operators';
const assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
const router = new Router();

router.get('/api/courses/', async (req, res) => {
  console.log('user', req.user);
  let st, en, searchQuery, filter, subjectFilter, provider;
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
      provider = req.query.provider;
      subjectFilter = req.query.subjects;
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

  const dataModel = db.table('data').where(qb => {
    if (searchQuery !== '' && filter === '') {
      qb.where('title', 'ilike', `%${searchQuery}%`);
    }

    if (provider !== 'all') {
      qb.andWhere(subQB => {
        if (provider.split('::').length > 0) {
          provider.split('::').forEach((obj, index) => {
            subQB.orWhere('provider', '=', obj);
          });
        }
      });
    }

    // SELECT * FROM data WHERE
    if (subjectFilter !== 'all') {
      console.log('Inside the filter for subjects');
      console.log({ subjectFilter });
      qb.andWhere(subQB => {
        if (subjectFilter.split('::').length > 0) {
          subjectFilter.split('::').forEach((obj, index) => {
            subQB.orWhereRaw(`'${obj}' = ANY (subjects)`);
          });
        }
      });
    }

    if (filter === 'price:free') {
      console.log('Query for free courses');
      qb.whereNull('price');
    }

    if (filter === 'start:flexible') {
      console.log('Query for flexible start date');
      qb.where('is_flexible', '=', true);
    }

    if (filter === 'certificates') {
      console.log('Query for certificates');
      qb.where('has_paid_certificates', '=', true);
    }
  });

  const totalCount = await dataModel.clone().count();
  const data = await dataModel
    .clone()
    .limit(en - st)
    .offset(st)
    .orderBy('ranking_points', 'desc');
  console.log({ totalCount });
  res.send({ data, total: totalCount[0]['count'] });
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

router.get('/api/getSubjects', async (req, res) => {
  res.send({
    data: [
      {
        name: 'Business',
        code: 'B',
      },
      {
        name: 'Computer Science',
        code: 'CS',
      },
      {
        name: 'Arts & Design',
        code: 'A',
      },
      {
        name: 'Data Science',
        code: 'DA',
      },
      {
        name: 'Health & Lifestyle',
        code: 'HL',
      },
      {
        name: 'Science & Engineering',
        code: 'SENG',
      },
      {
        name: 'Social Studies',
        code: 'SO',
      },
      {
        name: 'Developers/Programming',
        code: 'DEV',
      },
      {
        name: 'Math',
        code: 'M',
      },
      {
        name: 'Others',
        code: 'O',
      },
    ],
  });
});

router.get('/api/getProviders', async (req, res) => {
  res.send({
    data: ['EDx', 'FutureLearn'],
  });
});

// Adds/Removes bookmark based on `action` param
router.put('/api/user/bookmark', async (req, res) => {
  const action = req.body.action;
  const course = req.body.course;
  if (action === 'add') {
    db
      .table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        const newBookmarks = u.bookmarks;
        newBookmarks.push(course);
        if (!u.bookmarks.include(course)) {
          db
            .table('users')
            .where('id', '=', req.user.id)
            .first()
            .update(bookmarks, newBookmarks)
            .then(f => {
              res.send({ status: 'success', message: 'Bookmark added' });
            });
        } else {
          res.send({ status: 'success', message: 'Bookmark already added' });
        }
      });
  } else if (action === 'remove') {
    db
      .table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        // Removing bookmark from the old list
        const newBookmarks = u.bookmarks;
        const index = newBookmarks.indexOf(course);
        if (index > -1) {
          newBookmarks.splice(index, 1);
        }

        if (u.bookmarks.include(course)) {
          db
            .table('users')
            .where('id', '=', req.user.id)
            .first()
            .update(bookmarks, newBookmarks)
            .then(f => {
              res.send({ status: 'success', message: 'Bookmark removed' });
            });
        } else {
          res.send({ status: 'success', message: 'Bookmark already removed' });
        }
      });
  } else {
    res.send({ message: 'Not a valid action' });
  }
});

// Gets bookmarked courses for the user
router.get('/api/user/bookmark', async (req, res) => {
  try {
    db
      .table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        res.send({ data: u.bookmarks });
      });
  } catch (e) {
    res.send({ data: [] });
  }
});

// Adds/Removes review based on `action` param
router.put('/api/user/review', async (req, res) => {});

// Gets reviews for the user
router.get('/api/user/reviews', async (req, res) => {});

export default router;
