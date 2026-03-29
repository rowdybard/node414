export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Handle SPA routing - redirect all non-asset requests to index.html
  if (!url.pathname.includes('.') && !url.pathname.startsWith('/_next/')) {
    const indexResponse = await context.env.ASSETS.fetch(new URL('/index.html', context.request.url));
    return new Response(indexResponse.body, {
      ...indexResponse,
      headers: {
        ...indexResponse.headers,
        'Content-Type': 'text/html'
      }
    });
  }
  
  return context.next();
}
