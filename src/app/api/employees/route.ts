import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany();
    return NextResponse.json({ employees }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    }, { status: 500 });
  }
}
