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

// router.get('/api/refresh/futurelearn', async (req, res) => {
//   const summaryData = await db.table('data').where({
//     provider: 'FutureLearn'
//   });

//   for (let course of summaryData) {
//     const resp = await fetch(course.url);
//     try {
//       const text = await resp.text();
//       const html = parse(text);
//       const price = html
//         .querySelectorAll('.m-comparison__sub-heading')[1].text.substring(1);
//       const query = db
//         .table('data')
//         .where('index', '=', course.index)
//         .update({
//           price
//         });
//       console.log(query.toString());
//       await query.catch((err) => {
//         console.error('Error while inserting price in database ', err);
//       });
//     } catch (err) {
//       console.error(err);
//     }
//   }
//   res.send({
//     status: 'Working on it',
//   });
// });

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
  console.log("Data Updating ",req.body)
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
    }).onConflict('email_address')
    .merge()
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
  console.log("New Login Occure",req.body.email)
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
    }).catch((err)=>res.send(err));
});


const axios = require('axios');


router.get("/api/univer", async (req, res) => {
  console.log("Hit")
  console.log(FLSubjectList)


})


// Fetching the Future Learn Courses ++++++++++++++++++++++++++++++++++
// ++++++++++=======================


router.get("/api/getFeedsFutureLearn", async (req, res) => {
  let count  = 0 ;

  try {
    console.log("Let's Fetch the Future Leaarn");

    let response = await axios.get('https://www.futurelearn.com/feeds/courses');

    let courses = response.data;

    // course.organisation.name

    courses.map( async (course) => {
     
      // edited by  yashwant sahu
      // UniverSity


      var UniverRank = 0;
              
      if(FLUniversityList[course.organisation.name] === undefined)
        UniverRank = 5 * 0.15
      else
        UniverRank = FLUniversityList[course.organisation.name] * 0.15;

      // console.log("s++++",SubRank);
      // console.log("u++++",UniverRank);

      var desPer, cerPer, runPer, subPer, datePer;

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
    

       var SubRank = 0;
        let CBSubject;

        if (course.categories != null) {

        
          if(FLSubjectList[course.categories[0]] === undefined && FLSubjectList[course.categories[1]] === undefined )
          {
            SubRank += (5 * 0.10)
            CBSubject = "Others"

          }
          else
          {
                let subject = '';

                if(FLSubjectList[course.categories[0]] !== undefined)
                       subject  = FLSubjectList[course.categories[0]];
                else 
                       subject  = FLSubjectList[course.categories[1]];

                  
            if (subject == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA') {
              
              SubRank +=  (10 * 0.10);
              
              if(subject  == 'CS')
              CBSubject = "Computer Science"
              else if (subject == 'B')
              CBSubject = 'Business'
              else if (subject == 'DEV')
              CBSubject = 'Developers/Programming'
              else
              CBSubject = 'Math'


            }

            else if (subject == 'SENG' || subject == 'M') {
              SubRank +=  (7* 0.10);

              if(subject  == 'SENG')
              CBSubject = "Science & Engineering"
              else 
              CBSubject = 'Math'


            }
            else if (subject == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A') {
              SubRank +=  (5* 0.10);

              if(subject  == 'SO')
              CBSubject = "Social Studies"
              else if (subject == 'O')
              CBSubject = 'Others'
              else if (subject == 'HL')
              CBSubject = 'Health & Lifestyle'
              else
              CBSubject = 'Arts & Design'

            }

          }
        }

        // console.log("Provided ++++ ",course.categories," ++ CB ++ ",CBSubject)


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
      var total = desPer + cerPer + runPer + SubRank + datePer + UniverRank;
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
        var sub1 = course.categories[1];
      }


      var teacher = "{" + courseTeacher + "}";
      var subj = "{" + sub1 + "','" + CBSubject + "}";
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
      'description',
      'unique_id'], {table: 'data'});
        
    // data input values:
    const values = [{
      title: courseTitle,
      start_date: dte,
      price: null,
      uuid: course.uuid,
      price_currency: "USD",
      subjects: subj,
      provider: "FutureLearn",
      university: organisationTitle,
      rank: "1",
      ranking_points: total,
      has_paid_certificates: course.has_certificates,
      url: `https://click.linksynergy.com/deeplink?id=aEDzMt9EP*4&mid=42801&murl=${course.url}`,
      instructors: teacher,
      description: course.description,
      unique_id :course.uuid
    }];
        
    // generating a multi-row insert query:
    const query = pgp.helpers.insert(values, cs);
    //=> INSERT INTO "tmp"("col_a","col_b") VALUES('a1','b1'),('a2','b2')
        
    // executing the query:
    await DB.none(query).then(()=>{
      console.log("Data Added")
    }).catch((err)=>{
      console.log('ERROR:',err)
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



router.get("/api/getEdx", async (req, res) => { 

  let token = await tokenGen();

  let len = token.length-2;

  token = token.substr(1,len);

  console.log("Let's fetch the Edx ")

  // console.log(token);

  try {

    let offset = 0;

    let response = await axios.get('https://discovery.edx.org/api/v1/catalogs/548/courses/?limit=20&offset=0', {
      headers: {
        'Authorization': `JWT ${token}`
      }
    });


    let nextPage = response.data.next;
    let courses = response.data.results;

    async function callIt(offset){
      console.log(offset)
      let tempresponse = await axios.get(`https://discovery.edx.org/api/v1/catalogs/548/courses/?limit=20&offset=${offset}`, {
      headers: {
        'Authorization': `JWT ${token}`
      }
    }).then((response)=>{
      nextPage = response.data.next;
      courses = response.data.results;
    }).catch((err)=>{

      nextPage = null;
      if(err.Error == "Request failed with status code 429")
      {
        console.log("Error"+err)
      }
    });

    }

    let id = setInterval(()=> {
      
      courses.map(async (tempresponse) => {
        // console.log(tempresponse.course_runs[0].title)
        
        
  // duratation
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
            else if (weeks == 2) {
              dt = dt + 8;
            }
            else if (weeks == 3) {
              dt = dt + 6;
            }
            else if (weeks == 4) {
              dt = dt + 4;
            }
            else if (weeks >= 5) {
              dt = dt + 2;
            } 
            else {
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

        var ec = 8;
      // enrollment count   
        if (tempresponse.course_runs[0].enrollment_count != null) {
          if (tempresponse.course_runs[0].staff[0].enrollment_count >= 30000) {
            ec = ec + 10;
          }
          else if (tempresponse.course_runs[0].staff[0].enrollment_count >= 20000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 30000) {
            ec = ec + 9.5;
          }
          else if (tempresponse.course_runs[0].staff[0].enrollment_count >= 10000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 20000) {
            ec = ec + 9;
          }
          else if (tempresponse.course_runs[0].staff[0].enrollment_count >= 5000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 10000) {
            ec = ec + 8.5;
          }
          else if (tempresponse.course_runs[0].staff[0].enrollment_count >= 1000 && tempresponse.course_runs[0].staff[0].enrollment_count <= 5000) {
            ec = ec + 8;
          }
          else if (tempresponse.course_runs[0].staff[0].enrollment_count > 1000) {
            ec = ec + 7.5;
          }
        }

        // subject
        
        var SubRank = 0;
        let CBSubject;

        if (tempresponse.subjects[0].name != null) {

        
          if(EdxSubjectList[tempresponse.subjects[0].name] === undefined)
          {
            SubRank += (5 * 0.10)
            CBSubject = "Others"

          }
          else
          {
            let subject  = EdxSubjectList[tempresponse.subjects[0].name];
            if (subject == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA') {
              
              SubRank +=  (10 * 0.10);
              
              if(subject  == 'CS')
              CBSubject = "Computer Science"
              else if (subject == 'B')
              CBSubject = 'Business'
              else if (subject == 'DEV')
              CBSubject = 'Developers/Programming'
              else
              CBSubject = 'Math'


            }

            else if (subject == 'SENG' || subject == 'M') {
              SubRank +=  (7* 0.10);

              if(subject  == 'SENG')
              CBSubject = "Science & Engineering"
              else 
              CBSubject = 'Math'


            }
            else if (subject == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A') {
              SubRank +=  (5* 0.10);

              if(subject  == 'SO')
              CBSubject = "Social Studies"
              else if (subject == 'O')
              CBSubject = 'Others'
              else if (subject == 'HL')
              CBSubject = 'Health & Lifestyle'
              else
              CBSubject = 'Arts & Design'

            }

          }
        }

        // price 

        if (tempresponse.course_runs[0].seats[0].price != null) {
          var pp = 0;
          if (tempresponse.course_runs[0].seats[0].price >= 10000) {
            pp = +10;
          }
          else if (tempresponse.course_runs[0].seats[0].price >= 5000 && tempresponse.course_runs[0].seats[0].price < 10000) {
            pp = pp + 9;
          }
          else if (tempresponse.course_runs[0].seats[0].price <= 5000) {
            pp = pp + 8;
          }
          else if (tempresponse.course_runs[0].seats[0].price == 'free') {
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


// edited by  yashwant sahu
// UniverSity
           var UniverRank = 0;
        
           if(EdxUniversityList[tempresponse.owners[0].name] === undefined)
             UniverRank = 5 * 0.15
           else
             UniverRank = EdxUniversityList[tempresponse.owners[0].name] * 0.15;
        
        // console.log("s++++",SubRank);
        // console.log("u++++",UniverRank);

        

        var runTot = run * 0.15;
        var priTot = pp * 0.15;
        var enrTot = ec * 0.20;
        var dateTot = dt * 0.20;


        var total = runTot + priTot + SubRank + enrTot + desTot + dateTot + UniverRank;

        var courseTitleEdx = tempresponse.title;
        var uuidEdx = tempresponse.course_runs[0].uuid;
        var startDateEdx = tempresponse.course_runs[0].start;
        var priceEdx = tempresponse.course_runs[0].seats[0].price;
        var currencyEdx = tempresponse.course_runs[0].seats[0].currency;
        var subjectEdx = `{"${tempresponse.subjects[0].name}","${CBSubject}"}`;
        var universityEdx = tempresponse.owners[0].name;
        if (tempresponse.owners[0].certificate_logo_image_url != null) {
          var certificate = true;
        } else {
          var certificate = false;
        }
        var urlEdx = `https://www.awin1.com/cread.php?awinmid=6798&awinaffid=658875&clickref=&ued=${tempresponse.course_runs[0].marketing_url}`;
        let instructorsEdx = `{"${tempresponse.course_runs[0].staff[0].given_name} ${tempresponse.course_runs[0].staff[0].family_name}"}`

        // console.log(subjectEdx)

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
    'description','unique_id'], {table: 'data'});
      
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
    description: tempresponse.course_runs[0].full_description,
    unique_id :tempresponse.uuid
  }];
      

  // generating a multi-row insert query:
  const query = pgp.helpers.insert(values, cs);

      
  // executing the query:
  await DB.none(query).then(()=>{
    console.log("Data Added")
  }).catch((err)=>{
    console.log(err)
    console.log("Not Added")
  });

//map ends
      });
      
      if(nextPage == null)
      {
        clearInterval(id);
        return res.send("All Done")
      }
      else {
          console.log('URL Hit == ',nextPage);
          offset+=20;
          callIt(offset);
        }
  
 //com     
    },30000)
  } catch (e) {
    console.log(e);
    return res.status(500).json(e.toString()).end();
  }

});


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


// Get the Udemy Courses ===============================================
//=======================================================================

// router.get('/api/getUdemy',async (req,res)=>{

//   console.log("Let's Goo for Udemy !!!")
  
//   var xml = require('fs').readFileSync('routes/data/udemy.xml', 'utf8');
  
//   try {
//     xml2js.parseString(xml, (err, result) => {
//       console.log("Parsing Complete !!!",result)
//       if (err) {
//         throw err;
//       }
//       var i = 0;
//       Promise.all(result.merchandiser.product.map(async (tempresponse) => {

//         if (tempresponse.m1 != null) {
//           var rating = tempresponse.m1.toString();
//           // console.log(typeof rating);
//           var rate = rating.split("~~");
//           // console.log(rate);
//           var ratee = rate.toString();
//           var splitrating = ratee.split(">>");
//           var split = splitrating.toString();
//           var ra = split.split(",");

//           if (ra[1] >= 4.5) {
//             var finalrating = 10;
//           }
//           if (ra[1] >= 4.0 || ra[1] < 4.5) {
//             var finalrating = 9;
//           }
//           if (ra[1] >= 3.5 || ra[1] < 4.0) {
//             var finalrating = 8;
//           }
//           if (ra[1] <= 3.5) {
//             var finalrating = 6;
//           }

//           if (ra[5] >= 1000) {
//             var review = 10;
//           }
//           if (ra[5] < 1000) {
//             var review = 8;
//           }
//         }
//         var rat = finalrating * 0.30;
//         var rev = review * 0.25;
//         let CBSubject;
//         if (tempresponse.category != null) {
//           var course = tempresponse.category;
//           if (course[0].primary[0] == 'Business') {
//             var subject = 'B';
//             CBSubject = "Business"
//           }
//           if (course[0].primary[0] == 'Design') {
//             var subject = 'A';
//             CBSubject = "Arts & Design"
//           }
//           if (course[0].primary[0] == 'Development') {
//             var subject = 'DEV';
//             CBSubject = "Developers/Programming"
//           }
//           if (course[0].primary[0] == 'Health & Fitness') {
//             var subject = 'HL';
//             CBSubject = "Health & Lifestyle"
//           }
//           if (course[0].primary[0] == 'It & Software') {
//             var subject = 'CS + DEV';
//             CBSubject = "Computer Science"
//           }
//           if (course[0].primary[0] == 'Lifestyle') {
//             var subject = 'HL';
//             CBSubject = "Health & Lifestyle"
//           }
//           if (course[0].primary[0] == 'Marketing') {
//             var subject = 'B';
//             CBSubject = "Business"
//           }
//           if (course[0].primary[0] == 'Music') {
//             var subject = 'A';
//             CBSubject = "Arts & Design"
//           }
//           if (course[0].primary[0] == 'Office Productivity') {
//             var subject = 'O';
//             CBSubject = "Health & Lifestyle"
//           }
//           if (course[0].primary[0] == 'Personal Development') {
//             var subject = 'O';
//             CBSubject = "Health & Lifestyle"
//           }
//           if (course[0].primary[0] == 'Photography') {
//             var subject = 'A';
//             CBSubject = "Others"
//           }
//           if (course[0].primary[0] == 'Teaching & Academics') {
//             var subject = 'A';
//             CBSubject = "Social Studies"
//           }


//           // var subb = 0;
//           if (subject == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA') {
//             var subb = 10;
//           }
//           if (subject == 'SENG' || subject == 'M') {
//             var subb = 7;
//           }
//           if (subject == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A') {
//             var subb = 5;
//           }
//         }

//         var subcount = subb * 0.15;

//         if (tempresponse.price != null) {
//           if (tempresponse.price[0].retail[0] >= 5000) {
//             var price = 10;
//           }
//           if (tempresponse.price[0].retail[0] > 1000 || tempresponse.price[0].retail[0] < 5000) {
//             var price = 9;
//           }
//           if (tempresponse.price[0].retail[0] <= 1000) {
//             var price = 8;
//           }
//           if (tempresponse.price[0].retail[0] == 'Free') {
//             var price = 8;
//           }
//         }

//         var pricect = price * 0.15;
//         var des = 0;
//         if (tempresponse.description[0].hasOwnProperty('long')) {
//           var str = tempresponse.description[0].long[0];
//           var count = str.length;
//           for (var j = 0; j < count; j++) {

//           }

//           if (j >= 400) {
//             des = des + 9;
//           }
//           if (j > 100 && j < 400) {
//             var des = des + 10;
//           }
//           if (j < 100) {
//             var des = des + 7;
//           }
//         }
//         var descrip = des * 0.15;
//         var finalSum = descrip + pricect + subcount + rat + rev;

//         var title = tempresponse.$.name;
//         let unique_id = tempresponse.$.sku_number;

//         var pricer = tempresponse.price[0].retail[0];
//         var currency = tempresponse.price[0].$.currency;
//         var subjct = tempresponse.category[0].primary[0];
//         var subjct2 = tempresponse.category[0].secondary[0];
//         var subbj = `{"${subjct}","${subjct2}","${CBSubject}"}`;
//         var null_date = new Date(0);
//         var url = `https://click.linksynergy.com/deeplink?id=aEDzMt9EP*4&mid=39197&murl=${tempresponse.URL[0].product[0]}`;
//         if (tempresponse.description[0].hasOwnProperty('long')) {
//           var descript = tempresponse.description[0].long[0];
//         } else {
//           var descript = "";
//         }
//         // console.log(subbj);   

//         function create_UUID() {
//           var dt = new Date().getTime();
//           var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
//             var r = (dt + Math.random() * 16) % 16 | 0;
//             dt = Math.floor(dt / 16);
//             return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
//           });
//           return uuid;
//         }


//         ++i;


//          // our set of columns, to be created only once (statically), and then reused,
//     // to let it cache up its formatting templates for high performance:
//     const cs = new pgp.helpers.ColumnSet(['title',
//     'start_date',
//     'price',
//     'uuid',
//     'price_currency',
//     'subjects',
//     'provider',
//     'university',
//     'rank',
//     'ranking_points',
//     'has_paid_certificates',
//     'url',
//     'instructors',
//     'description',
//     'unique_id' ], {table: 'data'});
      
//   // data input values:
//   const values = [{
//     title: title,
//     start_date: null,
//     price: pricer,
//     uuid: create_UUID(),
//     price_currency: currency,
//     subjects: subbj,
//     provider: "Udemy",
//     university: "",
//     rank: "1",
//     ranking_points: finalSum,
//     has_paid_certificates: false,
//     url: url,
//     instructors: {},
//     description: descript,
//     unique_id :unique_id
    
//   }];
      
//   // generating a multi-row insert query:
//   const query = pgp.helpers.insert(values, cs);
  
//   // executing the query:
//   await DB.none(query).then(()=>{
//     console.log(query)
//     console.log("Data Added")
//   }).catch(()=>{
//     console.log("Not Added")
//   });

//       // map ends here
//       })).then(()=>{
//        return res.send("Udemy Done")
//       });
//     //xml ends here
//     });
//   //try ends here

//   } catch (e) {
//     console.log(e);
//     res.send({
//       error: e
//     });
//   }
// //route eds here 
// })

// Coursera Started

// Coursera Course fetching route =============================================
//=========================================================

// router.get('/api/forTest', async (req, res) => {

//   console.log(UniversityList["Saint Petersburg State University"])
//  res.send("done");
// } )
// const cheerio = require("cheerio");


// router.get('/api/getCousera', async (req, res) => {

// console.log("Let's Fetch The the Coursera !!!");

// var xml = require('fs').readFileSync('routes/data/coursera.xml', 'utf8');
// var unique = [];


// xml2js.parseString(xml, (err, result) => {

//   // console.log(result)

//     if(err) {
//         throw err;
//     }
//     // console.log("++++++++++++++",result)
//     var i = 0;

    


//     Promise.all(result.merchandiser.product.map(async(tempresponse)=>{  


// // Now the Coursera Apis is not providing us the rating part so we are using the Avaliblity for final rating done 

// //                               ++++++++++++++++++++++++++++++++++++++++++++

//     //     if(tempresponse.m1 != null){

//     //     // var rating = tempresponse.m1.toString();

//     //     console.log("rating === ",rating);
        
//     //     var rate = rating.split("~~");
//     //     // console.log(rate);
//     //     var ratee = rate.toString();
//     //     var splitrating = ratee.split(">>");
//     //     var split = splitrating.toString();
//     //     var ra = split.split(",");

//     //     var finalrating = 0;
//     //     var review = 0;

//     //     if(ra[1] >= 4.5){
//     //         finalrating = 10;
//     //     }
//     //     if(ra[1] >= 4.0 || ra[1] < 4.5){
//     //         finalrating = 9;
//     //     }
//     //     if(ra[1] >= 3.5 || ra[1] < 4.0){
//     //        finalrating = 8;
//     //     }
//     //     if(ra[1] <= 3.5){
//     //         finalrating = 6;
//     //     }

//     //     if(ra[5] >= 1000){
//     //         review = 10;
//     //     }
//     //     if(ra[5] < 1000){
//     //         review = 8;
//     //     }
//     // }
//     //     var rat = finalrating * 0.30;

//     //     var rev = review * 0.25;

// // replaced parameter of rating and review 
//     var availability;

//     if(tempresponse.shipping[0].availability[0] == "in-stock")
//     {
//       availability = 15
//     }
//     else 
//     {
//       availability = 0;
//     }


        
   
//         var subject = '';

//         if(tempresponse.category != null){
//             var course = tempresponse.category;
//             if(course[0].primary[0] == 'Business'){
//                 subject = 'B';
//             }if(course[0].primary[0] == 'Design'){
//                 subject = 'A';
//             }
//             if(course[0].primary[0] == 'Development'){
//                 subject = 'DEV';
//             }if(course[0].primary[0] == 'Health & Fitness'){
//                 subject = 'HL';
//             }
//             // modified by Yashwant Sahu
//             if(course[0].primary[0] == 'Software'){
//                 subject = 'CS + DEV';
//             }if(course[0].primary[0] == 'Lifestyle'){
//                 subject = 'HL';
//             }if(course[0].primary[0] == 'Marketing'){
//                 subject = 'B';
//             }if(course[0].primary[0] == 'Music'){
//                 subject = 'A';
//             }if(course[0].primary[0] == 'Office Productivity'){
//                 subject = 'O';
//             }if(course[0].primary[0] == 'Personal Development'){
//                 subject = 'O';
//             }if(course[0].primary[0] == 'Photography'){
//                 subject = 'A';
//             }if(course[0].primary[0] == 'Teaching & Academics'){
//                 subject = 'A';
//             }

//             // console.log("subject == ",subject);

//             var subb = 0;
//             // modified by Yashwant Sahu CS+Dev Added

//             if(subject  == 'CS' || subject == 'B' || subject == 'DEV' || subject == 'DA' || subject == "CS + DEV"){
//                subb = 10; 
//             }
//             if(subject  == 'SENG' || subject == 'M'){
//                subb = 7; 
//             }
//             if(subject  == 'SO' || subject == 'O' || subject == 'HL' || subject == 'A'){
//                subb = 5; 
//             }
//         // console.log("sudd in",subb);

//         }

//         //sunbject
        
 
//         if(tempresponse.price != null){
//             if(tempresponse.price[0].retail[0] >= 5000){
//                 var price = 10;
//             }
//             if(tempresponse.price[0].retail[0] > 1000 || tempresponse.price[0].retail[0] < 5000){
//                 var price = 9;
//             }
//             if(tempresponse.price[0].retail[0] <= 1000){
//                 var price = 8;
//             }
//             if(tempresponse.price[0].retail[0] == 'Free'){
//                 var price = 8;
//             }
//         }
// //price

//         var des = 0;
//         if(tempresponse.description[0].hasOwnProperty('long')){
//             var  str = tempresponse.description[0].long[0];
//          var  count = str.length;
//          for (var j = 0; j < count; j++) {
            
//          }
         
//          if(j >= 400){
//              des=des+9;
//          }if(j> 100 && j < 400){
//             var des=des+10;
//          }  
//          if(j < 100){
//             var des=des+7;
//          }
//          }

// // UniverSity
//          var UniverRank = 0;
        
//          if(CourseraUniversityList[tempresponse['$'].manufacturer_name] === undefined)
//            UniverRank = 5 * 0.15;
//          else
//            UniverRank = CourseraUniversityList[tempresponse['$'].manufacturer_name] * 0.15;

//          function create_UUID() {
//           var dt = new Date().getTime();
//           var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
//             var r = (dt + Math.random() * 16) % 16 | 0;
//             dt = Math.floor(dt / 16);
//             return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
//           });
//           return uuid;
//         }
//         var instructor  = ["Not Provided"];


     
          
//           availability *= 0.15;
//           var subcount = subb * 0.15;
//           var descrip = des * 0.15; 
//           var pricect = price * 0.15;
//           var Start_Data_Rank = 10 * 0.2;
          
//           // console.log(descrip , pricect , subcount, UniverRank,availability,Start_Data_Rank)
       
        
//           var finalSum = descrip + pricect + subcount + availability + UniverRank + Start_Data_Rank ;


//           var title = tempresponse.$.name;
//           let unique_id = tempresponse.$.sku_number;
 
//           var price = tempresponse.price[0].retail[0];
//           var currency = tempresponse.price[0].$.currency;
//           var subject = [`${tempresponse.category[0].primary[0]}`];
//           var url = `https://click.linksynergy.com/deeplink?id=aEDzMt9EP*4&mid=40328&murl=${tempresponse.URL[0].product[0]}`;
  
//           if(tempresponse.description[0].hasOwnProperty('long')){
//           var descript = tempresponse.description[0].long[0];
//           }else{
//              var descript = "";
//           }
//           ++i;
        
       
        

//          const cs = new pgp.helpers.ColumnSet([
//           'title',
//           'start_date',
//           'price',
//           'uuid',
//           'price_currency',
//           'subjects',
//           'provider',
//           'university',
//           'rank',
//           'ranking_points',
//           'has_paid_certificates',
//           'url',
//           'instructors',
//           'description',
//           'unique_id'], {table: 'data'});
            
//         // data input values:
//         const values = [{
//           title: title,
//           start_date: null,
//           price: price,
//           uuid: create_UUID(),
//           price_currency: currency,
//           subjects: subject,
//           provider: "Coursera",
//           university: tempresponse['$'].manufacturer_name,
//           rank: 1,
//           ranking_points: finalSum,
//           has_paid_certificates: true,
//           url: url,
//           instructors: instructor,
//           description: descript,
//           unique_id :unique_id
//         }];
            
      
//         // generating a multi-row insert query:
//         const query = pgp.helpers.insert(values, cs);
      
            
//         // executing the query:
//         await DB.none(query).then(()=>{
//           // console.log(query)
//           console.log("Data Added")
//         }).catch((err)=>{
//           console.log(err)
//           console.log("Not Added")
//         });
      
             
// //map ends 
//     })).then(()=>{
//       return res.send("Coursera Complete")
//     }).catch((err)=>{
//       console.log(err)
//       return res.send(err)
//     });;
// // xml2json end
// })

// // res.send(unique)

// //route ends
// });



export default router;
