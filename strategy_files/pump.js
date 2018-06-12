require('dotenv').config();
var _ = require('lodash');
var log = require('../core/log');
const moment = require('moment');
const config = require('../core/util').getConfig();
const mysql = require('mysql');
const mysql_conf = {  
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_DARTABASE
}
const mysql_conn = mysql.createConnection(mysql_conf);
const configs_id
var strat = {};
strat.init = function() {
    this.dateRange = config.backtest.daterange;
    this.mysql_query = [];
    this.tradeData = {};
    this.tradeData.balance = 100;
    this.tradeData.bearishBalance = 100;
    this.tradeData.bullishBalance = 100;
    this.firstCandlePrice = 0;
    this.marketBalance = 100;
    this.discounts = (config.paperTrader.feeMaker + config.paperTrader.slippage) / 100 + 1;
    this.input = 'candle';
    this.currentTrend = 'short';
    this.requiredHistory = 0;
    this.openPrice = 0;
    this.trail = 0;
    this.entrance = this.settings.entrance;
    this.exit = this.settings.target;
    this.loss = this.settings.loss;
    this.trail = 0;
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

        mysql_conn.query('UPDATE configs SET executedAt = NOW() WHERE id = '+configs_id, function(err){
            if (err) throw err;
            //console.log("Result: " + result);
        });
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

                //console.log(this.candleMonitor.thirdCandle+' '+this.candleMonitor.secondCandle+' '+this.candleMonitor.firstCandle+' alterou para tendencia de queda em '+moment.utc(candle.start).format());
            }
        }
        if(this.candleMonitor.thirdCandle == 1 && this.candleMonitor.secondCandle == 1 && this.candleMonitor.firstCandle == 1){
            if(this.currentMarketTrend == 'bearish'){
                this.currentMarketTrend = 'bullish';
                //console.log(this.candleMonitor.thirdCandle+' '+this.candleMonitor.secondCandle+' '+this.candleMonitor.firstCandle+' alterou para tendencia de alta em '+moment.utc(candle.start).format());
            }
        }
    }
  

    if(this.currentTrend === 'short') {

        if((candle.close==candle.high && candle.open == candle.low) && (candle.close / candle.open) >= this.entrance){
            this.currentTrend = 'long';
            this.advice('long');
            this.openPrice = candle.close;
            this.stop = candle.open / this.loss;
            this.trail = 0;
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
        }

    } else {

        //LUCRO
        if(this.openPrice < candle.close){ //o preço atual é maior do que minha compra?


          //TECNICA PARA AUMENTAR O LUCRO. AO SETAR UM TRAIL ESTAMOS CRIANDO UM CANAL PARA VENDA INTELIGENTE, ONDE SÓ SERÁ VENDIDO SE UM CANDLE FECHAR ABAIXO DO TRAILING E ACIMA DO TARGET. SE POR ACASO O PREÇO ABAIXAR ABAIXO DO TRAIL E DO TARGET AO MESMO TEMPO, VAMOS ESPERAR ELE ENTRAR NOVAMENTE NO CANAL DE VENDA PARA VENDER. OS RESULTADOS A LONGO USANDO ESSA ESTRATÉGIA RENDEU MUITO MAIS LUCRO.
            
            if((candle.close / this.openPrice) > this.exit){ // a portcentagem de lucro é maior que o target?
                if(this.trail == 0){
                  this.trail = candle.close;
                  console.log(moment.utc(candle.start).format()+' trail set at:'+this.trail);
                }else if(this.trail > candle.close){
                  this.currentTrend = 'short';
                  this.advice('short');
                  console.log(moment.utc(candle.start).format()+' vendeu no lucro:'+candle.close);
                }else{
                  this.trail = candle.close;
                  console.log(moment.utc(candle.start).format()+' trail set at:'+this.trail);
                }
            }else if(this.trail != 0){ // SE O PREÇO ATINGIU O TARGET UMA VEZ E DESCEU, VENDE!
                this.currentTrend = 'short';
                this.advice('short');
                console.log('\033[43m vendeu no lucro baixo:'+candle.close+'\033[00m');
                this.trail = 0;
            }

        
        }else{ //PERDA

            if(candle.close < this.stop){

                this.currentTrend = 'short';
                this.advice('short');
                console.log(moment.utc(candle.start).format()+' vendeu no prejuizo:'+candle.close);

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
            }else{
                this.tradeData.bearishBalance += this.tradeData.profit;
            }

            mysql_conn.query('UPDATE configs SET strategyProfit = "'+this.tradeData.balance+'", marketProfit = "'+this.marketBalance+'", inBullMarketProfit = "'+this.tradeData.bullishBalance+'", inBearMarketProfit = "'+this.tradeData.bearishBalance+'" WHERE id = '+configs_id, function(err){
                if (err) throw err;
                //console.log("Result: " + result);
            });

        }
    }
}

module.exports = strat;
