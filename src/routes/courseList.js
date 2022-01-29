const pgp = require("pg-promise")({
  capSQL: true // generate capitalized SQL 
});

import DB from '../mydb';

import {
  Router
} from 'express';
import db from '../db';
import fetch from 'node-fetch';
import {
  filter
} from 'rxjs/operators';
import mailer from './../email';
import {
  mongoClient
} from '../mongoclient';
import {
  parse
} from 'node-html-parser';

const assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
const router = new Router();
const {
  FusionAuthClient
} = require('@fusionauth/node-client');
const client = new FusionAuthClient(
  'NiITD64khrkH7jn6PUNYCPdancc2gdiD8oZJDTsXFOA',
  'https://auth.classbazaar.in',
);

const providersGlobal = [
  'Coursera',
  'edX',
  'FutureLearn',
  'SimpliLearn',
  'Udemy',
  'Udacity',
  'upGrad',
  'Swayam',
];

const cols = [
  'index',
  'title',
  'start_date',
  'price',
  'price_currency',
  'subjects',
  'provider',
  'university',
  'commitment',
  'ranking_points',
  'uuid',
  'is_flexible',
  'has_paid_certificates',
  'url',
  'instructors',
];

function getQueries(
  searchQuery,
  filter,
  provider,
  subjectFilter,
  feeFilter,
  startDateFilter,
  st,
  en,
) {
  const dataModel = db.table('data').where((qb) => {
    if (searchQuery !== '' && filter === '') {
      qb.andWhere((subQB) => {
        subQB
          .where('title', 'ilike', `%${searchQuery}%`)
          .orWhereRaw(`university ~* '(\\m${searchQuery}\\M)'`);
      });
    }
    if (provider !== 'all') {
      console.log('Adding providers');
      qb.andWhere((subQB) => {
        if (provider.split('::').length > 0) {
          provider.split('::').forEach((obj, index) => {
            subQB.orWhere('provider', '=', obj);
          });
        }
      });
    }
    if (subjectFilter !== 'all') {
      // console.log('Inside the filter for subjects');
      // console.log({ subjectFilter });
      qb.andWhere((subQB) => {
        if (subjectFilter.split('::').length > 0) {
          subjectFilter.split('::').forEach((obj, index) => {
            subQB.orWhereRaw(`'${obj}' = ANY (subjects)`);
          });
        }
      });
    }

    // qb.andWhere(subQB => {
    //   subQB.where('locale', '=', `English`).orWhereRaw('locale is null');
    // });
    if (feeFilter === 'price:free') {
      // console.log('Query for free courses');
      qb.whereNull('price');
    }
    if (feeFilter === 'price:paid') {
      console.log('Query for free courses');
      qb.whereNotNull('price');
      qb.orWhere('price', '<>', 0);
    }
    if (startDateFilter === 'start:flexible') {
      // console.log('Query for flexible start date');
      qb.where('is_flexible', '=', true);
    }
    if (startDateFilter === 'start:lte30') {
      // console.log('Query for flexible start date with lte30');
      var future = new Date();
      var past = new Date();
      future.setDate(future.getDate() + 30);
      past.setDate(past.getDate() - 30);
      qb.where('start_date', '<=', future);
      qb.andWhere('start_date', '>=', past)
      // .orWhere('is_flexible', '=', true);
    }
    if (startDateFilter === 'start:gte30') {
      // console.log('Query for flexible start date with gte30');
      var future = new Date();
      future.setDate(future.getDate() + 30);
      qb.where('start_date', '>=', future);
      // .orWhere('is_flexible', '=', true);
    }
    if (filter === 'certificates') {
      // console.log('Query for certificates');
      qb.where('has_paid_certificates', '=', true);
    }
  });
  const totalCount = dataModel.clone();
  totalCount.clearSelect();
  totalCount.count();
  if (searchQuery !== '' && filter === '') {
    dataModel.select(
      db.raw(
        `(CASE WHEN university ~* '(\\m${searchQuery}\\M)' THEN 2 ELSE 1 END) As rnk`,
      ),
    );
    for (let col of cols) {
      dataModel.select(col);
      dataModel.groupBy(col);
    }
    dataModel.orderBy('rnk', 'desc');
  }
  console.log(dataModel.toString());
  const data = dataModel
    .clone()
    .orderBy([{
      column: 'ranking_points',
      order: 'desc'
    }, 'index'])
    .offset(st)
    .limit(en - st);
  return {
    totalCount,
    data
  };
}

router.get('/api/courses/', async (req, res) => {
  // console.log('user', req.user);
  let timeStart = Date.now();
  let st,
    en,
    searchQuery,
    filter,
    subjectFilter,
    provider,
    feeFilter,
    startDateFilter;
  if (req.query.sort === undefined && req.query.range === undefined) {
    st = 0;
    en = 10;
    searchQuery = req.query['q'] || '';
    filter = req.query.filter;
    feeFilter = req.query.feeFilter;
    startDateFilter = req.query.startDateFilter;
    provider = req.query.provider;
    subjectFilter = req.query.subjects;
  } else {
    try {
      const range = JSON.parse(req.query.range);
      searchQuery = req.query['q'] || '';
      filter = req.query.filter;
      feeFilter = req.query.feeFilter;
      startDateFilter = req.query.startDateFilter;
      provider = req.query.provider;
      subjectFilter = req.query.subjects;
      st = range[0];
      en = range[1];
    } catch (e) {
      console.log(e);
    }
  }

  const {
    totalCount,
    data
  } = getQueries(
    searchQuery,
    filter,
    provider,
    subjectFilter,
    feeFilter,
    startDateFilter,
    st,
    en,
  );
  Promise.all([totalCount, data])
    .then((result) => {
      res.send({
        data: result[1],
        total: result[0]
      });
    })
    .catch((e) => {
      console.error(e);
      res.send({
        data: [],
        total: 0
      });
    });
});

