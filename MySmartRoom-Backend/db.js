const mysql = require("mysql");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Canhcanh1712!",
  database: "smart_room", 
});

module.exports = db;
