import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

export default async function handler(req) {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders
      });
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('RESEND_API_KEY found:', !!resendApiKey);
    console.log('RESEND_API_KEY length:', resendApiKey?.length);
    console.log('RESEND_API_KEY starts with:', resendApiKey?.substring(0, 10));

    if (!resendApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RESEND_API_KEY not found in environment variables'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Test Resend API with a simple request
    try {
      const testResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
          to: ['test@example.com'],
          subject: 'Test Email',
          html: '<p>This is a test email</p>'
        })
      });

      console.log('Resend test response status:', testResponse.status);
      const responseText = await testResponse.text();
      console.log('Resend test response body:', responseText);

      return new Response(JSON.stringify({
        success: true,
        message: 'Resend API test completed',
        status: testResponse.status,
        response: responseText
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (apiError) {
      console.error('Resend API test error:', apiError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Resend API test failed',
        details: apiError.toString()
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

  } catch (e) {
    console.error('Test function error:', e);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    return new Response(JSON.stringify({
      success: false,
      error: `Test function failed: ${e}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

Deno.serve(handler);
