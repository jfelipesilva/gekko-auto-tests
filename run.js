require('dotenv').config();
const APP_DIR = process.env.APP_DIR;
const GEKKO_DIR = process.env.GEKKO_DIR;
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
let count = 0;
let select_result = [];
let strategyFileOriginal = "";
let configFileOriginal = "";

/*--------------------------
    TO AUTOMATE YOU SHOULD SETUP CRONTAB TO RUN THIS JOB EACH MINUTE.
    IT WILL LOOK FOR BACKTEST NOT YET STARTED, GRAB A FEW AND RUN THEM.
    SINCE CRONTAB MINIMUM TIME CICLE IS ONE MINUTE, 
    YOU CAN SET THE FOLLOWING VARIABLES TO RUN MORE THAN 1 BACKTEST FOR EACH JOB.
    YOU CAN CHANGE THIS AT ANYTIME TO AJUST YOUR CPU USAGE.
    KEEP WATCHING YOUR CPU, IF IS TOO HIGH, LOWER THE PROCESS_LIMIT VARIABLE.
    YOU CAN BALANCE THIS AJUSTING THE TIME BETWEEN EACH BACKTEST. 
-----------------------------------------------------------------*/

let process_limit = 3; //how many backtests one job should run
let time_between_backtests = 20; //seconds between each backtest for one particular job

//--------------------------------------------------------------------------------------------*/

time_between_backtests = time_between_backtests*1000;
start();

function start(){
    mysql_conn = mysql.createConnection(mysql_conf);
    mysql_conn.query('SELECT f.config_js, f.strategy_js FROM backtests b INNER JOIN files f ON f.id = b.files_id WHERE b.executed_at IS NULL LIMIT 1', function(err, result, fields){
        mysql_conn.end();
        if (err) throw err;
        if(result.length == 0){
            console.log("no backtests to run");
        }else{
            configFileOriginal = result[0].config_js;
            strategyFileOriginal = result[0].strategy_js;
            grabBacktests();
        }
    });
}

function preReserveBacktestsInDataBase(){
    let ids = [];
    select_result.forEach(function(item, index){
        ids.push("id="+item.id);
    });
    ids = ids.join(" OR ");

    mysql_conn = mysql.createConnection(mysql_conf);
    mysql_conn.query('UPDATE backtests SET executed_at = NOW() WHERE '+ids, function(err){
        mysql_conn.end();
        if (err) throw err;
        next();
    });
}

function grabBacktests(){
    mysql_conn = mysql.createConnection(mysql_conf);
    mysql_conn.query('SELECT * FROM backtests WHERE executed_at IS NULL LIMIT '+process_limit, function(err, result, fields){
        mysql_conn.end();
        if (err) throw err;
        if(result.length == 0){
            console.log("no backtests to run");
        }else{
            console.log("initiating "+result.length+" backtests");
            select_result = result;
            preReserveBacktestsInDataBase();
        }
    });
}

function next(){
    if(select_result.length > count){
        run(select_result[count]);
        count++;
        setTimeout(next,time_between_backtests);
    }else{
        console.log("done backtesting process of "+process_limit);
        return;
    }
}


function run(configuration){

    console.log("backtest #"+(count+1));
    console.log("strat config: "+configuration.config_json);

    let config_js = JSON.parse(configuration.config_json);

    //strategy file handling
    let strategyFile = strategyFileOriginal;
    strategyFile = strategyFile.replace("{[input_dbhost]}", mysql_conf.host);
    strategyFile = strategyFile.replace("{[input_dbuser]}", mysql_conf.user);
    strategyFile = strategyFile.replace("{[input_dbpass]}", mysql_conf.password);
    strategyFile = strategyFile.replace("{[input_database]}", mysql_conf.database);
    strategyFile = strategyFile.replace("{[input_backtest_id]}",configuration.id);
    //strategyFile = strategyFile.replace("this.settings.entrance",config_js.entrance);
    //strategyFile = strategyFile.replace("this.settings.target",config_js.target);
    //strategyFile = strategyFile.replace("this.settings.loss",config_js.loss);
    fs.writeFileSync(GEKKO_DIR+'strategies/automated_strat.js',strategyFile, 'utf8');

    //strategy file log
    //fs.appendFileSync(APP_DIR+"__"+configuration.id+'.log', strategyFile, 'utf8');

    //config file handling
    let configFile = configFileOriginal;
    configFile = configFile.replace("{[input_automatedStrat]}",configuration.config_json);
    fs.writeFileSync(GEKKO_DIR+'automated_config.js',configFile, 'utf8');

    mysql_conn = mysql.createConnection(mysql_conf);
    mysql_conn.query('UPDATE backtests SET executed_at = NOW() WHERE id = '+configuration.id, function(err){
        mysql_conn.end();
        if (err) throw err;        
        
        /*
        cmd.get('/usr/local/bin/node '+GEKKO_DIR+'gekko --config automated_config.js --backtest',function(err, data, stderr){
            console.log('return:\n\n',data);            
        });
        */
        cmd.run('/usr/local/bin/node '+GEKKO_DIR+'gekko --config automated_config.js --backtest');

    });

}