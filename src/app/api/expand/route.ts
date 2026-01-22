import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { urls } = body;

        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json({ error: 'Invalid input. Expected "urls" array.' }, { status: 400 });
        }

        // Deduplicate URLs to avoid redundant requests
        const uniqueUrls = [...new Set(urls)];

        const results = await Promise.all(
            uniqueUrls.map(async (url) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

                    try {
                        const response = await fetch(url, {
                            method: 'GET',
                            redirect: 'follow', // Automatically follow redirects
                            signal: controller.signal,
                            headers: {
                                // Enhanced headers to mimic a real browser
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'none',
                                'Sec-Fetch-User': '?1',
                                'Upgrade-Insecure-Requests': '1'
                            }
                        });

                        clearTimeout(timeoutId);

                        const expandedUrl = response.url;
                        const isLinkedIn = expandedUrl.includes('lnkd.in') || expandedUrl.includes('linkedin.com');

                        if (response.ok) {
                            if (isLinkedIn) {
                                const text = await response.text();

                                // 1. Try "external_url_click" (Interstitial)
                                const buttonMatch = text.match(/<a[^>]+href="([^"]+)"[^>]*data-tracking-control-name="external_url_click"/i)
                                    || text.match(/data-tracking-control-name="external_url_click"[^>]*href="([^"]+)"/i);

                                if (buttonMatch && buttonMatch[1]) {
                                    return { original: url, expanded: buttonMatch[1].replace(/&amp;/g, '&') };
                                }

                                // 2. Try Meta Refresh
                                const metaRefreshMatch = text.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[0-9]*;\s*url=([^"']+)["']?/i);
                                if (metaRefreshMatch && metaRefreshMatch[1]) {
                                    return { original: url, expanded: metaRefreshMatch[1].replace(/&amp;/g, '&') };
                                }

                                // 3. Try window.location logic
                                const scriptMatch = text.match(/window\.location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/i)
                                    || text.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);

                                if (scriptMatch && scriptMatch[1]) {
                                    return { original: url, expanded: scriptMatch[1].replace(/\\/g, '') };
                                }
                            }
                            // If NOT linkedIn, or parsing failed, response.url is the best we have.
                            return { original: url, expanded: expandedUrl };
                        } else {
                            // If the final page is 404 or error, return the URL we landed on.
                            return { original: url, expanded: expandedUrl };
                        }
                    } catch (error: any) {
                        clearTimeout(timeoutId);
                        throw error;
                    }

                } catch (err) {
                    console.error(`Error expanding ${url}:`, err);
                    // Return original if failed completely
                    return { original: url, expanded: url, error: 'Failed to expand' };
                }
            })
        );

        return NextResponse.json({ results });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
