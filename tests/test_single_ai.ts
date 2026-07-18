import { prisma } from '../src/lib/prisma';
import { callAiProxy } from '../src/lib/aiProxy';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function retry<T>(fn: () => Promise<T>, maxAttempts = 5, eventId: string): Promise<T> {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxAttempts) {
        console.error(`ERROR: AI call failed for ${eventId}`, error.message);
        throw error;
      }
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(`WARN: AI call retry for ${eventId} (attempt ${attempt}), delay ${delayMs}ms. Error: ${error.message}`);
      await delay(delayMs);
      attempt++;
    }
  }
  throw new Error('Unreachable');
}

async function main() {
  console.log('Fetching exactly 1 unprocessed event from the database...');
  
  const unprocessedEvents = await prisma.$queryRaw<any[]>`
    SELECT * FROM Event WHERE id NOT IN (SELECT DISTINCT eventId FROM ProcessedEvent) LIMIT 1
  `;
  
  if (unprocessedEvents.length === 0) {
    console.log('No unprocessed events found in the database. Please run sync task without skipping AI to get events first (or fetch them).');
    return;
  }
  
  const ev = unprocessedEvents[0];
  console.log(`Processing event: ${ev.id}`);
  console.log(`Summary: ${ev.summary}`);
  
  const knownCompanies = await prisma.company.findMany();
  const formattedCompanies = knownCompanies.map(c => ({
    id: c.id,
    name: c.name,
    email_domain: c.emailDomain
  }));

  const aiInput = {
    summary: ev.summary,
    description: ev.description,
    attendees: JSON.parse(ev.attendees),
    start: ev.startTime,
    end: ev.endTime
  };
  
  console.log('\nCalling AI Proxy (Batch of 1)...');
  
  try {
    const aiResult = await retry(() => callAiProxy(aiInput, formattedCompanies), 5, ev.id);
    
    console.log('\n======================================');
    console.log('SUCCESS! AI Proxy returned result:');
    console.log(JSON.stringify(aiResult.parsed_output, null, 2));
    console.log('======================================\n');
    
  } catch (err: any) {
    console.error('\n======================================');
    console.error('FAILURE: AI Proxy call failed!');
    console.error(err.message);
    console.error('======================================\n');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
