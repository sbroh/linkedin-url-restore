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
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                    try {
                        const response = await fetch(url, {
                            method: 'GET', // GET is more reliable than HEAD for some servers
                            redirect: 'follow', // Automatically follow redirects
                            signal: controller.signal,
                            headers: {
                                // Use a realistic browser User-Agent to avoid being blocked
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        clearTimeout(timeoutId);

                        // If successful, response.url will be the final destination
                        if (response.ok) {
                            // Check if we are still on lnkd.in or linkedin.com (Interstitial page)
                            const isLinkedIn = response.url.includes('lnkd.in') || response.url.includes('linkedin.com');

                            if (isLinkedIn) {
                                const text = await response.text();
                                // Try to find the link in the interstitial page
                                // Pattern: <a ... href="target" ... data-tracking-control-name="external_url_click" ...>
                                // We search for the specific data attribute line or similar structure

                                // Helper regex to find href value in a tag containing external_url_click
                                // Since attributes order is not guaranteed, we can just look for the href near the data attribute
                                // But the debug output showed them on the same line. 
                                // Let's try a robust regex matching the anchor tag.

                                const match = text.match(/<a[^>]+href="([^"]+)"[^>]*data-tracking-control-name="external_url_click"/i)
                                    || text.match(/data-tracking-control-name="external_url_click"[^>]*href="([^"]+)"/i);

                                if (match && match[1]) {
                                    // Decode HTML entities if needed (usually fetch handles basic decoding, but just in case)
                                    let expanded = match[1].replace(/&amp;/g, '&');
                                    return { original: url, expanded: expanded };
                                }
                            }

                            return { original: url, expanded: response.url };
                        } else {
                            // If the final page is 404 or error, we still might have followed redirects.
                            // But response.url should still be the final one.
                            return { original: url, expanded: response.url };
                        }
                    } catch (error: any) {
                        clearTimeout(timeoutId);
                        throw error;
                    }

                } catch (err) {
                    console.error(`Error expanding ${url}:`, err);
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
