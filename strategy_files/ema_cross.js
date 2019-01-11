var _ = require('lodash');
var log = require('../core/log');
const moment = require('moment');
const config = require('../core/util').getConfig();
const mysql = require('mysql');
const mysql_conf = {  
    host     : "{[input_dbhost]}",
    user     : "{[input_dbuser]}",
    password : "{[input_dbpass]}",
    database : "{[input_database]}"
}
const mysql_conn = mysql.createConnection(mysql_conf);
const backtest_id = "{[input_backtest_id]}";
const initialBalance = 100;
var strat = {};
strat.init = function() {
    this.dateRange = config.backtest.daterange;
    this.mysql_query = [];
    this.tradeData = {};
    this.marketBalance = initialBalance;
    this.tradeData.balance = initialBalance;
    this.tradeData.bearishBalance = initialBalance;
    this.tradeData.bullishBalance = initialBalance;
    this.firstCandlePrice = 0;
    this.tradesTotal = 0;
    this.tradesInBullMarket= 0;
    this.tradesInBearMarket = 0;

    this.ema1 = config.automated_strat.ema1;
    this.ema2 = config.automated_strat.ema2;
    this.ema_val1 = 0;
    this.ema_val2 = 0;

    this.period = 1;
    this.cross = 0;

    this.margin = {
        bought: 0,
        sold: 0,
        shorts: 100,
        longs: 100,
        total: 100,
        fee: 1.002
    }

    console.log("BACKTEST INICIADO!");
    mysql_conn.connect();
}

// What happens on every new candle?
strat.update = function(candle) {

}

// For debugging purposes.
strat.log = function() {
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {

    if(moment.utc(this.dateRange.from).format() >= moment.utc(candle.start).format()){
        //https://forum.gekko.wizb.it/thread-1440.html?highlight=finished
        this.firstCandlePrice = candle.close;
        console.log("Initial Price: "+this.firstCandlePrice);
        this.ema_val1 = candle.close;
        this.ema_val2 = candle.close;
    }

    this.ema_val1 = (candle.close - this.ema_val1) * (2 / (1+this.ema1)) + this.ema_val1;
    this.ema_val2 = (candle.close - this.ema_val2) * (2 / (1+this.ema2)) + this.ema_val2;
  
    if(this.period > this.ema1 && this.period > this.ema2){

        if(this.ema_val1 > this.ema_val2 && (this.cross==0 || this.cross=='down')){
            if(this.cross==0){
                //console.log(moment.utc(candle.start).format()+": INICIOU PARA CIMA");
            }else{
                //console.log(moment.utc(candle.start).format()+": CRUZOU PARA CIMA ("+candle.close+") ("+this.ema_val1+" "+this.ema_val2+")");
                this.margin.bought = candle.close;
                this.tradesTotal++;
                this.tradesInBearMarket++;
                if(this.margin.sold != 0){
                    if(this.margin.bought>this.margin.sold){
                        this.margin.shorts = (this.margin.shorts / (this.margin.bought/this.margin.sold)) / this.margin.fee; //short loss
                        this.margin.total = (this.margin.total / (this.margin.bought/this.margin.sold)) / this.margin.fee;
                    }else{
                        this.margin.shorts = (this.margin.shorts * (this.margin.sold/this.margin.bought)) / this.margin.fee; //short gain
                        this.margin.total = (this.margin.total * (this.margin.sold/this.margin.bought)) / this.margin.fee;
                    }
                    //console.log(moment.utc(candle.start).format()+" : "+this.margin.longs.toString().padEnd(20, ' ')+" - "+this.margin.shorts.toString().padEnd(20, ' ')+" - "+this.margin.total.toString().padEnd(20, ' '));
                    //console.log(" ");
                }
            }
            this.cross = "up";
        }else if(this.ema_val1 < this.ema_val2 && (this.cross==0 || this.cross=='up')){
            if(this.cross==0){
                //console.log(moment.utc(candle.start).format()+": INICIOU PARA BAIXO");
            }else{
                //console.log(moment.utc(candle.start).format()+": CRUZOU PARA BAIXO ("+candle.close+") ("+this.ema_val1+" "+this.ema_val2+")");
                this.margin.sold = candle.close;
                this.tradesTotal++;
                this.tradesInBullMarket++;
                if(this.margin.bought != 0){
                    if(this.margin.sold>this.margin.bought){
                        this.margin.longs = (this.margin.longs * (this.margin.sold/this.margin.bought)) / this.margin.fee; //long gain
                        this.margin.total = (this.margin.total * (this.margin.sold/this.margin.bought)) / this.margin.fee;
                    }else{
                        this.margin.longs = (this.margin.longs / (this.margin.bought/this.margin.sold)) / this.margin.fee; //long loss
                        this.margin.total = (this.margin.total / (this.margin.bought/this.margin.sold)) / this.margin.fee;
                    }
                    //console.log(moment.utc(candle.start).format()+" : "+this.margin.longs.toString().padEnd(20, ' ')+" - "+this.margin.shorts.toString().padEnd(20, ' ')+" - "+this.margin.total.toString().padEnd(20, ' '));
                    //console.log(" ");
                }
            }
            this.cross = "down";
        }

    }

    this.period++;


    if(moment.utc(this.dateRange.to).format() <= moment.utc(candle.start).add(1,"hours").format()){

        console.log(" ");
        //console.log(moment.utc(candle.start).format()+" : "+this.margin.longs.toString().padEnd(20, ' ')+" - "+this.margin.shorts.toString().padEnd(20, ' ')+" - "+this.margin.total.toString().padEnd(20, ' '));
        console.log(" ");

        var query = 'UPDATE backtests SET strategyProfits = "'+convertToPercentage(this.margin.total)+'", marketProfits = "'+convertToPercentage(this.marketBalance)+'", bullMarketProfits = "'+convertToPercentage(this.margin.longs)+'", bearMarketProfits = "'+convertToPercentage(this.margin.shorts)+'", totalTrades = '+this.tradesTotal+', bullMarketTrades = '+this.tradesInBullMarket+', bearMarketTrades = '+this.tradesInBearMarket+', finished_at = NOW() WHERE id = '+backtest_id;

        //console.log(query);        
        console.log(" ");


        this.marketBalance = (candle.close / this.firstCandlePrice)*100;
        
        mysql_conn.query(query, function(err){
            mysql_conn.end();
            if (err) throw err;
            //console.log("Result: " + result);
        });

        //console.log(moment.utc(candle.start).format()+" BACKTEST DONE!");
        console.log(" ");
    }

}

function convertToPercentage(value){
    return (100/(initialBalance/value))-100;
}

module.exports = strat;
