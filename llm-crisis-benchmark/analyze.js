const fs = require('fs');

const lines = fs.readFileSync('results.csv', 'utf8').trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map((line) => {
  const values = line.split(',');
  return Object.fromEntries(header.map((h, i) => [h, values[i]]));
});

const providers = [...new Set(rows.map((r) => r.provider))];

console.log('\nПідсумки:\n');
console.log(
  'модель'.padEnd(20),
  'точність'.padEnd(10),
  'сер. затримка, мс'.padEnd(20),
  'сер. вартість, $'
);

for (const provider of providers) {
  const subset = rows.filter((r) => r.provider === provider && r.predicted !== 'ERROR');
  const accuracy = subset.length
    ? (subset.filter((r) => r.correct === '1').length / subset.length) * 100
    : 0;
  const avgLatency = subset.length
    ? subset.reduce((sum, r) => sum + Number(r.latency_ms), 0) / subset.length
    : 0;
  const costs = subset
  .filter((r) => r.cost_usd !== '' && r.cost_usd !== undefined)
  .map((r) => Number(r.cost_usd));
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  console.log(
    provider.padEnd(20),
    `${accuracy.toFixed(1)}%`.padEnd(10),
    avgLatency.toFixed(0).padEnd(20),
    `$${avgCost.toFixed(6)}`
  );
}

for (const provider of providers) {
  const criticalMisses = rows.filter(
    (r) => r.provider === provider && r.category === 'crisis' && r.correct === '0'
  );
  if (criticalMisses.length) {
    const totalCrisis = rows.filter((r) => r.provider === provider && r.category === 'crisis').length;
	console.log(`${provider}: пропущено ${criticalMisses.length} кризових сигналів із ${totalCrisis}`);
    criticalMisses.forEach((r) =>
      console.log(`  #${r.phrase_id} — модель відповіла: ${r.predicted}`)
    );
  } else {
    console.log(`${provider}: усі кризові сигнали було розпізнано правильно`);
  }
}
