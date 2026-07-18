import { prisma } from '../src/lib/prisma';
import { runSyncTask } from '../src/lib/syncTask';

async function main() {
  console.log('Clearing database for test...');
  await prisma.processedEvent.deleteMany({});
  await prisma.event.deleteMany({});
  
  console.log('Running sync task (AI proxy skipped via env var)...');
  process.env.SKIP_AI_PROXY = 'true';
  await runSyncTask();
  
  const count = await prisma.event.count();
  console.log(`\n======================================`);
  console.log(`Test Result: Total Unique Events = ${count}`);
  console.log(`Expected   : 1129`);
  if (count === 1129) {
    console.log(`SUCCESS: The count matches exactly!`);
  } else {
    console.error(`FAILURE: The count does not match.`);
  }
  console.log(`======================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
