import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeEmail = searchParams.get('employeeEmail');

    const where: any = {};
    if (startDate || endDate) {
      where.eventDate = {};
      if (startDate) where.eventDate.gte = new Date(startDate);
      if (endDate) where.eventDate.lte = new Date(endDate);
    }
    if (employeeEmail && employeeEmail !== 'all') {
      where.employeeEmail = employeeEmail;
    }

    log('INFO', 'dashboard_served_from_db');

    const processedEvents = await prisma.processedEvent.findMany({ where });

    // Aggregate by category
    const catMap = new Map<string, number>();
    // Aggregate by client
    const clientMap = new Map<string, { companyName: string, durationMinutes: number }>();

    for (const pe of processedEvents) {
      catMap.set(pe.category, (catMap.get(pe.category) || 0) + pe.durationMinutes);
      
      if (pe.companyId && pe.companyName) {
        const curr = clientMap.get(pe.companyId) || { companyName: pe.companyName, durationMinutes: 0 };
        curr.durationMinutes += pe.durationMinutes;
        clientMap.set(pe.companyId, curr);
      }
    }

    const allocationsByCategory = Array.from(catMap.entries()).map(([category, durationMinutes]) => ({ category, durationMinutes }));
    const allocationsByClient = Array.from(clientMap.entries()).map(([companyId, data]) => ({ companyId, companyName: data.companyName, durationMinutes: data.durationMinutes }));

    return NextResponse.json({
      allocationsByCategory,
      allocationsByClient
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    }, { status: 500 });
  }
}
