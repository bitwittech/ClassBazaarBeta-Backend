import { Router } from 'express';
import { mongoEdx } from '../mongoclient';

const MongoClient = require('mongodb').MongoClient;

// const mongoDBUrl =
//   'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj';
// const dbName = 'heroku_h05wbcsj';
// const collectionName = 'edx';
// const router = new Router();
// let dbo;

// MongoClient.connect(mongoDBUrl, (err, db) => {
//   dbo = db.db(dbName);
// });

// const renameProp = (oldProp, newProp, { [oldProp]: old, ...others }) => ({
//   [newProp]: old,
//   ...others,
// });

// router.get('/api/courses/edx', async (req, res) => {
//   let st, en;
//   if (req.query.sort === undefined) {
//     st = 0;
//     en = 25;
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
//       st = range[0];
//       en = range[1];
//     } catch (e) {
//       console.log(e);
//     }
//   }

//   if (dbo === undefined) {
//     console.log('Still undefined');
//     dbo = await MongoClient.connect(mongoDBUrl, (err, db) => db.db(dbName));
//   }
//   dbo
//     .collection(collectionName)
//     .find()
//     .skip(st)
//     .limit(en - st)
//     .toArray((err, result) => {
//       if (err) res.send({ data: [], total: 0 });
//       const finalresult = result.map((r) => {
//         const d = renameProp('uuid', 'id', r);
//         d.review = 'Not Provided';
//         return d;
//       });
//       res.send({ data: finalresult, total: 1000 });
//     });
// });

// export default router;
