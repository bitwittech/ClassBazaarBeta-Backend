var MongoClient = require('mongodb').MongoClient;

let mongoUdemy;
let mongoEdx;
let mongoFl;
let mongoUpG;
let mongoUdacity;
let mongoSwayam;
let mongoSl;
let mongoCoursera;
const connectUdemy = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://admin:Tgq2e2SoYmbhLadm@SG-scraped-30169.servers.mongodirector.com:51151,SG-scraped-30170.servers.mongodirector.com:51151,SG-scraped-30171.servers.mongodirector.com:51151/admin?replicaSet=RS-scraped-0&ssl=true',
      { useNewUrlParser: true },
    );
    mongoUdemy = mgClient;
  } catch (error) {
    console.log('Udemy Mongo Error', error);
  }
};
const connectEdx = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj',
      { useNewUrlParser: true },
    );
    mongoEdx = mgClient;
  } catch (error) {
    console.log('Edx Mongo Error', error);
  }
};
const connectFL = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj',
      { useNewUrlParser: true },
    );
    mongoFl = mgClient;
  } catch (error) {
    console.log('FL MONGO ERROR', error);
  }
};

const connectSL = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_glmmwlk5:bo7m9i29h7o2d0p34dde1j2rgb@ds255107.mlab.com:55107/heroku_glmmwlk5',
    );
    mongoSl = mgClient;
  } catch (error) {
    console.log('SL MONGO ERROR', error);
  }
};

const connectUpG = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_h05wbcsj:olo89lerbvime4a39a8stuolju@ds253567.mlab.com:53567/heroku_h05wbcsj',
      { useNewUrlParser: true },
    );
    mongoUpG = mgClient;
  } catch (error) {
    console.log('UpG MONGO ERROR', error);
  }
};

const connectUdacity = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_glmmwlk5:bo7m9i29h7o2d0p34dde1j2rgb@ds255107.mlab.com:55107/heroku_glmmwlk5',
      { useNewUrlParser: true },
    );
    mongoUdacity = mgClient;
  } catch (error) {
    console.log('Udacity MONGO ERROR', error);
  }
};
const connectSwayam = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_glmmwlk5:bo7m9i29h7o2d0p34dde1j2rgb@ds255107.mlab.com:55107/heroku_glmmwlk5',
      { useNewUrlParser: true },
    );
    mongoSwayam = mgClient;
  } catch (error) {
    console.log('Swayam MONGO ERROR', error);
  }
};

const connectCoursera = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://heroku_b5kg98fc:a2kl5h8tq5442g2ua16ai9uefv@ds255107.mlab.com:55107/heroku_b5kg98fc',
      { useNewUrlParser: true },
    );
    mongoCoursera = mgClient;
  } catch (error) {
    console.log('Swayam MONGO ERROR', error);
  }
};

const mainConnect = async () => {
  try {
    await connectCoursera();
    await connectEdx();
    await connectFL();
    await connectSL();
    await connectUdemy();
    await connectUpG();
    await connectSwayam();
    await connectUdacity();
  } catch (error) {
    console.log('MONGO MASTER CONNECT ERROR', error);
  }
};

export {
  mainConnect,
  mongoUdemy,
  mongoEdx,
  mongoFl,
  mongoSwayam,
  mongoSl,
  mongoUdacity,
  mongoUpG,
  mongoCoursera,
};
