import { Router } from 'express';
import db from '../db';
import { filter } from 'rxjs/operators';
const assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
const fusionAuthURL = 'http://auth.samagra.io:9011';
const fusionAuthAPIKey = '6DgFjRZOE94Wd9tIERk79YWJkWjCqvf5JUyKxIuxUgs';
const applicationIdShikshaSaathi = '1ae074db-32f3-4714-a150-cc8a370eafd1';
const router = new Router();

const { FusionAuthClient } = require('@fusionauth/node-client');
const client = new FusionAuthClient(
  'NiITD64khrkH7jn6PUNYCPdancc2gdiD8oZJDTsXFOA',
  'https://auth.classbazaar.in',
);
// Adds/Removes bookmark based on `action` param
router.put('/api/user/bookmark', async (req, res) => {
  const action = req.body.action;
  const course = req.body.course;
  console.log(req.user);
  if (action === 'add') {
    db.table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        if (u.bookmarks === null || u.bookmarks.indexOf(course) < 0) {
          let newBookmarks = u.bookmarks;
          if (newBookmarks === null) newBookmarks = [];
          newBookmarks.push(course);
          db.table('users')
            .where('id', '=', req.user.id)
            .first()
            .update({ bookmarks: newBookmarks })
            .then(f => {
              res.send({ status: 'success', message: 'Bookmark added' });
            });
        } else {
          res.send({ status: 'success', message: 'Bookmark already added' });
        }
      });
  } else if (action === 'remove') {
    db.table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        console.log(u.bookmarks);
        console.log(u.bookmarks.indexOf(course));
        // Removing bookmark from the old list
        if (u.bookmarks !== null && u.bookmarks.indexOf(course) >= 0) {
          const newBookmarks = u.bookmarks;
          const index = newBookmarks.indexOf(course);
          if (index > -1) {
            newBookmarks.splice(index, 1);
          }

          db.table('users')
            .where('id', '=', req.user.id)
            .first()
            .update({ bookmarks: newBookmarks })
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
  console.log(req.user);
  try {
    db.table('users')
      .where('id', '=', req.user.id)
      .first()
      .then(u => {
        db.table('data')
          .where('index', 'IN', u.bookmarks)
          .then(bookmarks => {
            res.send({ data: bookmarks });
          });
      });
  } catch (e) {
    res.send({ data: [] });
  }
});

// Adds/Removes review based on `action` param
router.put('/api/user/review', async (req, res) => {});

// Gets reviews for the user
router.get('/api/user/reviews', async (req, res) => {});


router.post('/api/webhook',async (req,res)=>{
  console.log("WEBHOOK",req.body)
  console.log("EVENT", req.body.event.type)
  if(req.body.event.type === "user.registration.create"){
    const {user} = req.body.event;
    const requestData = {
      userIds:[
        "adebdbaf-980d-47a3-8828-ea66318abece"
      ]
    }
    try {
      const res = await client.sendEmail("a95455e8-62c8-44b4-8104-cfc14a6bc33e",requestData,()=>{
        console.log("Mail sent to", user.id)
      })
      
      return res.status(200).send('ok')
    } catch (error) {
      console.log("ERROR",error)
    }
  }
  return res.status(200).send('ok')
})

export default router;
