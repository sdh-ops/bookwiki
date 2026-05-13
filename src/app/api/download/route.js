import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const fileName = searchParams.get('name') || 'download';

    if (!fileUrl) {
        return new NextResponse('Missing URL', { status: 400 });
    }

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch file');

        const blob = await response.blob();
        const headers = new Headers();
        
        // Force download with the specified filename
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

        return new NextResponse(blob, {
            status: 200,
            statusText: 'OK',
            headers,
        });
    } catch (error) {
        console.error('Download proxy error:', error);
        return new NextResponse('Download failed', { status: 500 });
    }
}
