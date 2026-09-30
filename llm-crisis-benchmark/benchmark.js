require("dotenv").config();
const fs = require("fs");
const phrases = require("./phrases.json");
const {callOpenAI, callAnthropic, callGemini } = require("./providers");

const PROVIDERS = [
  {
  /* Найновіша легка модель OpenAI з лінійки GPT-5.6 */
    name: "gpt-6-luna",
    call: (t) => callOpenAI("gpt-6-luna", t),
    priceIn: 0.1, 
    priceOut: 0.5, 
   },
  {
  /* Нове покоління збалансованих моделей від Anthropic */
	name: "claude-sonnet-5",
    call: (t) => callAnthropic("claude-sonnet-5", t),
    priceIn: 2.0, // Фіксована стандартна ціна
    priceOut: 10.0, // Фіксована стандартна ціна
  },
  //{
    /* Найсучасніша ультрашвидка та бюджетна модель від Google */
    //name: "gemini-3.7-flash",
    //call: (t) => callGemini("gemini-3.7-flash", t),
    //priceIn: 0.75, // Дійсно до 31 грудня 2026 (потім $1.50)
    //priceOut: 3.75, // Дійсно до 31 грудня 2026 (потім $7.50)
  //},
  {
    /* Найдешевша альтернатива для великих об'ємів від Google */
    name: "gemini-3.5-flash-lite",
    call: (t) => callGemini("gemini-3.5-flash-lite", t),
    priceIn: 0.3, // Ультра-дешевий тариф за 1M
    priceOut: 2.5, // Ультра-дешевий тариф за 1M
  },
];

function cost(inputTokens, outputTokens, priceIn, priceOut) {
  if (inputTokens == null || outputTokens == null) return "";
  return (
    (inputTokens / 1_000_000) * priceIn +
    (outputTokens / 1_000_000) * priceOut
  ).toFixed(8);
}

async function run() {
  const rows = [
    "provider,phrase_id,category,predicted,correct,latency_ms,input_tokens,output_tokens,cost_usd",
  ];

  for (const provider of PROVIDERS) {
    console.log(`\n ${provider.name}`);
    for (const phrase of phrases) {
      const start = Date.now();
      try {
        const { label, inputTokens, outputTokens } = await provider.call(
          phrase.text,
        );
        const latency = Date.now() - start;
        const correct = label === phrase.category ? 1 : 0;
        const c = cost(
          inputTokens,
          outputTokens,
          provider.priceIn,
          provider.priceOut,
        );
        rows.push(
          `${provider.name},${phrase.id},${phrase.category},${label},${correct},${latency},${inputTokens},${outputTokens},${c}`,
        );
        console.log(
          `  #${phrase.id} (${phrase.category}) → ${label} [${latency} мс]`,
        );
      } catch (err) {
        console.error(`  #${phrase.id} — помилка: ${err.message}`);
        rows.push(
          `${provider.name},${phrase.id},${phrase.category},ERROR,0,,,,`,
        );
      }
      // невелика пауза, щоб не впертися в rate limit
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  fs.writeFileSync("results.csv", rows.join("\n"));
  console.log("\nГотово. Результати збережено у results.csv");
  console.log("Далі виконай: npm run analyze");
}

run();
