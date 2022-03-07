// const pgp = require("pg-promise")({
//   capSQL: true // generate capitalized SQL 
// });

// const xml2js = require('xml2js');

// const cron = require('node-cron');

// import DB from '../mydb';

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

import {CourseraUniversityList,
  EdxUniversityList,
  EdxSubjectList,
  FLUniversityList,
  FLSubjectList} from '../List_Of_University';


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
      // qb.whereNotNull('price');
      qb.where('price', '<>', 0);
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
          qb.where('price','>',0);
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
        console.log(">>>>>>>>>>>>>>>>",finalData);
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

//  this function or uses for converting the currency into the rupee fromate 

async function converter (currency,amount){

  let  url = `https://freecurrencyapi.net/api/v2/latest?apikey=45f68830-84f3-11ec-8258-811245eebca2&base_currency=${currency}`;

  await axios.get(url).then((response)=>{
    amount *= response.data.data.INR;
    console.log(amount)
    return (amount)
  })

}


// function created by yashwant sahu for the internal tracking purpouses (Yashwant Sahu)

async function tracker(title,updateEn = false){
  
  let data = await db
      .table('trackRecord')
      .where({
        title
      })
      .first()
      .then(async(resData) => {

        if(resData !== undefined)
        {
          console.log(resData.card_click);
          if(updateEn === true)
          {
            let done = await db.table('trackRecord').where('title','=',title)
            .update({
              eroll_now_click :resData.eroll_now_click +1
            })
          }
          else{
            let done = await db.table('trackRecord').where('title','=',title)
            .update({
              card_click: resData.card_click+1
            })
          }
          
      }
      else{
          let done = await db.table('trackRecord').insert([{title,card_click : 1}])
          // console.log("++++++",done);
        }
      });
  

}

// route for tracking

router.get('/api/track', async (req, res) => {
  
  await tracker(req.query.title,true);
  res.send('All Okay');
})


router.get('/api/course/', async (req, res) => {
  console.log("Yashwant");

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

  
  // converting the price into INR
  
  let  url = `https://freecurrencyapi.net/api/v2/latest?apikey=45f68830-84f3-11ec-8258-811245eebca2&base_currency=${summaryData.price_currency}`;
  
  await axios.get(url).then((response)=>{
    summaryData.price *= response.data.data.INR;
  })

  // here we update the internal tracker
  tracker(summaryData.title);
  
  console.log("======",summaryData);

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


router.get("/api/univer", async (req, res) => {
  console.log("Hit")
  console.log(FLSubjectList)


})


router.get("/api/printUni", async (req, res) => { 
  console.log(EdxSubjectList)
  // console.log(CourseraUniversityList)
  res.send(EdxSubjectList)
})


// get the EdX coureses ======================================
// ++++++++++++++++++++++++++++++++========================================

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




// router.get('/api/getFeedsList', async (req, res) => {
//   let i = 10;
//   const interval = setInterval(()=>{
//     console.log(i);
//     i--;
//     if(i<0)
//     {
//       console.log("clear");
//       clearInterval(interval);
//       return res.send("done");

//     }
//   },2000)

// });




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