router.get('/api/v2/courses/', async (req, res) => {
  console.log('Called API'+req.url);
  try {
    console.log('Called API');
    let timeStart = Date.now();
    let [
      st,
      en,
      searchQuery,
      filter,
      feeFilter,
      startDateFilter,
      provider,
      subjectFilter,
      providerOffsets,
      providerList,
    ] = [...parseQueryString(req)];

    const allQueries = providersGlobal.map((p, providerIndex) => {
      if (provider !== 'all') {
        if (provider.split('::').indexOf(p) < 0) {
          return [];
        }
      }

      const dataModel = db.table('data').where((qb) => {
        var datetime = new Date();
        if (searchQuery !== '' && filter === '') {
          qb.andWhere((subQB) => {
            subQB
              .where('title', 'ilike', `%${searchQuery}%`)
              .orWhereRaw(`university ~* '(\\m${searchQuery}\\M)'`);
          });
        }
        qb.andWhere('provider', '=', p);
        qb.andWhere(subQB => {
          subQB.where('start_date', '>=', datetime).orWhereRaw('start_date is null');
        });
        qb.andWhere(subQB => {
          subQB.where('locale', '=', `English`).orWhereRaw('locale is null');
          
        });  
//         qb.andWhere(subQB => {
//           subQB.where('locale', '=', `English`).orWhereRaw('locale is null');
//         });

        if (subjectFilter !== 'all') {
          // console.log('Inside the filter for subjects');
          // console.log({ subjectFilter });
          qb.andWhere((subQB) => {
            if (subjectFilter.split('::').length > 0) {
              subjectFilter.split('::').forEach((obj, index) => {
                subQB.orWhereRaw(`'${obj}' = ANY (subjects)`);
              });
            }
          });
        }

        if (feeFilter === 'price:free') {
          // console.log('Query for free courses');
          qb.whereNull('price');
        }

        if (feeFilter === 'price:paid') {
          console.log('Query for free courses');
          qb.whereNotNull('price');
        }

        if (startDateFilter === 'start:flexible') {
          // console.log('Query for flexible start date');
          qb.where('is_flexible', '=', true);
        }

        if (startDateFilter === 'start:lte30') {
          // console.log('Query for flexible start date with lte30');
          var future = new Date();
          future.setDate(future.getDate() + 30);
          qb.where('start_date', '<=', future);
          // .orWhere('is_flexible', '=', true);
        }

        if (startDateFilter === 'start:gte30') {
          // console.log('Query for flexible start date with gte30');
          var future = new Date();
          future.setDate(future.getDate() + 30);
          qb.where('start_date', '>=', future);
          // .orWhere('is_flexible', '=', true);
        }

        if (filter === 'certificates') {
          // console.log('Query for certificates');
          qb.where('has_paid_certificates', '=', true);
        }
      });
      const totalCount = dataModel.clone();
      totalCount.clearSelect();
      totalCount.count();

      if (searchQuery !== '' && filter === '') {
        dataModel.select(
          db.raw(
            `(CASE WHEN university ~* '(\\m${searchQuery}\\M)' THEN 2 ELSE 1 END) As rnk`,
          ),
        );
        for (let col of cols) {
          dataModel.select(col);
          dataModel.groupBy(col);
        }
        dataModel.orderBy('rnk', 'desc');
      }

      console.log(dataModel.toString());
      console.log(providerOffsets);
      return dataModel
        .clone()
        .orderBy([{
          column: 'ranking_points',
          order: 'desc'
        }, 'index'])
        .offset(providerOffsets[providerIndex])
        .limit(10);
    });

    const {
      totalCount,
      data
    } = getQueries(
      searchQuery,
      filter,
      provider,
      subjectFilter,
      feeFilter,
      startDateFilter,
      st,
      en,
    );
    Promise.all(allQueries)
      .then((result) => {
        console.log('Here 1');
        let iteration = result.map((r) => 0);
        let finalData = [];
        const total = result
          .map((r) => r.length)
          .reduce((prev, current) => prev + current, 0);
        const expectedResultsCount = total >= 10 ? 10 : total;

        while (finalData.length < expectedResultsCount) {
          result.map((r, index) => {
            if (r[iteration[index]] !== undefined && finalData.length < 10) {
              finalData.push(r[iteration[index]]);
              iteration[index]++;
            }
          });
        }
        // updating offsets
        const finalIterations = iteration.map((i, idx) => {
          if (provider !== 'all') {
            if (provider.split('::').indexOf(providersGlobal[idx]) < 0)
              return 0;
            else return i + parseInt(providerOffsets[idx]);
          } else return i + parseInt(providerOffsets[idx]);
        });
        Promise.all([totalCount])
          .then((r) => {
            console.log(r[0][0]);
            const total = parseInt(r[0][0].count);
            res.send({
              data: finalData,
              total,
              offset: finalIterations,
            });
          })
          .catch((e) => {
            console.error(e);
            res.send({
              data: [],
              total: 0
            });
          });
      })
      .catch((e) => {
        console.error(e);
        res.send({
          data: [],
          total: 0
        });
      });
  } catch (e) {
    console.log(e.stack);
  }
});

router.get('/api/bookmarks/', async (req, res) => {
  let bookmarks = JSON.parse(req.query.data);
  const dataModel = db.table('data').where((qb) => {
    bookmarks.forEach((obj, index) => {
      qb.orWhere({
        uuid: obj.id,
        provider: obj.provider
      });
    });
  });
  const data = await dataModel.orderBy('ranking_points', 'desc');
  res.send({
    data
  });
});

router.get('/api/course/', async (req, res) => {
  console.log(req.query);

  let provider = req.query.provider;
  let uuid = req.query.uuid;

  const courseID = req.query.index;
  if (courseID !== undefined) {
    await db
      .table('data')
      .where({
        index: courseID
      })
      .first()
      .then((course) => {
        console.log(course);
        res.send({
          data: course
        });
      });
  }
  console.log(provider, uuid);

  let summaryData = {};
  if (provider === 'SimpliLearn') {
    summaryData = await db
      .table('data')
      .where({
        provider,
        uuid: '"' + uuid + '"'
      })
      .first()
      .then((course) => course);
  } else {
    summaryData = await db
      .table('data')
      .where({
        provider,
        uuid
      })
      .first()
      .then((course) => course);
  }

  console.log(summaryData);

  let CLIENT, mongoDBURL, dbName, collectionName, key;
  CLIENT = mongoClient;
  if (provider === 'Coursera') {
    dbName = 'heroku_b5kg98fc';
    collectionName = 'coursera';
    key = '_id';
    uuid = new ObjectId(uuid);
  } else if (provider === 'edX') {
    console.log('EDX found');
    dbName = 'classbazaar';
    collectionName = 'edx';
    key = 'uuid';
  } else if (provider === 'FutureLearn') {
    dbName = 'classbazaar';
    collectionName = 'futureLearn';
    key = 'uuid';
  } else if (provider === 'SimpliLearn') {
    dbName = 'heroku_glmmwlk5';
    collectionName = 'simplilearn';
    key = '_id';
    uuid = new ObjectId(uuid);
  } else if (provider === 'upGrad') {
    dbName = 'heroku_h05wbcsj';
    collectionName = 'upgrad';
    key = '_id';
    uuid = new ObjectId(uuid);
  } else if (provider === 'Udacity') {
    dbName = 'heroku_glmmwlk5';
    collectionName = 'udacity';
    key = '_id';
    uuid = new ObjectId(uuid);
  } else if (provider === 'Udemy') {
    dbName = 'classbazaar';
    collectionName = 'udemy';
    key = 'title';
    uuid = summaryData.title;
  } else if (provider === 'Swayam') {
    dbName = 'classbazaar';
    collectionName = 'swayam';
    key = '_id';
    uuid = new ObjectId(uuid);
  } else {
    res.send({
      data: []
    });
  }

  console.log({
    key
  });
  var query = {};
  query[key] = uuid;
  console.log({
    CLIENT,
    mongoClient
  });
  try {
    const RESD = await CLIENT.db(dbName)
      .collection(collectionName)
      .findOne(query);
    res.send({
      data: RESD,
      summaryData
    });
  } catch (error) {
    console.log(error);
    res.send({
      data: [],
      summaryData
    });
  }
  res.send({
    summaryData
  });
});

