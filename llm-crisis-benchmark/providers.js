const SYSTEM_PROMPT = `Ти класифікатор повідомлень у застосунку психоемоційної підтримки.
Визнач рівень терміновості повідомлення користувача рівно одним словом:
neutral, stress або crisis.
Відповідай лише цим одним словом, без пояснень і розділових знаків.`;

async function callOpenAI(model, text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      max_completion_tokens: 100,
      temperature: 1,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const label = data.choices?.[0]?.message?.content?.trim().toLowerCase();
  const usage = data.usage || {};
  return {
    label,
    inputTokens: usage.prompt_tokens ?? null,
    outputTokens: usage.completion_tokens ?? null,
  };
}

async function callAnthropic(model, text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const label = data.content?.[0]?.text?.trim().toLowerCase();
  const usage = data.usage || {};
  return {
    label,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
  };
}

async function callGemini(model, text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 1 },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const label = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
  const usage = data.usageMetadata || {};
  return {
    label,
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
  };
}

module.exports = { callOpenAI, callAnthropic, callGemini };
