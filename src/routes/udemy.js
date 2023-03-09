import { Router } from 'express';

const MongoClient = require('mongodb').MongoClient;

// const mongoDBUrl =
//   'mongodb://heroku_dqm24gt4:v8bt06l52npc8gkj9ucmji86hi@ds255107.mlab.com:55107/heroku_dqm24gt4';
// const dbName = 'heroku_dqm24gt4';
// const collectionName = 'udemy';

// const router = new Router();
// let dbo;

// MongoClient.connect(mongoDBUrl, (err, db) => {
//   dbo = db.db(dbName);
// });

// router.get('/api/courses/udemy', async (req, res) => {
//   let st, en;
//   if (req.query.sort === undefined) {
//     st = 0;
//     en = 9;
//   } else {
//     console.log('inside else');
//     try {
//       const totalLength = req.query.sort.length - 4;
//       const range = JSON.parse(req.query.range);
//       const sort = req.query.sort
//         .replace(/[/'"]+/g, '')
//         .substring(1, totalLength - 1)
//         .split(',');
//       const filter = req.query.filter;
//       st = parseInt(range[0]);
//       en = parseInt(range[1]);
//       console.log(st, en);
//     } catch (e) {
//       console.log(e);
//     }
//   }
//   console.log(st, en);

//   if (dbo === undefined) {
//     console.log('Still undefined');
//     dbo = await MongoClient.connect(mongoDBUrl, (err, db) => db.db(dbName));
//   }
//   dbo
//     .collection(collectionName)
//     .find()
//     .skip(st)
//     .limit(en - st + 1)
//     .toArray((err, result) => {
//       if (err) res.send({ data: [], total: 0 });
//       res.send({ data: result, total: 7735 });
//     });
// });

// export default router;