router.get('/api/getSubjects', async (req, res) => {
  res.send({
    data: [{
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
    data: ['Edx', 'FutureLearn', 'SimpliLearn', 'Udemy'],
  });
});

router.get('/api/refresh/futurelearn', async (req, res) => {
  const summaryData = await db.table('data').where({
    provider: 'FutureLearn'
  });

  for (let course of summaryData) {
    const resp = await fetch(course.url);
    try {
      const text = await resp.text();
      const html = parse(text);
      const price = html
        .querySelectorAll('.m-comparison__sub-heading')[1].text.substring(1);
      const query = db
        .table('data')
        .where('index', '=', course.index)
        .update({
          price
        });
      console.log(query.toString());
      await query.catch((err) => {
        console.error('Error while inserting price in database ', err);
      });
    } catch (err) {
      console.error(err);
    }
  }
  res.send({
    status: 'Working on it',
  });
});

router.post('/api/contact', (req, res) => {
  const {
    name,
    email,
    subject,
    message
  } = req.body;
  mailer({
      name,
      email,
      subject,
      message
    })
    .then(() => {
      res.send('success');
    })
    .catch((error) => {
      res.status(422).send(error);
    });
});

// Add review to user.
router.post('/api/review', (req, res) => {
  let token = req.body.token;
  let review = req.body.review;
  let courseID = req.body.courseID;
  let provider = req.body.provider;

  client
    .retrieveUserUsingJWT(token)
    .then((response) => {
      const user = response.successResponse.user;
      console.log('USER', user);
      db.table('review')
        .insert({
          user_id: user.id,
          review: review,
          course_id: courseID,
          provider,
          username: user.username,
        })
        .then((index) => {
          res.send({
            status: 'Review Saved'
          });
        })
        .catch(console.error);
    })
    .catch((e) => {
      if (e.statuCode == 401) {
        res.status(401);
        res.send({
          status: 'User not found. Could not reconcile JWT.'
        });
      } else {
        console.log(e);
        res.status(500);
        res.send({
          status: 'Error'
        });
      }
    });
});

router.post('/api/review/user/', (req, res) => {
  let token = req.body.token;
  return client
    .retrieveUserUsingJWT(token)
    .then((response) => {
      const user = response.successResponse.user;
      console.log(user.id);
      db.table('review')
        .where({
          user_id: user.id,
        })
        .then(async (data) => {
          console.log(data);
          return Promise.all(
            data.map(async (review) => {
              return db
                .table('data')
                .where({
                  provider: review.provider
                })
                .andWhere({
                  uuid: review.course_id
                })
                .first()
                .then((course) => {
                  return {
                    review: review,
                    course: course,
                  };
                });
            }),
          ).then((results) => {
            console.log(results);
            res.status(200);
            res.send({
              data: results
            });
          });
        })
        .catch((e) => {
          res.status(500);
          res.send({
            status: 'Error'
          });
        });
    })
    .catch((e) => {
      if (e.statuCode == 401) {
        res.status(401);
        res.send({
          status: 'User not found. Could not reconcile JWT.'
        });
      } else {
        console.log(e);
        res.status(500);
        res.send({
          status: 'Error'
        });
      }
    });
});

router.post('/api/review/course/', (req, res) => {
  let courseID = req.body.courseID;
  let provider = req.body.provider;

  db.table('review')
    .where({
      course_id: courseID,
      provider: provider,
    })
    .then((data) => {
      res.status(200);
      res.send({
        data
      });
    })
    .catch((e) => {
      res.status(500);
      res.send({
        status: 'Error'
      });
    });
});

router.post('/api/stayupdated', (req, res) => {
  const {
    name,
    email,
    id,
    added
  } = req.body;
  console.log(name, email);
  db.table('stayupdated')
    .insert({
      name,
      email,
    })
    .then((data) => {
      res.status(200).send({
        status: 'Added successfully',
      });
    })
    .catch((e) => {
      console.log('ERROR', e);
      res.status(500).send({
        status: 'Error'
      });
    });
});

router.post('/api/eduMarkUpdated', (req, res) => {
  const {
    userid,
    email,
    result,
    promocode,
    amountpaid
  } = req.body;
  db.table('edumarks')
    .insert({
      userid,
      email,
      result,
      promocode,
      amountpaid
    })
    .then((data) => {
      res.status(200).send({
        status: 'Added successfully',
      });
    })
    .catch((e) => {
      console.log('ERROR', e);
      res.status(500).send({
        status: 'Error'
      });
    });
});

router.post('/api/newregistration', (req, res) => {
  const {
    userid,
    name,
    gender,
    email_address,
    school_or_college_name,
    class_year,
    city,
    mobile_no,
    password
  } = req.body;
  db.table('newregistration')
    .insert({
      userid,
      name,
      gender,
      email_address,
      school_or_college_name,
      class_year,
      city,
      mobile_no,
      password
    })
    .then((data) => {
      res.status(200).send({
        status: 'User Added successfully',
      });
    })
    .catch((e) => {
      console.log('ERROR', e);
      res.status(500).send({
        status: 'Error'
      });
    });
});

router.post('/api/edxresult', (req, res) => {
  const {
    userid,
    coupon_code,
    pay_amount,
    Intelligence_result,
    Interest_result,
    career_path
  } = req.body;
  db.table('newedxresult')
    .insert({
      userid,
      coupon_code,
      pay_amount,
      Intelligence_result,
      Interest_result,
      career_path
    })
    .then((data) => {
      res.status(200).send({
        status: 'Result Added successfully',
      });
    })
    .catch((e) => {
      console.log('ERROR', e);
      res.status(500).send({
        status: 'Error'
      });
    });
});

router.put('/api/edxresult', (req, res) => {
  const {
    userid,
    coupon_code,
    pay_amount,
    Intelligence_result,
    Interest_result,
    career_path
  } = req.body;

  db.table('newedxresult')
    .where('userid', '=', req.body.userid)
    .first()
    .then(u => {
      db.table('newedxresult')
        .where('userid', '=', req.body.userid)
        .first()
        .update({
          userid,
          coupon_code,
          pay_amount,
          Intelligence_result,
          Interest_result,
          career_path
        })
        .then(f => {
          res.send({
            status: 'success',
            message: 'Result updated added'
          });
        })
        .catch((e) => {
          console.log('ERROR', e);
          res.status(500).send({
            status: 'Error'
          });
        });
    });
});


function parseQueryString(req) {
  let st,
    en,
    searchQuery,
    filter,
    feeFilter,
    startDateFilter,
    provider,
    subjectFilter,
    providerOffsets,
    providerList;
  if (req.query.sort === undefined || req.query.range === undefined) {
    console.log('Here 0');
    st = 0;
    en = 10;
    searchQuery = req.query['q'] || '';
    filter = req.query.filter;
    feeFilter = req.query.feeFilter;
    startDateFilter = req.query.startDateFilter;
    provider = req.query.provider;
    subjectFilter = req.query.subjects;
    providerOffsets = req.query.providerOffset;

    if (providerOffsets === undefined) {
      providerOffsets = [0, 0, 0, 0, 0, 0, 0, 0];
    } else {
      providerOffsets = providerOffsets.split('::').map((s) => (s > 0 ? s : 0));
    }
    // Get providers
    providerList = providersGlobal;
  } else {
    try {
      searchQuery = req.query['q'] || '';
      filter = req.query.filter;
      feeFilter = req.query.feeFilter;
      startDateFilter = req.query.startDateFilter;
      provider = req.query.provider;
      subjectFilter = req.query.subjects;
      st = range[0];
      en = range[1];
      if (providerOffsets === undefined) {
        providerOffsets = [0, 0, 0, 0, 0, 0, 0, 0];
      } else {
        providerOffsets = providerOffsets
          .split('::')
          .map((s) => (s > 0 ? s : 0));
      }
      // Get providers
      providerList = providersGlobal;
    } catch (e) {
      console.log(e);
    }
  }
  console.log({
    providerOffsets
  });
  return [
    st,
    en,
    searchQuery,
    filter,
    feeFilter,
    startDateFilter,
    provider,
    subjectFilter,
    providerOffsets,
    providerList,
  ];
}

router.post('/api/newLoginDetails', (req, res) => {
  db
    .table('newregistration')
    .where('email_address', '=', req.body.email)
    .first()
    .then((user) => {
      res.send({
        data: user
      });
    });
});

router.get('/api/newLogin', (req, res) => {
  db
    .table('newregistration')
    .then((user) => {
      res.send({
        data: user
      });
    });
});


const axios = require('axios');


router.get("/api/getFeedsFutureLearn", async (req, res) => {
  let count  = 0 ;

  try {
    console.log("aaaaa");

    let response = await axios.get('https://www.futurelearn.com/feeds/courses');

    let courses = response.data;

    courses.map( async (course) => {
      let i = 0;

      if (course.organisation.name == 'University of Reading') {
        i = i + 5;

      }
      if (course.organisation.name == 'Lancaster University') {
        i = i + 5;

      }
      if (course.organisation.name == 'University of Birmingham') {
        i = i + 10;

      }
      if (course.organisation.name == 'The University of Sheffield') {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Leicester') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Southampton') {
        i = i + 10;
      }
      if (course.organisation.name == 'The University of Edinburgh') {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Bath') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Strathclyde') {
        i = i + 5;
      }
      if (course.organisation.name == "King's College London") {
        i = i + 10;
      }
      if (course.organisation.name == 'UEA (University of East Anglia)') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Warwick') {
        i = i + 10;
      }
      if (course.organisation.name == 'The Open University') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Nottingham') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Glasgow') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Leeds') {
        i = i + 10;
      }
      if (course.organisation.name == 'British Council') {
        i = i + 5;
      }
      if (course.organisation.name == 'Trinity College Dublin') {
        i = i + 7;
      }
      if (course.organisation.name == 'Newcastle University') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Liverpool') {
        i = i + 5;
      }
      if (course.organisation.name == 'Monash University') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Auckland') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Groningen') {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Bristol') {
        i = i + 10;
      }
      if (course.organisation.name == 'UNSW Sydney') {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Exeter') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Oslo') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Dundee') {
        i = i + 5;
      }
      if (course.organisation.name == 'National Film and Television School') {
        i = i + 5;
      }
      if (course.organisation.name == 'London School of Hygiene & Tropical Medicine') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Cape Town') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Bergen') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Twente') {
        i = i + 5;
      }
      if (course.organisation.name == 'Tel Aviv University & Yad Vashem') {
        i = i + 5;
      }
      if (course.organisation.name == "St George's, University of London") {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Aberdeen') {
        i = i + 5;
      }
      if (course.organisation.name == 'Hans Christian Andersen Centre') {
        i = i + 5;
      }
      if (course.organisation.name == 'Pompeu Fabra University Barcelona') {
        i = i + 5;
      }
      if (course.organisation.name == 'Shanghai International Studies University (SISU)') {
        i = i + 5;
      }
      if (course.organisation.name == 'SOAS University of London') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Basel') {
        i = i + 10;
      }
      if (course.organisation.name == 'UNESCO UNITWIN Complex Systems Digital Campus') {
        i = i + 7;
      }
      if (course.organisation.name == 'Sungkyunkwan University (SKKU)') {
        i = i + 10;
      }
      if (course.organisation.name == 'UNSW Canberra') {
        i = i + 5;
      }
      if (course.organisation.name == 'Universit√© Libre de Bruxelles') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Wollongong') {
        i = i + 5;
      }
      if (course.organisation.name == "The British Film Institute (BFI)") {
        i = i + 5;
      }
      if (course.organisation.name == 'City University of Hong Kong') {
        i = i + 5;
      }
      if (course.organisation.name == 'UCL (University College London)') {
        i = i + 5;
      }
      if (course.organisation.name == 'Royal Holloway, University of London') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Manchester') {
        i = i + 10;
      }
      if (course.organisation.name == 'Keio University') {
        i = i + 5;
      }
      if (course.organisation.name == 'Eindhoven University of Technology') {
        i = i + 5;
      }
      if (course.organisation.name == 'Queensland University of Technology') {
        i = i + 5;
      }
      if (course.organisation.name == 'Cancer Research UK') {
        i = i + 10;
      }
      if (course.organisation.name == 'Universit√† per Stranieri di Siena (UniStraSi)') {
        i = i + 5;
      }
      if (course.organisation.name == 'Health Education England') {
        i = i + 10;
      }
      if (course.organisation.name == 'Stellenbosch University') {
        i = i + 5;
      }
      if (course.organisation.name == 'Weizmann Institute of Science') {
        i = i + 10;
      }
      if (course.organisation.name == 'Cambridge Assessment English') {
        i = i + 7;
      }
      if (course.organisation.name == 'Complutense University of Madrid') {
        i = i + 5;
      }
      if (course.organisation.name == 'National STEM Learning Centre') {
        i = i + 10;
      }
      if (course.organisation.name == 'Hanyang University') {
        i = i + 5;
      }
      if (course.organisation.name == "RMIT University") {
        i = i + 5;
      }
      if (course.organisation.name == 'Goldsmiths, University of London') {
        i = i + 5;
      }
      if (course.organisation.name == 'Durham University') {
        i = i + 5;
      }
      if (course.organisation.name == 'EUMETSAT') {
        i = i + 5;
      }
      if (course.organisation.name == 'Middlesex University Business School') {
        i = i + 7;
      }
      if (course.organisation.name == 'Stockholm Environment Institute') {
        i = i + 5;
      }
      if (course.organisation.name == 'Northumbria University Institute of the Humanities') {
        i = i + 5;
      }
      if (course.organisation.name == 'National Tsing Hua University') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Waikato') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of York') {
        i = i + 10;
      }
      if (course.organisation.name == 'International Confederation of Societies of Authors and Composers (CISAC)') {
        i = i + 7;
      }
      if (course.organisation.name == 'University of Stellenbosch Business School Executive Development') {
        i = i + 5;
      }
      if (course.organisation.name == 'Ambition School Leadership') {
        i = i + 5;
      }
      if (course.organisation.name == "√âcole Nationale de l'Aviation Civile") {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Malaya') {
        i = i + 5;
      }
      if (course.organisation.name == 'Cardiff University') {
        i = i + 5;
      }
      if (course.organisation.name == 'Partnership for Advanced Computing in Europe (PRACE)') {
        i = i + 7;
      }
      if (course.organisation.name == 'Grenoble Ecole de Management') {
        i = i + 5;
      }
      if (course.organisation.name == 'Deakin University') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Kent') {
        i = i + 5;
      }
      if (course.organisation.name == 'International Federation of Red Cross and Red Crescent Societies (IFRC)') {
        i = i + 7;
      }
      if (course.organisation.name == 'Raspberry Pi Foundation') {
        i = i + 7;

      }
      if (course.organisation.name == 'Into Film') {
        i = i + 5;

      }
      if (course.organisation.name == 'The Pennsylvania State University') {
        i = i + 10;

      }
      if (course.organisation.name == 'University of California, Berkeley') {
        i = i + 7;

      }
      if (course.organisation.name == 'Chartered Institute of Building Academy') {
        i = i + 7;

      }
      if (course.organisation.name == 'The Graduate Institute of International and Development Studies') {
        i = i + 7;

      }
      if (course.organisation.name == 'Purdue University') {
        i = i + 10;

      }
      if (course.organisation.name == 'Manchester Metropolitan University') {
        i = i + 5;

      }
      if (course.organisation.name == 'BSAC') {
        i = i + 10;

      }
      if (course.organisation.name == 'Wellcome Genome Campus Advanced Courses and Scientific Conferences') {
        i = i + 7;

      }
      if (course.organisation.name == 'European University Institute (EUI)') {
        i = i + 5;

      }
      if (course.organisation.name == 'Darden School of Business, University of Virginia') {
        i = i + 5;

      }
      if (course.organisation.name == 'Abertay University') {
        i = i + 5;

      }
      if (course.organisation.name == 'Colorado State University') {
        i = i + 5;

      }
      if (course.organisation.name == 'Kogod School of Business at American University') {
        i = i + 5;

      }
      if (course.organisation.name == 'University of Padova') {
        i = i + 5;

      }
      if (course.organisation.name == 'National Chiao Tung University') {
        i = i + 5;

      }
      if (course.organisation.name == 'Humanists UK') {
        i = i + 7;

      }
      if (course.organisation.name == 'Griffith University') {
        i = i + 5;

      }
      if (course.organisation.name == 'Royal Observatory Greenwich') {
        i = i + 7;

      }
      if (course.organisation.name == 'Macmillan Education') {
        i = i + 7;
      }
      if (course.organisation.name == 'Norwegian University of Science and Technology (NTNU)') {
        i = i + 5;

      }
      if (course.organisation.name == 'New York Institute of Finance') {
        i = i + 5;

      }
      if (course.organisation.name == 'EIT InnoEnergy') {
        i = i + 7;

      }
      if (course.organisation.name == 'Universit√† della Svizzera Italiana (USI)') {
        i = i + 5;

      }
      if (course.organisation.name == 'Yad Vashem') {
        i = i + 7;

      }
      if (course.organisation.name == 'Law Society of Scotland') {
        i = i + 5;
      }
      if (course.organisation.name == 'Dublin City University') {
        i = i + 7;
      }
      if (course.organisation.name == "Film Distributors' Association") {
        i = i + 5;
      }
      if (course.organisation.name == 'Murdoch University') {
        i = i + 5;
      }
      if (course.organisation.name == 'The University of Melbourne') {
        i = i + 10;
      }
      if (course.organisation.name == 'Coventry University') {
        i = i + 5;
      }
      if (course.organisation.name == 'Accenture') {
        i = i + 7;
      }
      if (course.organisation.name == 'Trinity Laban Conservatoire of Music and Dance') {
        i = i + 5;
      }
      if (course.organisation.name == 'CIPD - Chartered Institute of Personnel and Development') {
        i = i + 7;
      }
      if (course.organisation.name == 'Cambridge University Press') {
        i = i + 7;
      }
      if (course.organisation.name == 'Universidad Nacional de C√≥rdoba') {
        i = i + 5;
      }
      if (course.organisation.name == 'UNESCO') {
        i = i + 7;
      }
      if (course.organisation.name == 'London College of Fashion') {
        i = i + 5;
      }
      if (course.organisation.name == 'Association for Continence Advice') {
        i = i + 5;
      }
      if (course.organisation.name == 'Swedish University of Agricultural Sciences (SLU)') {
        i = i + 10;
      }
      if (course.organisation.name == 'Vrije Universiteit Amsterdam') {
        i = i + 5;
      }
      if (course.organisation.name == "The King's Fund") {
        i = i + 5;
      }
      if (course.organisation.name == 'Emergency Planning College (EPC)') {
        i = i + 7;
      }
      if (course.organisation.name == 'Aga Khan Trust for Culture') {
        i = i + 5;
      }
      if (course.organisation.name == 'Johns Hopkins University') {
        i = i + 10;
      }
      if (course.organisation.name == 'National Maritime Museum') {
        i = i + 5;
      }
      if (course.organisation.name == 'Hanken School of Economics') {
        i = i + 5;
      }
      if (course.organisation.name == 'ISAE-SUPAERO') {
        i = i + 10;
      }
      if (course.organisation.name == 'Jindal Centre for Social Innovation + Entrepreneurship') {
        i = i + 7;
      }
      if (course.organisation.name == 'EIT Food') {
        i = i + 7;
      }
      if (course.organisation.name == 'British Heart Foundation') {
        i = i + 10;
      }
      if (course.organisation.name == "The University of Newcastle Australia") {
        i = i + 5;
      }
      if (course.organisation.name == "Girls' Day School Trust") {
        i = i + 5;
      }
      if (course.organisation.name == 'Glion Institute of Higher Education') {
        i = i + 5;
      }
      if (course.organisation.name == 'University of Roehampton') {
        i = i + 5;
      }
      if (course.organisation.name == 'Anglia Ruskin University') {
        i = i + 5;
      }
      if (course.organisation.name == 'EIT') {
        i = i + 7;
      }
      if (course.organisation.name == 'NHS Leadership Academy') {
        i = i + 10;
      }
      if (course.organisation.name == 'University of Oxford') {
        i = i + 10;
      }
      if (course.organisation.name == 'Amnesty International') {
        i = i + 7;
      }
      if (course.organisation.name == 'ABRSM') {
        i = i + 7;
      }
      if (course.organisation.name == 'HKU School of Professional and Continuing Education') {
        i = i + 10;
      }
      if (course.organisation.name == 'Chartered College of Teaching') {
        i = i + 5;
      }
      if (course.organisation.name == 'Babcock Education') {
        i = i + 7;
      }
      if (course.organisation.name == 'Fashion Revolution') {
        i = i + 5;
      }
      if (course.organisation.name == 'Nankai University') {
        i = i + 5;
      }
      if (course.organisation.name == 'Chartered Insurance Institute') {
        i = i + 7;
      }
      if (course.organisation.name == 'Institut Fran√ßais de la mode (IFM)') {
        i = i + 5;
      }
      if (course.organisation.name == 'BGI') {
        i = i + 5;
      }

      var desPer, cerPer, runPer, subPer, datePer, orgPer = 0;
      var orgPer = i * 0.15;

      var datePer = 0;
      if (course.runs[0].start_date != null) {

        var datee = course.runs.pop();
        var dte = datee.start_date;
        // console.log(dte);
        var d1 = new Date();
        var dateOne = new Date(d1.getFullYear(), d1.getMonth() + 1, d1.getDate());
        var d2 = dte;
        const myArr = d2.split("-");
        var dateTwo = new Date(myArr[0], myArr[1], myArr[2]);
        if (dateOne < dateTwo) {
          function weeksBetween(dateOne, dateTwo) {
            return Math.round((dateTwo - dateOne) / (7 * 24 * 60 * 60 * 1000));
          }

          var weeks = weeksBetween(dateOne, dateTwo);

          var dt = 0;
          if (weeks <= 1) {
            dt = dt + 10;
          }
          if (weeks == 2) {
            dt = dt + 8;
          }
          if (weeks == 3) {
            dt = dt + 6;
          }
          if (weeks == 4) {
            dt = dt + 4;
          }
          if (weeks >= 5) {
            dt = dt + 2;
          }
          datePer = dt * 0.20;
        }

      }
      if (course.categories != null) {

        if (course.categories[0] == 'Business & Management' || course.categories[1] == 'Business & Management') {
          var subject = 'B';
        }
        if (course.categories[0] == 'Creative Arts & Media' || course.categories[1] == 'Creative Arts & Media') {
          var subject = 'A';
        }
        if (course.categories[0] == 'Health & Psychology' || course.categories[1] == 'Health & Psychology') {
          var subject = 'HL';
        }
        if (course.categories[0] == 'History' || course.categories[1] == 'History') {
          var subject = 'SO';
        }
        if (course.categories[0] == 'Languages & Cultures' || course.categories[1] == 'Languages & Cultures') {
          var subject = 'A';
        }
        if (course.categories[0] == 'Law' || course.categories[1] == 'Law') {
          var subject = 'SO';
        }
        if (course.categories[0] == 'Literature' || course.categories[1] == 'Literature') {
          var subject = 'A';
        }
        if (course.categories[0] == 'Nature & Environment' || course.categories[1] == 'Nature & Environment') {
          var subject = 'SO';
        }
        if (course.categories[0] == 'Politics & the Modern World' || course.categories[1] == 'Politics & the Modern World') {
          var subject = 'SO';
        }
        if (course.categories[0] == 'Science, Engineering & Maths' || course.categories[1] == 'Science, Engineering & Maths') {
          var subject = 'SENG';
        }
        if (course.categories[0] == 'Study Skills' || course.categories[1] == 'Study Skills') {
          var subject = 'O';
        }
        if (course.categories[0] == 'Teaching' || course.categories[1] == 'Teaching') {
          var subject = 'A';
        }
        if (course.categories[0] == 'Tech & Coding' || course.categories[1] == 'Tech & Coding') {
          var subject = 'CS + DEV';
        }
        var sub = 0;
        if (subject == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA') {
          var sub = sub + 10;
        }
        if (subject == 'SENG' || subject == 'M') {
          var sub = sub + 7;
        }
        if (subject == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A') {
          var sub = sub + 5;
        }
      }
      subPer = sub * 0.10;
      if (course.runs != null) {
        var run = 0;
        var keyCount = Object.keys(course.runs).length;
        if (keyCount >= 2) {
          var run = run + 10;
        } else {
          var run = run + 8;
        }
      }
      runPer = run * 0.15;
      // console.log('cert', course.has_certificates);
      var cer = 0;
      if (course.has_certificates == true) {
        cer = cer + 10;
      }
      cerPer = cer * 0.30;

      if (course.description != null) {
        var str = course.description;
        var count = str.length;
        for (var j = 0; j < count; j++) {

        }
        var des = 0;
        if (j >= 200) {
          des = des + 9;
        }
        if (j > 100 && j < 200) {
          var des = des + 10;
        }
        if (j < 100) {
          var des = des + 7;
        }
      }

      desPer = des * 0.10;
      // console.log(des, cer, run, sub, datePer, orgPer);
      var total = desPer + cerPer + runPer + subPer + datePer + orgPer;
      // console.log(i);
      // console.log('totl', total);

      var courseName = course.name;
      var courseTitle = courseName.replace(/"/g, '`');
      var organisationName = course.organisation.name;
      var organisationTitle = organisationName.replace(/"/g, '`');
      var courseEducator = course.educator;
      var courseTeacher = courseEducator.replace(/"/g, '`');
      if (course.categories[0] !== "") {
        var sub1 = course.categories[0];

      } else {
        var sub1 = "NULL";
      }

      if (course.categories[1] !== "") {
        var sub2 = course.categories[1];

      } else {
        var sub2 = "NULL";
      }

      var teacher = "{" + courseTeacher + "}";
      var subj = "{" + sub1 + "','" + sub2 + "}";
      console.log(teacher, subj);
      var k = 0;


              
    // our set of columns, to be created only once (statically), and then reused,
    // to let it cache up its formatting templates for high performance:
    const cs = new pgp.helpers.ColumnSet(['title',
      'start_date',
      'price',
      'uuid',
      'price_currency',
      'subjects',
      'provider',
      'university',
      'rank',
      'ranking_points',
      'has_paid_certificates',
      'url',
      'instructors',
      'description'], {table: 'data'});
        
    // data input values:
    const values = [{
      title: courseTitle,
      start_date: dte,
      price: 0,
      uuid: course.uuid,
      price_currency: "",
      subjects: subj,
      provider: "Future Learn",
      university: organisationTitle,
      rank: "1",
      ranking_points: total,
      has_paid_certificates: course.has_certificates,
      url: course.url,
      instructors: teacher,
      description: course.description
    }];
        
    // generating a multi-row insert query:
    const query = pgp.helpers.insert(values, cs);
    //=> INSERT INTO "tmp"("col_a","col_b") VALUES('a1','b1'),('a2','b2')
        
    // executing the query:
    await DB.none(query).then(()=>{
      console.log("Data Added")
    }).catch(()=>{
      console.log("Not Added")
    });



//map and prosime ends 
  });

    return res.send("all okay")

//try end 
  } catch (e) {
    console.log(e);
    res.send({
      error: e
    });
  }
});

