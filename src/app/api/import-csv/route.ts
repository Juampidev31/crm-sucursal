import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'Enero-Diciembre.csv');
    const content = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Error reading CSV:', error);
    return NextResponse.json({ error: 'No se pudo leer el archivo CSV' }, { status: 500 });
  }
}
