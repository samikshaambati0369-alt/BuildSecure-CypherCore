import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymizeFinancialProfile, buildLocalReply, generateAssistantReply } from './assistant.js';

const sampleProfile = {
  periodDays: 90,
  transactionCount: 4,
  summary: { income: 5000, expenses: 3500, balance: 1500 },
  expenseByCategory: [{ category: 'Food', amount: 2100 }],
  monthly: [
    { month: '2026-04', income: 2500, expenses: 1000 },
    { month: '2026-05', income: 2500, expenses: 1500 }
  ],
  budgets: [{ category: 'Food', amount: 1800, spent: 2100 }]
};

test('local fallback gives suggestions from the supplied spending profile', () => {
  const reply = buildLocalReply(sampleProfile);

  assert.match(reply, /₹5000\.00 in income/);
  assert.match(reply, /Food at ₹2100\.00/);
  assert.match(reply, /1 active budget is over its limit/);
  assert.match(reply, /50% higher/);
});

test('local fallback does not infer patterns when there are no recent transactions', () => {
  const reply = buildLocalReply({
    ...sampleProfile,
    transactionCount: 0,
    expenseByCategory: [],
    monthly: [],
    budgets: []
  });

  assert.match(reply, /do not see any transactions from the last 90 days/);
});

test('anonymizes arbitrary custom category labels while preserving known categories', () => {
  const profile = anonymizeFinancialProfile({
    ...sampleProfile,
    expenseByCategory: [
      { category: 'Food', amount: 100 },
      { category: 'sathwik@example.com <script>alert(1)</script>', amount: 50 },
      { category: 'sathwik@example.com <script>alert(1)</script>', amount: 25 }
    ],
    budgets: [{ category: 'sathwik@example.com <script>alert(1)</script>', amount: 100, spent: 75 }]
  });

  assert.deepEqual(profile.expenseByCategory.map(item => item.category), [
    'Food',
    'Custom category 1',
    'Custom category 1'
  ]);
  assert.equal(profile.budgets[0].category, 'Custom category 1');
  assert.doesNotMatch(JSON.stringify(profile), /sathwik@example\.com|<script>/);
});

test('OpenAI request stays server-side and sends only the supplied financial summary', async t => {
  const originalKey = process.env.AI_API_KEY;
  const originalUrl = process.env.AI_API_URL;
  const originalModel = process.env.AI_MODEL;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.AI_API_URL;
    else process.env.AI_API_URL = originalUrl;
    if (originalModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = originalModel;
    globalThis.fetch = originalFetch;
  });

  process.env.AI_API_KEY = 'test-only-key';
  delete process.env.AI_API_URL;
  process.env.AI_MODEL = 'gpt-4o-mini';
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Try setting a weekly food budget.' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await generateAssistantReply({
    question: 'How can I reduce food spending?',
    history: [{ role: 'user', content: 'I want practical tips.' }],
    financialProfile: sampleProfile
  });

  assert.equal(result.provider, 'openai');
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer test-only-key');
  const requestBody = JSON.parse(request.options.body);
  assert.equal(requestBody.model, 'gpt-4o-mini');
  assert.equal(requestBody.messages.at(-1).content, 'How can I reduce food spending?');
  assert.doesNotMatch(requestBody.messages[1].content, /password|email|userId|transaction description/i);
});

test('uses local behavior-based suggestions when no OpenAI key is configured', async t => {
  const originalKey = process.env.AI_API_KEY;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  });

  delete process.env.AI_API_KEY;
  globalThis.fetch = async () => {
    assert.fail('fetch must not run when no OpenAI key is configured');
  };

  const result = await generateAssistantReply({
    question: 'What can I improve?',
    history: [],
    financialProfile: sampleProfile
  });

  assert.equal(result.provider, 'local-fallback');
  assert.match(result.answer, /Food at ₹2100\.00/);
});

test('refuses to send the API key to a non-OpenAI endpoint', async t => {
  const originalKey = process.env.AI_API_KEY;
  const originalUrl = process.env.AI_API_URL;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.AI_API_URL;
    else process.env.AI_API_URL = originalUrl;
    globalThis.fetch = originalFetch;
  });

  process.env.AI_API_KEY = 'test-only-key';
  process.env.AI_API_URL = 'https://attacker.invalid/collect';
  globalThis.fetch = async () => {
    assert.fail('fetch must not run for a non-OpenAI endpoint');
  };

  await assert.rejects(
    generateAssistantReply({
      question: 'Show my spending.',
      history: [],
      financialProfile: sampleProfile
    }),
    { status: 503 }
  );
});