//modified by Yashwant 
const querystring = require('querystring'); 


const tokenGen =  async () => {
  let token = await axios
  .post('https://api.edx.org/oauth2/v1/access_token',querystring.stringify({
    grant_type:"client_credentials",
    client_id:"e9QT5B2V4NT5fsb6WdcG5Va0bOMRJov2QmLpMfEC",
    client_secret:"51wakSoUU02yRQn0iL1NiNYURTSHebD1lEf8H9Slb5xybiGdGz8XByHJlIpMLByf4YO6k9iQ3DllknPWbw9MTqtyb7696w2ArBxo5dPFxr9aTm1OfXFO3VYxSEUjr870",
    token_type:"jwt"
    }),{header : { "Content-Type": 'application/x-www-form-urlencoded'}})

    token = JSON.stringify(token.data.access_token);

    return token;
    
};


router.get("/api/getEdx", async (req, res) => { 

  let token = await tokenGen();

  let len = token.length-2;

  token = token.substr(1,len);

  // console.log(token);

  try {

    let response = await axios.get('https://api.edx.org/catalog/v1/catalogs/548/courses/', {
      headers: {
        'Authorization': `JWT ${token}`
      }
    });


    let nextPage = response.data.next;
    let courses = response.data.results;

    console.log(nextPage)
    let i = 0;

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

    
    while (nextPage != null) {
      ++i;


      courses.map(async (tempresponse) => {
        let i = 0;

        // console.log(tempresponse.course_runs[0].start);
        // console.log(tempresponse.course_runs[0].full_description);
        // console.log(tempresponse.course_runs[0].staff[0].enrollment_count);
        // console.log(tempresponse.subjects[0].name);
        // console.log(tempresponse.course_runs[0].seats[0].price);
        // console.log(tempresponse.owners[0].name);
        // console.log(tempresponse.course_runs[0].title);

        var university = tempresponse.owners[0].name;
        if (university == 'The University of Queensland') {
          i = i + 10;
        }
        if (university == 'The University of California, San Diego') {
          i = i + 10;
        }
        if (university == 'Delft University of Technology') {
          i = i + 10;
        }
        if (university == 'The University of Maryland, College Park, University System of Maryland') {
          i = i + 5;
        }
        if (university == 'RWTH Aachen University') {
          i = i + 5;
        }
        if (university == 'Rochester Institute of Technology') {
          i = i + 5;
        }
        if (university == 'Curtin University') {
          i = i + 5;
        }
        if (university == 'The World Wide Web Consortium (W3C)') {
          i = i + 7;
        }
        if (university == 'Chalmers University of Technology') {
          i = i + 5;
        }
        if (university == 'The Georgia Institute of Technology') {
          i = i + 10;
        }
        if (university == 'The University of Michigan, Microsoft In Education') {
          i = i + 10;
        }
        if (university == 'University of Pennsylvania') {
          i = i + 10;
        }
        if (university == 'Inter-American Development Bank') {
          i = i + 5;
        }
        if (university == 'Indiana University') {
          i = i + 5;
        }
        if (university == 'The Wharton School of the University of Pennsylvania') {
          i = i + 10;
        }
        if (university == 'University System of Maryland, UMUC') {
          i = i + 5;
        }
        if (university == 'Davidson Next') {
          i = i + 5;
        }
        if (university == 'Massachusetts Institute of Technology') {
          i = i + 10;
        }
        if (university == 'The Hong Kong Polytechnic University') {
          i = i + 10;
        }
        if (university == 'IsraelX') {
          i = i + 5;
        }
        if (university == 'Wageningen University & Research') {
          i = i + 10;
        }
        if (university == 'Delft University of Technology, Wageningen University & Research, DelftWageningenX') {
          i = i + 10;
        }
        if (university == 'Indian Institute of Management Bangalore') {
          i = i + 10;
        }
        if (university == 'UMUC, University System of Maryland') {
          i = i + 5;
        }
        if (university == 'University of Adelaide') {
          i = i + 5;
        }
        if (university == 'The Hong Kong University of Science and Technology') {
          i = i + 10;
        }
        if (university == 'Dartmouth College') {
          i = i + 5;
        }
        if (university == 'The University of Michigan') {
          i = i + 5;
        }
        if (university == 'Dartmouth College, IMT') {
          i = i + 5;
        }
        if (university == 'World Bank Group') {
          i = i + 7;
        }
        if (university == 'Wits University') {
          i = i + 5;
        }
        if (university == 'Weston High School') {
          i = i + 5;
        }
        if (university == 'Wellesley College') {
          i = i + 10;
        }
        if (university == 'Waseda University') {
          i = i + 5;
        }
        if (university == 'Victoria University of Wellington') {
          i = i + 5;
        }
        if (university == 'Ural Federal University') {
          i = i + 5;
        }
        if (university == 'University of Washington') {
          i = i + 10;
        }
        if (university == 'University of Toronto') {
          i = i + 10;
        }
        if (university == 'University of Maryland, Baltimore, University System of Maryland') {
          i = i + 5;
        }
        if (university == 'University of Hong Kong') {
          i = i + 10;
        }
        if (university == 'University of California, Berkeley') {
          i = i + 5;
        }
        if (university == 'University of British Columbia') {
          i = i + 10;
        }
        if (university == 'Universidad Galileo') {
          i = i + 5;
        }
        if (university == 'Universidad del Rosario') {
          i = i + 5;
        }
        if (university == 'UMUC, University of Maryland, Baltimore, University System of Maryland') {
          i = i + 5;
        }
        if (university == 'Tsinghua University') {
          i = i + 10;
        }
        if (university == 'Tokyo Institute of Technology') {
          i = i + 5;
        }
        if (university == 'The University of Tokyo') {
          i = i + 10;
        }
        if (university == 'The University of Texas of the Permian Basin') {
          i = i + 5;
        }
        if (university == 'The University of Texas MD Anderson Cancer Center in Houston') {
          i = i + 5;
        }
        if (university == 'The University of Texas Health Science Center at Houston (UTHealth) School of Public Health') {
          i = i + 5;
        }
        if (university == 'The University of Texas at Austin') {
          i = i + 10;
        }
        if (university == 'The University of Queensland, Microsoft In Education') {
          i = i + 5;
        }
        if (university == 'The University of Newcastle, Australia') {
          i = i + 5;
        }
        if (university == 'The University of Maryland Eastern Shore, University System of Maryland') {
          i = i + 5;
        }
        if (university == 'The University of Iceland') {
          i = i + 5;
        }
        if (university == 'The University of Edinburgh') {
          i = i + 5;
        }
        if (university == 'The Smithsonian Institution') {
          i = i + 5;
        }
        if (university == 'The Linux Foundation') {
          i = i + 7;
        }
        if (university == 'The Islamic Research and Training Institute') {
          i = i + 5;
        }
        if (university == 'The International Monetary Fund') {
          i = i + 7;
        }
        if (university == 'TenarisUniversity') {
          i = i + 5;
        }
        if (university == 'seakademieX') {
          i = i + 5;
        }
        if (university == 'SDG Academy') {
          i = i + 5;
        }
        if (university == 'SchoolYourself') {
          i = i + 5;
        }
        if (university == 'Rice University') {
          i = i + 5;
        }
        if (university == 'Red Hat') {
          i = i + 5;
        }
        if (university == 'Purdue University') {
          i = i + 10;
        }
        if (university == 'Princeton University') {
          i = i + 10;
        }
        if (university == 'Pontificia Universidad Javeriana') {
          i = i + 5;
        }
        if (university == 'Perkins School for the Blind') {
          i = i + 5;
        }
        if (university == 'Peking University') {
          i = i + 10;
        }
        if (university == 'NYIF') {
          i = i + 10;
        }
        if (university == 'NUST MISIS') {
          i = i + 5;
        }
        if (university == 'New York University') {
          i = i + 10;
        }
        if (university == 'National Research Nuclear University') {
          i = i + 10;
        }
        if (university == 'MongoDB University') {
          i = i + 7;
        }
        if (university == 'Microsoft') {
          i = i + 7;
        }
        if (university == 'Massachusetts Institute of Technology, University of Pennsylvania') {
          i = i + 10;
        }
        if (university == 'MandarinX') {
          i = i + 7;
        }
        if (university == 'LOGYCA') {
          i = i + 5;
        }
        if (university == 'Kyoto University') {
          i = i + 10;
        }
        if (university == 'KU Leuven University') {
          i = i + 5;
        }
        if (university == 'KTH Royal Institute of Technology') {
          i = i + 5;
        }
        if (university == 'KIx: Karolinska Institutet') {
          i = i + 5;
        }
        if (university == 'ITMO University') {
          i = i + 5;
        }
        if (university == 'IMT') {
          i = i + 5;
        }
        if (university == 'Imperial College London, Imperial College Business School') {
          i = i + 10;
        }
        if (university == 'Imperial College London') {
          i = i + 10;
        }
        if (university == 'Imperial College Business School, Imperial College London') {
          i = i + 10;
        }
        if (university == 'Imperial College Business School') {
          i = i + 10;
        }
        if (university == 'IITBombay') {
          i = i + 10;
        }
        if (university == 'IBM') {
          i = i + 10;
        }
        if (university == 'Harvard University') {
          i = i + 10;
        }
        if (university == 'Hamad Bin Khalifa University') {
          i = i + 5;
        }
        if (university == 'Georgetown University') {
          i = i + 5;
        }
        if (university == 'Fullbridge') {
          i = i + 7;
        }
        if (university == 'ETH Zurich') {
          i = i + 10;
        }
        if (university == 'edX') {
          i = i + 7;
        }
        if (university == 'Educational Testing Service') {
          i = i + 7;
        }
        if (university == 'Doane University') {
          i = i + 5;
        }
        if (university == 'Delft University of Technology, RWTH Aachen University, DelftXRWTHx') {
          i = i + 7;
        }
        if (university == 'Davidson College') {
          i = i + 10;
        }
        if (university == 'Cornell University, The University of Queensland, CornellX_UQx') {
          i = i + 10;
        }
        if (university == 'Cornell University') {
          i = i + 10;
        }
        if (university == 'Columbia University') {
          i = i + 10;
        }
        if (university == 'Catalyst') {
          i = i + 7;
        }
        if (university == 'Caltech') {
          i = i + 10;
        }
        if (university == 'Brown University') {
          i = i + 10;
        }
        if (university == 'Boston University') {
          i = i + 10;
        }
        if (university == 'Babson College') {
          i = i + 5;
        }
        if (university == 'Australian National University') {
          i = i + 10;
        }
        if (university == 'Arizona State University') {
          i = i + 5;
        }
        if (university == 'Amnesty International') {
          i = i + 7;
        }
        if (university == 'Amnesty International') {
          i = i + 7;
        }
        if (university == 'Amazon Web Services') {
          i = i + 7;
        }
        if (university == 'AfghanX') {
          i = i + 5;
        }
        if (university == 'ACCA') {
          i = i + 7;
        }

        if (tempresponse.course_runs[0].start != null) {



          var d1 = new Date();
          var dateOne = new Date(d1.getFullYear(), d1.getMonth() + 1, d1.getDate());
          var dateTwo = tempresponse.course_runs[0].start;
          var dt = 0;
          if (dateOne < dateTwo) {
            function weeksBetween(dateOne, dateTwo) {
              return Math.round((dateTwo - dateOne) / (7 * 24 * 60 * 60 * 1000));
            }
            var weeks = weeksBetween(dateOne, dateTwo);
            if (weeks <= 1) {
              dt = dt + 10;
            }
            if (weeks == 2) {
              dt = dt + 8;
            }
            if (weeks == 3) {
              dt = dt + 6;
            }
            if (weeks == 4) {
              dt = dt + 4;
            }
            if (weeks >= 5) {
              dt = dt + 2;
            } else {
              dt = 10;
            }
          }

        }
        if (tempresponse.course_runs[0].full_description != null) {
          var str = tempresponse.course_runs[0].full_description;
          var count = str.length;
          for (var j = 0; j < count; j++) {

          }
          var des = 0;
          if (j >= 100) {
            des = des + 10;
          }
          if (j < 100) {
            des = des + 8;
          }
        }

        var desTot = des * 0.05;
        if (tempresponse.course_runs[0].enrollment_count != null) {
          var ec = 0;
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 30000) {
            ec = ec + 10;
          }
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 20000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 30000) {
            ec = ec + 9.5;
          }
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 10000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 20000) {
            ec = ec + 9;
          }
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 5000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 10000) {
            ec = ec + 8.5;
          }
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 1000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 5000) {
            ec = ec + 8;
          }
          if (tempresponse.course_runs[0].staff[0].enrollment_count > 1000) {
            ec = ec + 7.5;
          }
        }
        if (tempresponse.subjects[0].name != null) {


          if (tempresponse.subjects[0].name == 'Business & Management') {
            var subject = 'B';
          }
          if (tempresponse.subjects[0].name == 'Computer Science') {
            var subject = 'CS';
          }
          if (tempresponse.subjects[0].name == 'Humanitites') {
            var subject = 'A';
          }
          if (tempresponse.subjects[0].name == 'Data Analysis & Statistics') {
            var subject = 'DA';
          }
          if (tempresponse.subjects[0].name == 'Language') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Architecture') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Biology & Life Sciences') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Chemistry') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Communication') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Design') {
            var subject = 'A';
          }
          if (tempresponse.subjects[0].name == 'Economics & Finance') {
            var subject = 'B';
          }
          if (tempresponse.subjects[0].name == 'Education & Teacher Training') {
            var subject = 'A';
          }
          if (tempresponse.subjects[0].name == 'Electronics') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Energy & Earth Sciences') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Engineering') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Environmental Studies') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Ethics') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Food & Nutrition') {
            var subject = 'HL';
          }
          if (tempresponse.subjects[0].name == 'Health & Safety') {
            var subject = 'HL';
          }
          if (tempresponse.subjects[0].name == 'History') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Law') {
            var subject = 'SO';
          }
          if (tempresponse.subjects[0].name == 'Literature') {
            var subject = 'A';
          }
          if (tempresponse.subjects[0].name == 'Math') {
            var subject = 'M';
          }
          if (tempresponse.subjects[0].name == 'Medicine') {
            var subject = 'HL';
          }
          if (tempresponse.subjects[0].name == 'Music') {
            var subject = 'A';
          }
          if (tempresponse.subjects[0].name == 'Philanthropy') {
            var subject = 'O';
          }
          if (tempresponse.subjects[0].name == 'Philosophy & Ethics') {
            var subject = 'O';
          }
          if (tempresponse.subjects[0].name == 'Physics') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Science') {
            var subject = 'SENG';
          }
          if (tempresponse.subjects[0].name == 'Social Sciences') {
            var subject = 'SO';
          }



          var sub = 0;
          if (subject == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA') {
            var sub = sub + 10;
          }
          if (subject == 'SENG' || subject == 'M') {
            var sub = sub + 7;
          }
          if (subject == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A') {
            var sub = sub + 5;
          }
        }


        if (tempresponse.course_runs[0].seats[0].price != null) {
          var pp = 0;
          if (tempresponse.course_runs[0].seats[0].price >= 10000) {
            pp = +10;
          }
          if (tempresponse.course_runs[0].seats[0].price >= 5000 && tempresponse.course_runs[0].seats[0].price < 10000) {
            pp = pp + 9;
          }
          if (tempresponse.course_runs[0].seats[0].price <= 5000) {
            pp = pp + 8;
          }
          if (tempresponse.course_runs[0].seats[0].price == 'free') {
            pp = pp + 8;
          }
        }


        if (tempresponse.course_runs[0].title != null) {
          var run = 0;
          var keyCount = Object.keys(tempresponse.course_runs).length;
          if (keyCount >= 2) {
            run = run + 10;
          } else {
            run = run + 8;
          }
        }

        var runTot = run * 0.15;
        var priTot = pp * 0.15;
        var subTot = sub * 0.10;
        var enrTot = ec * 0.20;
        var dateTot = dt * 0.20;
        var ownTot = i * 0.15;
        var total = runTot + priTot + subTot + enrTot + desTot + dateTot + ownTot;



        var courseTitleEdx = tempresponse.title;
        var uuidEdx = tempresponse.course_runs[0].uuid;
        var startDateEdx = tempresponse.course_runs[0].start;
        var priceEdx = tempresponse.course_runs[0].seats[0].price;
        var currencyEdx = tempresponse.course_runs[0].seats[0].currency;
        var subjectEdx = "{" + tempresponse.subjects[0].name + "}";
        var universityEdx = university;
        if (tempresponse.owners[0].certificate_logo_image_url != null) {
          var certificate = true;
        } else {
          var certificate = false;
        }
        var urlEdx = tempresponse.course_runs[0].marketing_url;
        var instructorsEdx = "{" + tempresponse.course_runs[0].staff[0].given_name + "}";


        function create_UUID() {
          var dt = new Date().getTime();
          var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (dt + Math.random() * 16) % 16 | 0;
            dt = Math.floor(dt / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
          return uuid;
        }

        // console.log(create_UUID());

         // our set of columns, to be created only once (statically), and then reused,
    // to let it cache up its formatting templates for high performance:
    const cs = new pgp.helpers.ColumnSet([
    'title',
    'start_date',
    'price',
    'uuid',
    'price_currency',
    'subjects',
    'provider',
    'university',
    'rank',
    'ranking_points',
    'has_paid_certificates',
    'url',
    'instructors',
    'description'], {table: 'data'});
      
  // data input values:
  const values = [{
    title: courseTitleEdx,
    start_date: startDateEdx,
    price: priceEdx,
    uuid: create_UUID(),
    price_currency: currencyEdx,
    subjects: subjectEdx,
    provider: "edX",
    university: universityEdx,
    rank: 1,
    ranking_points: total,
    has_paid_certificates: certificate,
    url: urlEdx,
    instructors: instructorsEdx,
    description: tempresponse.course_runs[0].full_description
  }];
      

  // generating a multi-row insert query:
  const query = pgp.helpers.insert(values, cs);

      
  // executing the query:
  await DB.none(query).then(()=>{
    console.log("Data Added")
  }).catch(()=>{
    console.log("Not Added")
  });

//map ends
      });

      delay(60000); // 1 minute hold 

      let tempresponse = await axios.get(nextPage, {
        headers: {
          'Authorization': `JWT ${token}`
        }
      }).then((response)=>{
        nextPage = response.data.next;
        courses = response.data.results;
        console.log(nextPage);
      }).catch((err)=>{

        nextPage = null;
        if(err.Error == "Request failed with status code 429")
        {
          console.log("Error"+err)
        }
      });

 //com     
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json(e.toString()).end();
  }

});



router.get('/api/getFeedsList', async (req, res) => {
  let i = 10;
  const interval = setInterval(()=>{
    console.log(i);
    i--;
    if(i<0)
    {
      console.log("clear");
      clearInterval(interval);
      return res.send("done");

    }
  },2000)

});




router.post('/api/getFeedsList', async (req, res) => {
  let provider = req.body.provider;
  let uuid = req.body.uuid;
  const dataModel = await db.table('data').where({
    uuid: uuid,
    provider: provider
  })
  console.log("completed", dataModel);
  const data = await dataModel;
  res.send({
    data
  });
});

export default router;
