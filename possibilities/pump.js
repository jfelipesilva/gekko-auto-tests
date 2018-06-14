require('dotenv').config();
const APP_DIR = process.env.APP_DIR;
const Combinatorics = require('js-combinatorics');
const fs = require('fs');
const cmd = require('node-cmd');
const mysql = require('mysql');
const mysql_conf = {  
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_DARTABASE
}
let mysql_conn = "";
let files_id = "";


//-- SETUP AS NEEDED --------------------------


  let watch = {
    "exchange": "binance",
    "currency": "USDT",
    "asset": "BTC"
  }

  let daterange = {
    "from": '2018-02-08 12:00',
    "to": '2018-06-13 00:00'
  }

  var percentages = [];

  var value = 1.01;
  var value1 = value;
  while(value <= 1.09){
      percentages.push(value1);
      value = value +0.002;
      value1 = value.toFixed(3);
  }

  var entrances = [];

  value = 1.002;
  value1 = value;
  while(value <= 1.004){
      entrances.push(value1);
      value = value +0.0002;
      value1 = value.toFixed(4);
  }

  var config = {
    "entrance":entrances,
    "target":percentages,
    "loss":percentages
  }

  let CONFIG_FILE = fs.readFileSync(APP_DIR+"config_files/config.js").toString();
  CONFIG_FILE = CONFIG_FILE.replace("/*{[config.watch]}*/","config.watch = "+JSON.stringify(watch));
  CONFIG_FILE = CONFIG_FILE.replace("{[input_daterangeFrom]}",daterange.from);
  CONFIG_FILE = CONFIG_FILE.replace("{[input_daterangeTo]}",daterange.to);

  const STRATEGY_FILE = fs.readFileSync(APP_DIR+"strategy_files/pump.js").toString();

  const combination = Combinatorics.cartesianProduct(config.entrance,config.target,config.loss);
  const combinationTotal = combination.toArray();


//---------------------------------------------


mysql_conn = mysql.createConnection(mysql_conf);
mysql_conn.query('INSERT INTO files (pair, dateFrom, dateTo, config_js, strategy_js) VALUES ("'+watch.asset+'/'+watch.currency+'","'+daterange.from+'","'+daterange.to+'",'+mysql_conn.escape(CONFIG_FILE)+','+mysql_conn.escape(STRATEGY_FILE)+')', function(err, result){
    mysql_conn.end();
    if (err) throw err;
    files_id = result.insertId;
    if (fs.existsSync(APP_DIR+'mysql_tasks.sql')) {
      fs.unlink(APP_DIR+'mysql_tasks.sql', (err) => {
          if (err) throw err;
          strategy(combinationTotal);
      });
    }
    
});
console.log('--------------------------------------------');
console.log(combinationTotal.length+' Total Combinations!');
console.log('--------------------------------------------');


const writeDoc = (item) => ({
  "entrance": item[0],
  "target": item[1],
  "loss": item[2]
});

const strategy = (array = []) => {
    array.forEach((item, index) => {
        const result =  writeDoc(item);
        //console.log(result);

        const tempInsert = "INSERT INTO backtests (config_json,files_id) VALUES ('"+JSON.stringify(result)+"',"+files_id+");\n";

        fs.appendFileSync(APP_DIR+'mysql_tasks.sql',tempInsert, 'utf8');
    });

    console.log('THE COMBINATIONS OF YOUR SRTATEGY WAS GERENATED SUCCESSFULLY.');
    console.log('PLEASE COPY AND RUN THE FOLLOWING COMMAND TO INSERT ALL COMBINATIONS TO YOUR DATABASE.');
    console.log('\033[43mmysql -u '+mysql_conf.user+' -p'+mysql_conf.password+' '+mysql_conf.database+' < '+APP_DIR+'mysql_tasks.sql \033[00m');
    console.log('THE WHOLE PROCESS MAY TAKE A FEW MINUTES OR EVEN HOURS DEPENDING ON HOW MANY COMBINATIONS ARE THERE TO INSERT.');
    console.log('WAIT TILL PROCESS IS DONE SO YOU WILL HAVE EVERY COMBINATION SET TO BE RUN.');
    console.log('YOU CAN DELETE THE FILE AFTER IS DONE WITH THE FOLLOWING COMMAND');  
    console.log('\033[43msudo rm '+APP_DIR+'mysql_tasks.sql \033[00m');
    
}

