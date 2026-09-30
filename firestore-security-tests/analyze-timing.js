const fs = require('fs');

const data = JSON.parse(fs.readFileSync('timing-results.json', 'utf8'));
const tests = data.tests.map((t) => ({ title: t.fullTitle, duration: t.duration }));

console.log('Час виконання кожного тесту (мс):\n');
tests.forEach((t, i) => console.log(`  ${i + 1}. ${t.duration} мс — ${t.title}`));

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    mean: Number(mean.toFixed(1)),
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

const durations = tests.map((t) => t.duration);

console.log('\n Усі тести');
console.log(stats(durations));
