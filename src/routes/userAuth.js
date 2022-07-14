import db from '../db';
import JWT from 'jsonwebtoken';
import { Router } from 'express';

const Cryptr = require('cryptr');
const cryptr = new Cryptr('34ihg84587874b*&*&^(*H4987bcy(&*P9t84bl(*&^(n(^Y5j(* Y*4509j)9T5POJ0');

const router = new Router();

// token secreet
const JWT_Secreet =
  '234n9c8wed238&^*b34kbj9(*34 *&4m 5O*&(H543lh9*A4aDDFF5644642HK%09743P(*9405lI4nlK$E(*6y4kj8H5NU*74u8';

function genrateToken(data) {
  const token = JWT.sign(data, JWT_Secreet);
  // console.log(token)
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
router.post('/api/loginJWT', (req, res) => {
  if (req.body.email) {
    db.table('newregistration')
      .where('email_address', '=', req.body.email)
      .first()
      .then(user => {
        // console.log(user)
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

router.get('/api/encPass',(req,res)=>{
  const arr = ["eklavya@1234", "global123", "global123", "adsadasd", 7078454545, "eklavya@1234", 21022007, "hariom123", "test123@#", 36802206246754, "panggilin69", "ABC123456", "qwertyqwerty", "eklavya@1234", 51402205549440, "hariom123", "qwertyqwerty", "eklavya@1234", 12345678, 123456789, 12345678910, "MeetChothani7070", "eklavya@1234", "qwertqwert", "eklavya@1234", "eklavya@1234", "eklavya@1234", "C8rWrpZmcaAGETS", "ABC123123", "qwerty12345", "qwertyqwerty", "password", "41stTCsux@$$1980", "eklavya@1234", "password12345", "eklavya@1234", "eklavya@1234", "eklavya@1234", "Jay@2002", "eklavya@1234", "shaili186", "Saman@123", "eklavya@1234", "eklavya@1234", "kavyazin'2022", "eklavya@1234", "qwertyuiop", "qwertyqwerty", "eklavya@1234", 12345678, "eklavya@1234", "eklavya@1234", "nilesh123456", "qwertyqwerty", "qwertqwert", "eklavya@1234", "eklavya@1234", "qwertyqwerty", "goJxy1-wexbep-tabvyp", 1234567890, "qwertyqwerty", "vajhUq-nycked-9dagbu", "eklavya@1234", "eklavya@1234", "ryBvy6-wyjpaj-waknuc", "eklavya@1234", 12345678910, 1234567890, "eklavya@1234", "eklavya@1234", "eklavya@1234", 123465789, "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "qyvfoz-jeznyn-miRvi7", "qwertyqwerty", "2143453fd", "helloworld", "radha5698", "eklavya@1234", "eklavya@1234", "eklavya@1234", "ShailajaVyas1310", "eklavya@1234", 1360629127709155, "rajesh45@gamil.com", "qwertyqwerty", "qweryqwerty", "sarman1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "eklavya@1234", "qwertyqwerty", "qwertyqwerty", "qwertyqwerty", "qwertyqwerty", "testedubuk1207@gmail.co", "raju45@gamil.com", "yashkumar302@gmail.com", "V@rjul1234"]
  // arr.map((pass,index)=>{
    //  result.push(cryptr.encrypt(pass))
    // })
    
    
    const result = cryptr.decrypt("48c564a0ba66201685e738ce54c2b5810aeda2f09cac53ebf8a106f7bfc350da58b33eb91abb43b7e938307d270d9fbd1023c7152ed7796e1546a0c97afc3648a902878ac3b9d11e5fd2082060edbe3f0b7f1572a5c41076a0eff42ef0f274ea6952160f5642886df739")

  res.send(result)
})

export default router;
