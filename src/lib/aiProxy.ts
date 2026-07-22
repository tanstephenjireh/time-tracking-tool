import { getSsmParam } from './secrets';
import { z } from 'zod';

export const AiProxyInputEventSchema = z.object({
  summary: z.string(),
  description: z.string().nullable().optional(),
  // The background sync task already maps the raw calendar objects to a simple
  // array of string emails before saving to the DB. So when it's passed here,
  // it's just `["email1@example.com", "email2@example.com"]`.
  attendees: z.array(z.string()),
  start: z.union([z.string(), z.date()]),
  end: z.union([z.string(), z.date()])
});

export const AiProxyInputCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  email_domain: z.string()
});

export const CategoryEnum = z.enum([
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
]);

export const AiProxyOutputSchema = z.object({
  status: z.literal('success'),
  parsed_output: z.object({
    category: CategoryEnum,
    client_name: z.string().nullable(),
    client_id: z.string().nullable()
  }),
  raw_content: z.string().optional()
});

export type AiProxyOutput = z.infer<typeof AiProxyOutputSchema>;

// ────────────────────────────────────────────────────────────
// Prompt builder. On a retry, `correction` describes exactly what
// the model got wrong last time so it can self-correct instead of
// blindly re-rolling the same request.
// ────────────────────────────────────────────────────────────
function buildPrompt(correction?: string, badCategory?: string): string {
  const base = `You are an operations analyst categorizing calendar events for a Customer Success team.

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

Return ONLY the structured output matching the schema. Do not guess a client if there is no reasonable match — return null instead.

IMPORTANT — the "category" value must be EXACTLY one of the 15 strings above,
copied verbatim: no leading numbers, no "15. " prefix, no group label, no extra text.`;

  if (!correction) return base;

  let categoryWarning = '';
  if (badCategory) {
    categoryWarning = `\nYou provided an invalid category: "${badCategory}".`;
  }

  return `${base}

⚠️ YOUR PREVIOUS RESPONSE WAS REJECTED because it failed validation:
${correction}${categoryWarning}

Return a corrected JSON object that fixes exactly these problems. For example,
return "Other internal tasks", never "14. Other internal tasks".`;
}

export async function callAiProxy(
  event: unknown,
  knownCompanies: unknown[],
  maxAttempts = 3
): Promise<AiProxyOutput> {
  // 1. INPUT GATING — throws on bad input (a caller bug, not recoverable),
  //    and does so before any network call so nothing is wasted.
  const validatedEvent = AiProxyInputEventSchema.parse(event);
  const validatedCompanies = z.array(AiProxyInputCompanySchema).parse(knownCompanies);

  const url = await getSsmParam(process.env.AI_PROXY_URL || 'mock-url');
  const email = await getSsmParam(process.env.AI_PROXY_EMAIL || 'mock-email');
  const apiKey = await getSsmParam(process.env.AI_PROXY_API_KEY || 'mock-api-key');
  const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

  const outputSchema = {
    type: "object",
    properties: {
      category: { type: "string", enum: CategoryEnum.options },
      client_name: { type: ["string", "null"] },
      client_id: { type: ["string", "null"] }
    },
    required: ["category", "client_name", "client_id"]
  };

  let correction: string | undefined; // carries the last validation error into the next prompt
  let badCategory: string | undefined; // carries the bad category provided by AI
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // 2. Body rebuilt each iteration so the corrected prompt is actually sent.
    const body = {
      prompt: buildPrompt(correction, badCategory),
      input: { event: validatedEvent, known_companies: validatedCompanies },
      output_schema: outputSchema
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(body)
    });

    // 3a. HTTP-level failure. Distinguish retryable from non-retryable:
    //     4xx (except 429) means the request itself is wrong — auth, bad
    //     payload — and retrying identically will never help, so fail fast.
    //     5xx and 429 are transient, so retry.
    if (!response.ok) {
      const errorText = await response.text();
      const isRetryable = response.status >= 500 || response.status === 429;

      if (!isRetryable) {
        throw new Error(`AI Proxy Error (non-retryable): ${response.status} - ${errorText}`);
      }

      console.warn(
        `AI Proxy transient error (attempt ${attempt}/${maxAttempts}): ${response.status} - ${errorText}`
      );
      correction = undefined; // this wasn't a validation issue; don't pollute the prompt

      if (attempt >= maxAttempts) {
        throw new Error(`AI Proxy Error after ${maxAttempts} attempts: ${response.status} - ${errorText}`);
      }
      continue;
    }

    // 3b. OUTPUT BOUNDARY — safeParse (non-throwing) so a bad model reply is
    //     handled as expected-and-recoverable, not an exception.
    const result = await response.json();
    const parsed = AiProxyOutputSchema.safeParse(result);

    if (parsed.success) {
      return parsed.data; // ✅ typed, validated, category guaranteed to be one of the 15
    }

    // 4. Validation failed (e.g. category came back as "15. PTO"). Turn the
    //    ZodError into a readable list and feed it into the next prompt.
    correction = parsed.error.issues
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
      
    badCategory = result?.parsed_output?.category;

    console.warn(`AI result validation failed (attempt ${attempt}/${maxAttempts}):\n${correction}`);

    if (attempt >= maxAttempts) {
      throw new Error(
        `AI Proxy failed validation after ${maxAttempts} attempts. Last issues:\n${correction}`
      );
    }
    // loop continues with `correction` set → next prompt asks the model to fix it
  }

  // Unreachable in practice (last iteration always returns or throws), but keeps
  // the return type honest and guards against future refactors.
  throw new Error("Max attempts reached without a valid response.");
}