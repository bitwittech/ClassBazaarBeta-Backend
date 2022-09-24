import db from '../db';
import JWT from 'jsonwebtoken';
import { Router } from 'express';
const nodemailer = require('nodemailer')
const Cryptr = require('cryptr');
const cryptr = new Cryptr('34ihg84587874b*&*&^(*H4987bcy(&*P9t84bl(*&^(n(^Y5j(* Y*4509j)9T5POJ0');
const hbs = require('nodemailer-express-handlebars');
const path = require('path')
const router = new Router();

// token secreet
const JWT_Secreet =
  '234n9c8wed238&^*b34kbj9(*34 *&4m 5O*&(H543lh9*A4aDDFF5644642HK%09743P(*9405lI4nlK$E(*6y4kj8H5NU*74u8';

function genrateToken(data) {
  const token = JWT.sign(data, JWT_Secreet);
  console.log(token)
  return token;
}

function verifyToken(req, res, next) {
  console.log(req.body);
  if (req.body.token !== undefined) {
    JWT.verify(req.body.token, JWT_Secreet, (err, data) => {
      if (err === null) {
        // console.log(req.data)
        req.data = data;
      } else return res.sendStatus(401).send({ err: 'Ivalid Token !!!' });

      next();
    });
  } else {
    return res.sendStatus(406).send({ err: 'Please Provides the token' });
  }
}

router.post('/api/verifyToken', verifyToken, (req, res) => {
  res.send({ user: req.data });
});

// login====================
router.post('/api/loginJWT', async (req, res) => {
  console.log('new log in ',req.body)
  if (req.body.email) {
    await db.table('newregistration')
      .where('email_address', '=', req.body.email)
      .first()
      .then(user => {
  console.log(user)

        if (user) {
          if (cryptr.decrypt(user.password) === req.body.password) {
            req.data = genrateToken(user);
            user.password = req.body.password;
            return res.send({
              token: req.data,
              user,
              message: 'User Found !!!',
            });
          }
          return res
            .sendStatus(401)
            .send({ message: 'Incorrect Credentials !!!' });
        }
        return res.sendStatus(403).send({ message: 'User Not Found !!!' });
      });
  } else return res.sendStatus(204).send('Payload Missing !!!');
});


// verification ====================================================================
 // nodemailer setup ==========================================
 const MAIL = 'info@classbazaar.com'
 const PASS = 'qatskwtlnbapxqlq'
 
 

 const transport = nodemailer.createTransport({
  host : 'smtp.gmail.com',
  port : 465,
  secure : true,
  auth : {
    user: MAIL,
    pass :PASS,
  },
})

transport.use('compile',hbs({
  viewEngine :  {
    defaultLayout: false,
  },
  viewPath : path.resolve('./views/')
}))


const loacalLink = 'http://0.0.0.0:8080/'
const loacalLink_site = 'http://0.0.0.0:3000/'
const officialLink_api = 'https://api.classbazaar.com/'
const officialLink_site = 'https://www.classbazaar.com/'

router.post('/api/verificationMail', async(req,res)=>{
  console.log(req.body)

  // check for duplicates 
  db.table('newregistration')
  .where(validation => {
    validation.orWhere('mobile_no',"=",req.body.mobile_no)
    validation.orWhere('email_address',"=",req.body.email_address)
    validation.orWhere('name',"=",req.body.name)
  }).count('_id as CNT')
  .then(async (data)=> {
    console.log(data)
    if(data[0].CNT > 0 && !req.body.eduTest)
        return res.status(203).send({message : 'May be provided UserName, Email, Or Number is already exist !!!'});
  else 
  {let token = genrateToken(req.body)

  const option2 = {
    from : 'Class Bazaar',
    to : req.body.email_address,
    subject : `Verification Mail from Class Bazaar`,
    html: `
    </br>
    <div style = 'display : flex; flexDirection : column ; justifyContent : center; alignItems : center '>
            <img width="200" src = 'https://www.classbazaar.com/static/media/logo.39b02e7d.png' />
    </div>
    </br>
    <div>
        <p>
              Hello ${req.body.name}, your verification link is <a href = "${loacalLink}api/verification/?token=${token}" >Click To Verify<a>. 
              Link is valid only for 30 minutes.
          </p>
    </div>
    </br>
    <div  style = 'display : flex; flexDirection : column ; justifyContent : center; alignItems : center ; background : #ff4600; color : white '>
        <p>Coyright&copy;Classbazaar</p>
        </div>
    `,
    
  }

  await transport.sendMail(option2, (err,response)=>{
    console.log(response)
    if(err) return res.status(503).send({message : 'Somthing went wrong !!!'});
    return res.send({message : 'Verfication link has been sent to your mail.'})
  })}
})
.catch((e) => {
  console.log('ERROR', e);
  res.status(500).send({
    status: 'Error'
  });
});

})

function verifyLink (req,res,next){
  if (req.query.token !== undefined) {
    JWT.verify(req.query.token, JWT_Secreet, (err, data) => {
      if (err === null) {
        // console.log(req.data)
        req.data = data;
        next();
      }
       else return res.sendStatus(401).send({ err: 'Ivalid Token !!!' });

    });
  } else {
    return res.sendStatus(406).send({ err: 'Please Provides the token' });
  }
}

router.get('/api/verification',verifyLink, async(req,res)=>{
  let {
    userid,
    name,
    gender,
    email_address,
    school_or_college_name,
    class_year,
    city,
    mobile_no,
    password,
    eduData,
  } = req.data;
  password = cryptr.encrypt(req.data.password)


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
        res.redirect(`${loacalLink_site}verified?email=${email_address}&password=${req.data.password}`)
      })
      .catch((e) => {
        console.log('ERROR', e);
        res.status(500).send({
          status: 'Error'
        });
      });
})

// route of welcome mail on signup
router.get('/api/welcome',async(req,res)=>{
  console.log(req.query)
  const option2 = {
    from : 'Class Bazaar',
    to : req.query.email_address,
    subject : `Welcome Mail from Class Bazaar`,
    template : 'welcome'
  }

  await transport.sendMail(option2, (err,response)=>{
    console.log(err)
    if(err) return res.status(503).send({message : 'Somthing went wrong !!!'});
    return res.send({message : 'WelCome mail has been sent to your mail.'})
  })
})


export default router;
