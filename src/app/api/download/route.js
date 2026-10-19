import { NextResponse } from 'next/server';

/**
 * 첨부파일 내려받기 — 원래 파일 이름으로 저장되게 Content-Disposition 을 붙여 준다.
 *
 * ⛔ 우리 Supabase 저장소(post-uploads)의 파일만 받는다. 예전엔 아무 주소나 받아 줘서
 * 남이 이 주소를 중계기로 쓰면 Vercel 무료 한도(CPU·전송량)가 깎였다(2026-10-19 한도 통보 점검).
 * 같은 첨부는 CDN 이 하루 캐시한다 — 두 번째부터는 함수가 돌지 않는다.
 */
const ALLOWED_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-uploads/`;

function isAllowedUrl(fileUrl) {
    try {
        const url = new URL(fileUrl);
        const prefix = new URL(ALLOWED_PREFIX);
        // 경로에 ../ 를 섞어 다른 버킷으로 빠지는 걸 막으려고 정규화된 URL 로 비교한다
        return url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname);
    } catch {
        return false;
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const fileName = searchParams.get('name') || 'download';

    if (!fileUrl) {
        return new NextResponse('Missing URL', { status: 400 });
    }
    if (!isAllowedUrl(fileUrl)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const response = await fetch(fileUrl);
        if (!response.ok || !response.body) throw new Error(`Failed to fetch file: ${response.status}`);

        const headers = new Headers();

        // Force download with the specified filename
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        const length = response.headers.get('Content-Length');
        if (length) headers.set('Content-Length', length);
        headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

        // 통째로 메모리에 올리지 않고 흘려보낸다
        return new NextResponse(response.body, {
            status: 200,
            statusText: 'OK',
            headers,
        });
    } catch (error) {
        console.error('Download proxy error:', error);
        return new NextResponse('Download failed', { status: 500 });
    }
}
