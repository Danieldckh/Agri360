// Requires: openai package (run: cd api && npm install openai)
const { OPENAI_API_KEY } = require('../config');

async function autofillProductFields({ requestFormData, categoriesTree }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `You are helping list an agricultural product on a marketplace.
Given the following booking form Q&A data about the product:
${JSON.stringify(requestFormData, null, 2)}

And the following categories tree (find the best leaf category):
${JSON.stringify(categoriesTree, null, 2)}

Return a JSON object with exactly these fields:
- name: string (short product name, max 100 chars)
- description: string (marketing description, 2-4 sentences)
- category_id: integer (leaf category id that best matches)

Respond ONLY with valid JSON, no markdown, no explanation.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = { autofillProductFields };
