import { prisma } from './prisma';
import { log } from './logger';
import { updateSyncState, getSyncState } from './syncState';
import { fetchEmployees, fetchCompanies, fetchEvents } from './resourcesApi';
import { callAiProxy } from './aiProxy';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, eventId: string): Promise<T> {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxAttempts) {
        log('ERROR', 'ai_call_failed', { eventId, error: error.message });
        throw error;
      }
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      log('WARN', 'ai_call_retry', { eventId, attempt, delayMs, error: error.message });
      await delay(delayMs);
      attempt++;
    }
  }
  throw new Error('Unreachable');
}

export async function runSyncTask() {
  const currentState = getSyncState();
  if (currentState.isSyncing) return;

  const triggeredAt = new Date().toISOString();
  updateSyncState({
    isSyncing: true,
    errors: [],
    eventsProcessed: 0,
    eventsTotal: 0
  });

  log('INFO', 'sync_started', { triggeredAt });

  try {
    // 1. Fetch & Upsert Employees
    const rawEmployees = await fetchEmployees();
    for (const e of rawEmployees) {
      await prisma.employee.upsert({
        where: { id: e.id },
        update: { name: e.name, email: e.email, role: e.role },
        create: { id: e.id, name: e.name, email: e.email, role: e.role }
      });
    }
    log('INFO', 'employees_upserted', { totalRows: rawEmployees.length });

    // 2. Fetch & Upsert Companies
    const rawCompanies = await fetchCompanies();
    for (const c of rawCompanies) {
      await prisma.company.upsert({
        where: { id: c.id },
        update: { name: c.name, emailDomain: c.email_domain, annualRevenue: c.annual_revenue, customerTier: c.customer_tier, accountOwnerId: c.account_owner_id },
        create: { id: c.id, name: c.name, emailDomain: c.email_domain, annualRevenue: c.annual_revenue, customerTier: c.customer_tier, accountOwnerId: c.account_owner_id }
      });
    }
    log('INFO', 'companies_upserted', { totalRows: rawCompanies.length });

    // 3. Fetch & Upsert Events
    const allEmployees = await prisma.employee.findMany();
    
    let newRows = 0;
    let updatedRows = 0;
    let totalRows = 0;
    
    for (const emp of allEmployees) {
      for (const filterType of ['attendee', 'creator'] as const) {
        const eventsGenerator = fetchEvents(filterType, emp.email, currentState.lastSyncedAt || undefined);
        
        for await (const eventsPage of eventsGenerator) {
          for (const ev of eventsPage) {
            totalRows++;
            const attendees = ev.attendees?.map((a: any) => a.email) || [];
            const isNew = !(await prisma.event.findUnique({ where: { id: ev.id } }));
            
            await prisma.event.upsert({
              where: { id: ev.id },
              update: {
                summary: ev.summary || '',
                description: ev.description,
                startTime: new Date(ev.start?.dateTime || new Date()),
                endTime: new Date(ev.end?.dateTime || new Date()),
                creatorEmail: ev.creator?.email || '',
                attendees: JSON.stringify(attendees)
              },
              create: {
                id: ev.id,
                summary: ev.summary || '',
                description: ev.description,
                startTime: new Date(ev.start?.dateTime || new Date()),
                endTime: new Date(ev.end?.dateTime || new Date()),
                creatorEmail: ev.creator?.email || '',
                attendees: JSON.stringify(attendees)
              }
            });
            if (isNew) newRows++; else updatedRows++;
          }
        }
      }
    }
    log('INFO', 'events_upserted', { totalRows, newRows, updatedRows });

    // 4. Identify Unprocessed
    const unprocessedEvents = await prisma.$queryRaw<any[]>`
      SELECT * FROM Event WHERE id NOT IN (SELECT DISTINCT eventId FROM ProcessedEvent)
    `;

    log('INFO', 'unprocessed_events_found', { count: unprocessedEvents.length });

    if (unprocessedEvents.length === 0) {
      log('INFO', 'no_new_events_to_process');
    } else {
      updateSyncState({ eventsTotal: unprocessedEvents.length });
      
      if (process.env.SKIP_AI_PROXY === 'true') {
        log('INFO', 'skipping_ai_proxy_as_requested');
      } else {
        // Batch AI Processing
        const batchSize = parseInt(process.env.AI_PROXY_BATCH_SIZE || '1', 10);

      const knownCompanies = await prisma.company.findMany();
      // format known_companies to match prompt exactly
      const formattedCompanies = knownCompanies.map(c => ({
        id: c.id,
        name: c.name,
        email_domain: c.emailDomain
      }));

      for (let i = 0; i < unprocessedEvents.length; i += batchSize) {
        const batch = unprocessedEvents.slice(i, i + batchSize);
        log('INFO', 'ai_batch_started', { batchNumber: Math.floor(i / batchSize) + 1, batchSize: batch.length });
        
        await Promise.all(batch.map(async (ev) => {
          try {
            const aiInput = {
              summary: ev.summary,
              description: ev.description,
              attendees: JSON.parse(ev.attendees),
              start: ev.startTime,
              end: ev.endTime
            };
            
            const aiResult = await retry(() => callAiProxy(aiInput, formattedCompanies), 5, ev.id);
            const { category, client_name, client_id } = aiResult.parsed_output;
            
            log('INFO', 'ai_call_success', { eventId: ev.id, category, clientName: client_name });

            // Validate client_id against DB
            let finalCompanyId = null;
            let finalCompanyName = null;
            if (client_id) {
              const comp = await prisma.company.findUnique({ where: { id: client_id } });
              if (comp) {
                finalCompanyId = comp.id;
                finalCompanyName = comp.name;
              }
            }

            // Fan out per attendee
            const fanOutSet = new Set<string>(JSON.parse(ev.attendees));
            if (ev.creatorEmail) fanOutSet.add(ev.creatorEmail);

            let writtenCount = 0;
            const durationMs = new Date(ev.endTime).getTime() - new Date(ev.startTime).getTime();
            const durationMinutes = Math.floor(durationMs / 60000);

            for (const attEmail of fanOutSet) {
              const emp = await prisma.employee.findUnique({ where: { email: attEmail } });
              if (!emp) continue; // Only process internal employees

              await prisma.processedEvent.upsert({
                where: { eventId_employeeEmail: { eventId: ev.id, employeeEmail: attEmail } },
                update: {}, // Dedupe rule: do not overwrite already processed event per attendee
                create: {
                  eventId: ev.id,
                  employeeEmail: attEmail,
                  employeeName: emp.name,
                  category,
                  companyId: finalCompanyId,
                  companyName: finalCompanyName,
                  durationMinutes,
                  eventDate: new Date(ev.startTime),
                  rawAiResponse: aiResult.raw_content
                }
              });
              writtenCount++;
            }
            log('INFO', 'processed_events_upserted', { eventId: ev.id, attendeeCount: fanOutSet.size, totalRowsWritten: writtenCount });
          } catch (e: any) {
            // Already logged in retry
            updateSyncState({ errors: [...getSyncState().errors, `Event ${ev.id}: ${e.message}`] });
          }
          updateSyncState({ eventsProcessed: getSyncState().eventsProcessed + 1 });
        }));
        
        // Delay 0.5 seconds between batches to avoid rate limits
        await delay(500);
      }
      }
    }

    log('INFO', 'dashboard_cache_refreshed'); // DB implies cache is fresh
    
    updateSyncState({
      isSyncing: false,
      lastSyncedAt: new Date().toISOString()
    });
    
    const finalState = getSyncState();
    if (finalState.lastSyncedAt) {
      await prisma.syncSetting.upsert({
        where: { id: 'global' },
        update: {
          lastSyncedAt: new Date(finalState.lastSyncedAt),
          eventsProcessed: finalState.eventsProcessed,
          eventsTotal: finalState.eventsTotal,
        },
        create: {
          id: 'global',
          lastSyncedAt: new Date(finalState.lastSyncedAt),
          eventsProcessed: finalState.eventsProcessed,
          eventsTotal: finalState.eventsTotal,
        }
      });
    }

    log('INFO', 'sync_completed', {
      durationMs: Date.now() - new Date(triggeredAt).getTime(),
      totalProcessed: getSyncState().eventsProcessed,
      totalFailed: getSyncState().errors.length
    });

  } catch (error: any) {
    log('ERROR', 'sync_job_error', { error: error.message, stack: error.stack });
    updateSyncState({ isSyncing: false, errors: [...getSyncState().errors, error.message] });
  }
}
