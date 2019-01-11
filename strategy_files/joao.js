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
    this.discounts = (config.paperTrader.feeMaker + config.paperTrader.slippage) / 100 + 1;
    this.input = 'candle';
    this.currentTrend = 'short';
    this.requiredHistory = 0;
    this.openPrice = 0;
    this.trail = 0;
    this.entrance = this.settings.entrance;
    this.target = this.settings.target;
    this.loss = this.settings.loss;
    this.trail = 0;
    this.positiveTrade = 0;
    this.tradesTotal = 0;
    this.posTradesInBullMarket= 0;
    this.negTradesInBullMarket= 0;
    this.posTradesInBearMarket = 0;
    this.negTradesInBearMarket = 0;
    this.currentMarketTrend = "bear" //  bearish or bullish

    // everytime last 3 candles is equal to 1 change to bull market
    // everytime last 3 candles is equal to 0 change to bear market
    this.candleMonitor = {
        divisor: 14400000, // 14400000 4 hours candle
        firstCandle: 1,
        secondCandle: 1,
        thirdCandle: 0,
        lastCandlePrice: 0
    }
    console.log("BACKTEST INICIADO!");
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
    }

    let candleCheck = candle.start % this.candleMonitor.divisor;
    if(candleCheck==0){

        this.candleMonitor.thirdCandle = this.candleMonitor.secondCandle;
        this.candleMonitor.secondCandle = this.candleMonitor.firstCandle;
        if(this.candleMonitor.lastCandlePrice != 0){
            if(this.candleMonitor.lastCandlePrice < candle.close){
                this.candleMonitor.firstCandle = 1;
            }else{        
                this.candleMonitor.firstCandle = 0;
            }
        }

        this.candleMonitor.lastCandlePrice = candle.close;

        if(this.candleMonitor.thirdCandle == 0 && this.candleMonitor.secondCandle == 0 && this.candleMonitor.firstCandle == 0){
            if(this.currentMarketTrend == 'bullish'){
                this.currentMarketTrend = 'bearish';

                console.log(this.candleMonitor.thirdCandle+' '+this.candleMonitor.secondCandle+' '+this.candleMonitor.firstCandle+' alterou para tendencia de queda em '+moment.utc(candle.start).format());
            }
        }
        if(this.candleMonitor.thirdCandle == 1 && this.candleMonitor.secondCandle == 1 && this.candleMonitor.firstCandle == 1){
            if(this.currentMarketTrend == 'bearish'){
                this.currentMarketTrend = 'bullish';
                console.log(this.candleMonitor.thirdCandle+' '+this.candleMonitor.secondCandle+' '+this.candleMonitor.firstCandle+' alterou para tendencia de alta em '+moment.utc(candle.start).format());
            }
        }
    }
  

    if(this.currentTrend === 'short') {

        if((candle.open / candle.low) > this.entrance){
            this.currentTrend = 'long';
            this.advice('long');
            this.openPrice = candle.close;
            this.stop = candle.open / this.loss;
            this.trail = 0;
            this.tradesTotal++;
            this.tradeData.buyAt = moment.utc(candle.start).format("YYYY-MM-DD HH:mm:ss");
            this.tradeData.buyPrice = candle.close * this.discounts;
            this.tradeDataTrendMarket = this.currentMarketTrend;

            if(this.currentMarketTrend == 'bullish'){
                if(this.candleMonitor.secondCandle == 0 && this.candleMonitor.thirdCandle == 0 && candle.close < this.candleMonitor.lastCandlePrice){
                    this.tradeDataTrendMarket = 'bearish';
                }
            }else{
                if(this.candleMonitor.secondCandle == 1 && this.candleMonitor.thirdCandle == 1 && candle.close > this.candleMonitor.lastCandlePrice){
                    this.tradeDataTrendMarket = 'bullish';
                }
            }

            console.log("Bought in "+this.tradeDataTrendMarket+" market at price "+this.tradeData.buyPrice);
        }

    } else {

        //PROFIT
        if(this.openPrice < candle.close){ //IS THE PRICE HIGHER THAN I BOUGHT?
            
            if((candle.close / this.openPrice) > this.target){ // IS THE PERCENTAGE HIGHER THAN MY TARGET?
                if(this.trail == 0){
                  this.trail = candle.close;
                  console.log(moment.utc(candle.start).format()+' SET FIRST TRAIL AT:'+this.trail);
                }else if(this.trail > candle.close){
                  this.currentTrend = 'short';
                  this.advice('short');
                  this.positiveTrade = 1;
                  console.log(moment.utc(candle.start).format()+' SOLD WITH PROFITS AT:'+candle.close);
                }else{
                  this.trail = candle.close;
                  console.log(moment.utc(candle.start).format()+' SET TRAIL AT:'+this.trail);
                }
            }else if(this.trail != 0){ // PRICE HIT TARGET ONCE AND FELL. SELL IT NOW!
                this.currentTrend = 'short';
                this.advice('short');
                this.positiveTrade = 1;
                console.log('\033[43m SOLD WITH LOW PROFITS AT:'+candle.close+'\033[00m');
                this.trail = 0;
            }

        
        }else{ //LOSS

            if(candle.close < this.stop){

                this.currentTrend = 'short';
                this.advice('short');
                this.positiveTrade = 0;
                console.log(moment.utc(candle.start).format()+' SOLD WITH LOSS AT:'+candle.close);

            }

        }

        if(this.currentTrend == 'short'){
            this.tradeData.sellAt = moment.utc(candle.start).format("YYYY-MM-DD HH:mm:ss");
            this.tradeData.sellPrice = candle.close / this.discounts;
            var percentageBase = (this.tradeData.sellPrice / this.tradeData.buyPrice);
            var recentBalance = this.tradeData.balance;
            this.tradeData.percentage = (percentageBase-1)*100;
            this.tradeData.balance = recentBalance * percentageBase;
            this.tradeData.profit = this.tradeData.balance - recentBalance;
            this.mysql_query.push(this.tradeData);
            this.marketBalance = (candle.close / this.firstCandlePrice)*100;

            if(this.tradeDataTrendMarket == 'bullish'){
                this.tradeData.bullishBalance += this.tradeData.profit;
                if(this.positiveTrade) this.posTradesInBullMarket++;
                else this.negTradesInBullMarket++;
            }else{
                this.tradeData.bearishBalance += this.tradeData.profit;
                if(this.positiveTrade) this.posTradesInBearMarket++;
                else this.negTradesInBearMarket++;
            }

            mysql_conn.query('UPDATE backtests SET strategyProfits = "'+convertToPercentage(this.tradeData.balance)+'", marketProfits = "'+convertToPercentage(this.marketBalance)+'", bullMarketProfits = "'+convertToPercentage(this.tradeData.bullishBalance)+'", bearMarketProfits = "'+convertToPercentage(this.tradeData.bearishBalance)+'", totalTrades = '+this.tradesTotal+', bullMarketTrades = "'+this.posTradesInBullMarket+'pos/'+this.negTradesInBullMarket+'neg", bearMarketTrades = "'+this.posTradesInBearMarket+'pos/'+this.negTradesInBearMarket+'neg" WHERE id = '+backtest_id, function(err){
                if (err) throw err;
                //console.log("Result: " + result);
            });

        }
    }

    if(moment.utc(this.dateRange.to).format() <= moment.utc(candle.start).format()){
        this.marketBalance = (candle.close / this.firstCandlePrice)*100;
        mysql_conn.query('UPDATE backtests SET marketProfits = "'+convertToPercentage(this.marketBalance)+'", finished_at = NOW() WHERE id = '+backtest_id, function(err){
            if (err) throw err;
            //console.log("Result: " + result);
        });
    }
}

function convertToPercentage(value){
    return (100/(initialBalance/value))-100;
}

module.exports = strat;
