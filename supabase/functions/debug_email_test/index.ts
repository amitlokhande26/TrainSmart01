import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Check environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const siteUrl = Deno.env.get('SITE_URL');

    console.log('Environment check:');
    console.log('RESEND_API_KEY exists:', !!resendApiKey);
    console.log('RESEND_API_KEY starts with re_:', resendApiKey?.startsWith('re_'));
    console.log('SUPABASE_URL exists:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);
    console.log('SITE_URL exists:', !!siteUrl);

    if (!resendApiKey) {
      return new Response(JSON.stringify({
        error: 'RESEND_API_KEY not found',
        envCheck: {
          resendApiKey: !!resendApiKey,
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey,
          siteUrl: !!siteUrl
        }
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Test simple email
    const emailData = {
      from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
      to: ['amitlokhandeau@gmail.com'],
      subject: 'Debug Test Email from TrainSmart',
      html: '<h1>Debug Test</h1><p>This is a debug test email. If you receive this, the basic email system is working!</p>'
    };

    console.log('Sending debug email:', emailData);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const resendData = await resendResponse.json();
    console.log('Resend response:', resendData);
    console.log('Response status:', resendResponse.status);
    console.log('Response ok:', resendResponse.ok);

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Resend API error: ${resendData.message || 'Unknown error'}`,
        details: resendData,
        status: resendResponse.status,
        envCheck: {
          resendApiKey: !!resendApiKey,
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey,
          siteUrl: !!siteUrl
        }
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Debug email sent successfully',
      messageId: resendData.id,
      details: resendData,
      envCheck: {
        resendApiKey: !!resendApiKey,
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        siteUrl: !!siteUrl
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Debug test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      envCheck: {
        resendApiKey: !!Deno.env.get('RESEND_API_KEY'),
        supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        supabaseServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        siteUrl: !!Deno.env.get('SITE_URL')
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
