import db from '../db';
import JWT from 'jsonwebtoken';
import { Router } from 'express';

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
          if (user.password === req.body.password) {
            req.data = genrateToken(user);
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

export default router;
