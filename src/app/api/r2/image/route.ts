import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return new NextResponse('Falta parámetro url', { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse(`Error al descargar imagen: ${res.statusText}`, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('Error en proxy de imagen R2:', error);
    return new NextResponse(error?.message || 'Error interno', { status: 500 });
  }
}
