import { Router } from 'express';
import db from '../db';

// const pgp = require('pg-promise')({
//   capSQL: true, // generate capitalized SQL
// });

const router = new Router();

// making API for search result
router.get('/api/search', async (req, res) => {
  // console.log("Yashwant");

  try {
    console.log('>>>>>>', req.query.search);
    const data = await db
      .select('title')
      .from('data')
      .where(cb => {
        cb.orWhere('title', 'ilike', `%${req.query.search}%`);
        cb.orWhere('provider', 'ilike', `%${req.query.search}%`);
        cb.orWhere('university', 'ilike', `%${req.query.search}%`);
      })
      .orderBy('ranking_points', 'desc')
      .limit(15);

    console.log('>>>>>>>', data);

    return res.send({
      data,
    });
  } catch (err) {
    console.log('ERROR', err);
    return res.status(500).send({
      status: 'Error',
    });
  }
});


router.get('/api/v3/courses', async (req, res) => {
  try {
    console.log(req.query.filter);
    console.log(JSON.parse(req.query.filter));

    const { filter, offset } = JSON.parse(req.query.filter);

    const provider = ['Udemy', 'edX', 'Future_Learn', 'Coursera'];

    const subject = {
      Computer_Science:"Computer Science" ,
      Arts_And_Design:"Arts & Design" ,
      Business:"Business" ,
      Data_Science:"Data Science" ,
      Health_And_Lifestyle:'Health & Lifestyle' ,
      Science_And_Engineering:'Science % Engineering' ,
      Social_Studies:'Social & Studies' ,
      Programming:'Programming' ,
      Math:'Math' ,
      Other:'Other'   
    }

    
    const filterValue = Object.keys(filter).filter(
      row => filter[row] === true && provider.indexOf(row) >= 0,
    );

    console.log(filterValue);
    const currentDate = new Date();

    // udemy ============================
    const Udemy = await db
      .select(
        'title',
        'price',
        'start_date',
        'uuid',
        'university',
        'provider',
        'ranking_points',
      )
      .where(cb => {
        // provider
        cb.where('provider', 'Udemy');

        // start time
        if (filter.Flexible === true) cb.whereNull('start_date');
        if (filter.withIn30 === true) cb.where('start_date', '<=', currentDate);
        if (filter.after30 === true)
          cb.whereNull('start_date').where('start_date', '>', currentDate);

        // search
        if (filter.search)
          cb.where('title', 'ilike', `%${filter.search}%`).orWhere(
            'university',
            'ilike',
            `%${filter.search}%`,
          );

        // fee
        if (filter.Free === true)
          cb.whereNull('price').orWhere('price', '=', 0);
        if (filter.Paid === true || filter.Subscription === true)
          cb.whereNotNull('price');

        // subject
        let rag = Object.keys(subject).map(key=>{
          if(filter[key]=== true)
           return cb.orWhereRaw(`'${subject[key]}' = ANY (subjects)`);
        })

        console.log('>>>>',rag)


      })
      .from('data')
      .orderBy([
        {
          column: 'ranking_points',
          order: 'desc',
        },
        'index',
      ])
      .offset(offset.Udemy)
      .limit(3);

    // Edx ============================
    const edX = await db
      .select(
        'title',
        'price',
        'start_date',
        'uuid',
        'university',
        'provider',
        'ranking_points',
      )
      .where(cb => {
        // provider
        cb.where('provider', 'edX');

        // start time
        if (filter.Flexible === true) cb.whereNull('start_date');
        if (filter.withIn30 === true) cb.where('start_date', '<=', currentDate);
        if (filter.after30 === true)
          cb.whereNull('start_date').where('start_date', '>', currentDate);
        // search
        if (filter.search)
          cb.where('title', 'ilike', `%${filter.search}%`).orWhere(
            'university',
            'ilike',
            `%${filter.search}%`,
          );

        // fee
        if (filter.Free === true)
          cb.whereNull('price').orWhere('price', '=', 0);
        if (filter.Paid === true || filter.Subscription === true)
          cb.whereNotNull('price');
      })
      .from('data')
      .orderBy([
        {
          column: 'ranking_points',
          order: 'desc',
        },
        'index',
      ])
      .offset(offset.edX)
      .limit(3);

    // Coursera ============================

    const Coursera = await db
      .select(
        'title',
        'price',
        'start_date',
        'uuid',
        'university',
        'provider',
        'ranking_points',
      )
      .where(cb => {
        // provider
        cb.where('provider', 'Coursera');
        // search
        if (filter.search)
          cb.where('title', 'ilike', `%${filter.search}%`).orWhere(
            'university',
            'ilike',
            `%${filter.search}%`,
          );
        // start time
        if (filter.Flexible === true) cb.whereNull('start_date');
        if (filter.withIn30 === true) cb.where('start_date', '<=', currentDate);
        if (filter.after30 === true)
          cb.whereNull('start_date').where('start_date', '>', currentDate);
        // fee
        if (filter.Free === true)
          cb.whereNull('price').orWhere('price', '=', 0);
        if (filter.Paid === true || filter.Subscription === true)
          cb.whereNotNull('price');
      })
      .from('data')
      .orderBy([
        {
          column: 'ranking_points',
          order: 'desc',
        },
        'index',
      ])
      .offset(offset.Coursera)
      .limit(3);

    // Future Learn ============================
    const FutureLearn = await db
      .select(
        'title',
        'price',
        'start_date',
        'uuid',
        'university',
        'provider',
        'ranking_points',
      )
      .where(cb => {
        // provider
        cb.where('provider', 'FutureLearn');
        // search
        if (filter.search)
          cb.where('title', 'ilike', `%${filter.search}%`).orWhere(
            'university',
            'ilike',
            `%${filter.search}%`,
          );
        // start time
        if (filter.Flexible === true) cb.whereNull('start_date');
        if (filter.withIn30 === true) cb.where('start_date', '<=', currentDate);
        if (filter.after30 === true)
          cb.whereNull('start_date').where('start_date', '>', currentDate);
        // fee
        if (filter.Free === true)
          cb.whereNull('price').orWhere('price', '=', 0);
        if (filter.Paid === true || filter.Subscription === true)
          cb.whereNotNull('price');
      })
      .from('data')
      .orderBy([
        {
          column: 'ranking_points',
          order: 'desc',
        },
        'index',
      ])
      .offset(offset.Future_Learn)
      .limit(3);

    let finalData = [];
    console.log(filterValue.length);

    if (filterValue.length > 0) {
      if (filterValue.includes('Udemy')) {
        finalData.push(...Udemy);
        offset.Udemy += 3;
      }
      if (filterValue.includes('edX')) {
        finalData.push(...edX);
        offset.edX += 3;
      }
      if (filterValue.includes('Future_Learn')) {
        finalData.push(...FutureLearn);
        offset.Future_Learn += 3;
      }
      if (filterValue.includes('Coursera')) {
        finalData.push(...Coursera);
        offset.Coursera += 3;
      }
    } else {
      if (Udemy.length > 0) offset.Udemy += Udemy.length;
      if (Coursera.length > 0) offset.Coursera += Coursera.length;
      if (FutureLearn.length > 0) offset.Future_Learn += FutureLearn.length;
      if (edX.length > 0) offset.edX += edX.length;

      finalData = [...Udemy, ...Coursera, ...FutureLearn, ...edX];
    }

    const total =
      Udemy.length + Coursera.length + edX.length + FutureLearn.length;

    // shuffle the array
    finalData = finalData.sort((a, b) =>
      a.ranking_points < b.ranking_points ? 1 : -1,
    );

    return res.send({ data: finalData, offset, total });
  } catch (err) {
    console.log('Error >> ', err);
    return res.status(500).send('Something Went Wrong !!!');
  }
});

export default router;
