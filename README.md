## Auto Backtests for Gekko

This project automates the backtest tool from gekko running as many tests you  define automatically, by cicling through variables possibilities from strategies you own or from strategies that cames with it.

We use nodejs to execute automation tests and mysql to store.

There are two main process withing this tool:

First you need to built a strategy possibilities and store each possibilities to the database

Second is built the strategy which will be executed from crontab to select and execute each possibilities and store results in the datebase

More detais as project grows...
