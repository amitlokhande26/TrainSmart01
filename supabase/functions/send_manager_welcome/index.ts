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

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    const body = await req.json();
    const { email, first_name, last_name, temporary_password } = body;

    console.log('Email function called with:', {
      email,
      first_name,
      last_name
    });

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured - RESEND_API_KEY not found'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // For now, send to your verified email address for testing
    const testEmail = 'amitlokhande26@gmail.com';

    // Prepare email content
    const emailSubject = `TrainSmart™ Manager Account - ${first_name} ${last_name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TrainSmart™ Manager Account</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            <strong>Manager Account Created/Reset</strong>
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f97316; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Manager Details:</h3>
            <p style="margin: 10px 0;"><strong>Name:</strong> ${first_name} ${last_name}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporary_password}</code></p>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-weight: 500;">
              ⚠️ <strong>IMPORTANT:</strong> Please share these credentials with the manager securely.
            </p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Instructions for Manager:</h3>
            <ol style="color: #374151; line-height: 1.6;">
              <li>Go to the TrainSmart™ login page</li>
              <li>Enter the email and temporary password above</li>
              <li>You will be prompted to set a new secure password</li>
              <li>Once set, you'll have full access to the manager dashboard</li>
            </ol>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            This is an automated notification from TrainSmart™.
          </p>
        </div>
      </div>
    `;

    console.log('Sending email to:', testEmail, 'for manager:', email);

    // Send email using Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
        to: [testEmail],
        subject: emailSubject,
        html: emailHtml
      })
    });

    console.log('Resend response status:', resendResponse.status);

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('Resend API error:', {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        body: errorData
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        details: errorData,
        status: resendResponse.status,
        email: email,
        password: temporary_password
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const resendData = await resendResponse.json();
    console.log('Email sent successfully:', resendData);

    return new Response(JSON.stringify({
      success: true,
      message: `Email sent to ${testEmail} with manager credentials for ${email}`,
      emailId: resendData.id,
      managerEmail: email,
      password: temporary_password
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (e) {
    console.error('Email sending error:', e);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    return new Response(JSON.stringify({
      success: false,
      error: `Email sending failed: ${e}`,
      email: body?.email,
      password: body?.temporary_password
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

Deno.serve(handler);
