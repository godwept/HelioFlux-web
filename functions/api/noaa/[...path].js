export async function onRequest({ request, params }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);
  const path = params.path ? `/${params.path.join('/')}` : '/';
  const targetUrl = new URL(`https://services.swpc.noaa.gov${path}${url.search}`);

  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (HelioFlux)',
      Accept: 'application/json, text/plain, */*',
    },
    body: request.body,
  });

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      ...corsHeaders,
      'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });

  return response;
}
