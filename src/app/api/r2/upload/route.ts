import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'ffeb1d04d4872bb543ced40df952b692';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '4031d284cdb251fd98ee4c60f49346b3';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '0af5f8f3d1ed9bc360e3ec04cfc1cf52d94a7ce0e2c41444e5ed4ab929b609c7';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'librosrecversion1';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://pub-5c6e9cb061f444b6906be0071ea6e8c8.r2.dev').replace(/\/+$/, '');

function getS3Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Las credenciales de Cloudflare R2 no están configuradas en las variables de entorno.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const libroId = formData.get('libroId') as string | null;
    const folio = formData.get('folio') as string | null;

    if (!file || !libroId || !folio) {
      return NextResponse.json({ error: 'Faltan parámetros: file, libroId y folio son requeridos' }, { status: 400 });
    }

    const s3 = getS3Client();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const padFolio = String(folio).padStart(4, '0');
    const key = `libros/${libroId}/folio_${padFolio}.jpg`;

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      })
    );

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key,
    });
  } catch (error: any) {
    console.error('Error al subir a Cloudflare R2:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno al subir el archivo a R2' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { libroId, folio } = await req.json();
    if (!libroId || !folio) {
      return NextResponse.json({ error: 'Faltan parámetros: libroId y folio' }, { status: 400 });
    }

    const s3 = getS3Client();
    const padFolio = String(folio).padStart(4, '0');
    const key = `libros/${libroId}/folio_${padFolio}.jpg`;

    await s3.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar de Cloudflare R2:', error);
    return NextResponse.json({ error: error?.message || 'Error al eliminar de R2' }, { status: 500 });
  }
}
