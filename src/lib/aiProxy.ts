import { getSsmParam } from './secrets';

export async function callAiProxy(event: any, knownCompanies: any[]) {
  const url = await getSsmParam(process.env.AI_PROXY_URL!);
  const email = await getSsmParam(process.env.AI_PROXY_EMAIL!);
  const apiKey = await getSsmParam(process.env.AI_PROXY_API_KEY!);
  
  const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');
  
  const prompt = `You are an operations analyst categorizing calendar events for a Customer Success team.

You will be given a single calendar event (summary, description, attendees, start, end) and a reference list of known clients (company name, ID, and email domain).

TASK 1 — CATEGORIZE:
Assign the event to exactly ONE of the following 15 categories. You MUST return one of these exact category strings, verbatim. Do NOT return a group name, a summary label, or any value not in this list:

1. Client-facing meetings and comms
2. Strategic meetings / QBRs
3. Contract / commercial work
4. Onboarding and training
5. Analysis and insights
6. Campaign support (beyond scope)
7. Internal client work
8. Partner meetings
9. Travel & socials
10. Troubleshooting (feeds)
11. Troubleshooting (Smartly)
12. Learning
13. Team/company calls
14. Other internal tasks
15. PTO

(For context only — these are NOT valid answers, do not return them: categories 1–11 relate to client-facing "Client Work"; categories 12–14 are "Internal Work"; category 15 is "Time Off". Always return the specific numbered category, never the group label.)

Guidance:
- If the event mentions a specific client name, involves an attendee whose email domain matches a known client domain, or clearly relates to a named account, choose the most specific client-facing category (one of 1–11).
- Use the summary/description context to pick the SPECIFIC category, not a general one.
- If it's a purely internal meeting with no client reference, choose one of 12–14.
- If it clearly indicates the employee is out of office / on leave, choose 15 (PTO).

TASK 2 — DEDUCE CLIENT:
- Compare the event's attendee email domains against the provided company list's email_domain field.
- Also check if a company name is mentioned directly in the summary or description.
- If a confident match is found, return that company's exact name and ID.
- If no client is identifiable (e.g., purely internal event), return null for both client_name and client_id.

Return ONLY the structured output matching the schema. Do not guess a client if there is no reasonable match — return null instead.`;

  const body = {
    prompt,
    input: { event, known_companies: knownCompanies },
    output_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "Client-facing meetings and comms",
            "Strategic meetings / QBRs",
            "Contract / commercial work",
            "Onboarding and training",
            "Analysis and insights",
            "Campaign support (beyond scope)",
            "Internal client work",
            "Partner meetings",
            "Travel & socials",
            "Troubleshooting (feeds)",
            "Troubleshooting (Smartly)",
            "Learning",
            "Team/company calls",
            "Other internal tasks",
            "PTO"
          ]
        },
        client_name: { type: ["string", "null"] },
        client_id: { type: ["string", "null"] }
      },
      required: ["category", "client_name", "client_id"]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`AI Proxy Error: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(`AI Proxy returned non-success status: ${JSON.stringify(result)}`);
  }

  return result;
}
