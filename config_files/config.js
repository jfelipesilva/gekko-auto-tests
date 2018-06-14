var config = {};
config.debug = false;

/*
config.watch = {

  // see https://gekko.wizb.it/docs/introduction/supported_exchanges.html
  exchange: 'binance',
  currency: 'USDT',
  asset: 'NEO',
*/

//THE FOLLOWING LINE WILL BE CHANGED WITH THE PROPER CONFIGURATION.
/*{[config.watch]}*/

config.tradingAdvisor = {
  enabled: true,
  method: 'automated_strat',
  candleSize: 1,
  historySize: 0,
}


config.automated_strat = {[input_automatedStrat]};

config.backtest = {
  //daterange: 'scan',
  daterange: {
    from: '{[input_daterangeFrom]}',
    to: '{[input_daterangeTo]}'
  },
  batchSize: 50
}

config.paperTrader = {
  enabled: true,
  reportInCurrency: true,
  simulationBalance: {
    asset: 0,
    currency: 100,
  },
  feeMaker: 0.1,
  feeTaker: 0.1,
  feeUsing: 'maker',
  slippage: 0.05,
}

config.performanceAnalyzer = {
  enabled: true,
  riskFreeReturn: 5
}
config.trader = {
  enabled: false,
  key: '',
  secret: '',
  username: '', // your username, only required for specific exchanges.
  passphrase: '', // GDAX, requires a passphrase.
  orderUpdateDelay: 1, // Number of minutes to adjust unfilled order prices
}
config.adviceLogger = {
  enabled: false,
  muteSoft: true // disable advice printout if it's soft
}
config.candleWriter = {
  enabled: false
}
config.adviceWriter = {
  enabled: false,
  muteSoft: true,
}
config.adapter = 'sqlite';

config.sqlite = {
  path: 'plugins/sqlite',
  dataDirectory: 'history',
  version: 0.1,
  journalMode: require('./web/isWindows.js') ? 'DELETE' : 'WAL',
  dependencies: []
}

  // Postgres adapter example config (please note: requires postgres >= 9.5):
config.postgresql = {
  path: 'plugins/postgresql',
  version: 0.1,
  connectionString: 'postgres://user:pass@localhost:5432', // if default port
  database: null, // if set, we'll put all tables into a single database.
  schema: 'public',
  dependencies: [{
    module: 'pg',
    version: '6.1.0'
  }]
}

// Mongodb adapter, requires mongodb >= 3.3 (no version earlier tested)
config.mongodb = {
  path: 'plugins/mongodb',
  version: 0.1,
  connectionString: 'mongodb://mongodb/gekko', // connection to mongodb server
  dependencies: [{
    module: 'mongojs',
    version: '2.4.0'
  }]
}
config.importer = {
  daterange: {
    // NOTE: these dates are in UTC
    from: "2017-11-01 00:00:00"
  }
}

// set this to true if you understand that Gekko will
// invest according to how you configured the indicators.
// None of the advice in the output is Gekko telling you
// to take a certain position. Instead it is the result
// of running the indicators you configured automatically.
//
// In other words: Gekko automates your trading strategies,
// it doesn't advice on itself, only set to true if you truly
// understand this.
//
// Not sure? Read this first: https://github.com/askmike/gekko/issues/201
config['I understand that Gekko only automates MY OWN trading strategies'] = false;

module.exports = config;
