const Combinatorics = require('js-combinatorics');

var percentages = [];

var value = 1.01;
var value1 = value;
while(value <= 1.1){
    percentages.push(value1);
    value = value +0.002;
    value1 = value.toFixed(3);
}

var entrances = [];

value = 1.001;
value1 = value;
while(value <= 1.013){
    entrances.push(value1);
    value = value +0.0001;
    value1 = value.toFixed(4);
}

var config = {
  "entrance":entrances,
  "target":percentages,
  "loss":percentages
}

const combination = Combinatorics.cartesianProduct(config.entrance,config.target,config.loss);
const combinationTotal = combination.toArray();

const writeDoc = (item) => ({
  entrance: item[0],
  target: item[1],
  loss: item[2]
})
const strategy = (array = []) => {
  array.forEach((item, index) => {
   const result =  writeDoc(item);
   console.log(result);
  })
}
strategy(combinationTotal);
console.log(`Possibilidades: ${combinationTotal.length}`);