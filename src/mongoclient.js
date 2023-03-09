var MongoClient = require('mongodb').MongoClient;

let mongoClient;

const connectCommon = async () => {
  try {
    const mgClient = await MongoClient.connect(
      'mongodb://classbazaar:CBPassword2019!@159.89.167.238:32768/',
      { useNewUrlParser: true },
    );
    console.log('Client connected');
    mongoClient = mgClient;
  } catch (error) {
    console.log('Udemy Mongo Error', error);
  }
};

const mainConnect = async () => {
  try {
    await connectCommon();
  } catch (error) {
    console.log('MONGO MASTER CONNECT ERROR', error);
  }
};

export { mainConnect, mongoClient };
