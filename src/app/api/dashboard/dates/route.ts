import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const aggregate = await prisma.processedEvent.aggregate({
      _min: {
        eventDate: true,
      },
      _max: {
        eventDate: true,
      },
    });

    return NextResponse.json({
      minDate: aggregate._min.eventDate,
      maxDate: aggregate._max.eventDate,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    }, { status: 500 });
  }
}
