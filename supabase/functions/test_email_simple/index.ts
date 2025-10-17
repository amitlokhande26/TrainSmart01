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

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('RESEND_API_KEY exists:', !!resendApiKey);
    console.log('RESEND_API_KEY starts with re_:', resendApiKey?.startsWith('re_'));

    if (!resendApiKey) {
      return new Response(JSON.stringify({
        error: 'RESEND_API_KEY not found in environment variables'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Simple test email
    const emailData = {
      from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
      to: ['amitlokhandeau@gmail.com'],
      subject: 'Test Email from TrainSmart',
      html: '<h1>Test Email</h1><p>This is a test email from TrainSmart. If you receive this, the email system is working!</p>'
    };

    console.log('Sending test email with data:', emailData);

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

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Resend API error: ${resendData.message || 'Unknown error'}`,
        details: resendData,
        status: resendResponse.status
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
      message: 'Test email sent successfully',
      messageId: resendData.id,
      details: resendData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Test email error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
