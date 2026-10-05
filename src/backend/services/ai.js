export async function generateFinancialInsight({ summary, transactions, budgets, question }) {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL;

  if (!apiKey || !apiUrl) {
    return {
      provider: 'local-fallback',
      answer: buildFallback(summary, budgets)
    };
  }

  const safeContext = {
    summary,
    transactions: transactions.slice(0, 100),
    budgets: budgets.slice(0, 50)
  };

  const body = {
    messages: [
      {
        role: 'system',
        content: 'You are a financial education assistant. Give practical budgeting insights. Do not request secrets, credentials, or sensitive authentication data. Do not claim to provide regulated financial advice.'
      },
      {
        role: 'user',
        content: `Analyze this authorized user's financial context and answer the question. Context: ${JSON.stringify(safeContext)} Question: ${question || 'Analyze my spending and suggest improvements.'}`
      }
    ]
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error('AI provider request failed');
  const data = await response.json();

  return {
    provider: 'external-ai',
    answer: data.choices?.[0]?.message?.content || data.output?.[0]?.content || 'No insight returned.'
  };
}

function buildFallback(summary, budgets) {
  const lines = [];
  if (summary.expenses > summary.income) {
    lines.push('Your expenses currently exceed your income. Review discretionary spending first.');
  } else {
    lines.push(`You currently have a positive cash flow of ₹${(summary.income - summary.expenses).toFixed(2)}.`);
  }
  const exceeded = budgets.filter(b => Number(b.spent) > Number(b.amount));
  if (exceeded.length) {
    lines.push(`You have exceeded ${exceeded.length} budget category(s). Consider lowering discretionary expenses.`);
  } else if (budgets.length) {
    lines.push('Your tracked budgets are currently within their limits.');
  }
  lines.push('Use the category breakdown on the dashboard to identify your largest recurring expenses.');
  return lines.join(' ');
}
