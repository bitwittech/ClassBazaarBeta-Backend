const pgp = require("pg-promise")({
    capSQL: true // generate capitalized SQL 
  });
  
  // database://username:password@host:port/dataBaseName
  const connectionString = "postgresql://classbazaar:CBPassword2019!@206.189.138.80:32768/postgres";
  
  
  const DB = pgp(connectionString);

module.exports = DB;


