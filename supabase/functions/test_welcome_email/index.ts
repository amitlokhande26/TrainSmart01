import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'User ID is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, created_at')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      throw userError;
    }

    if (!user) {
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('User found:', user);

    // Determine login URL based on user role
    let loginUrl = `${Deno.env.get('SITE_URL')}/`;
    switch (user.role) {
      case 'employee':
        loginUrl = `${Deno.env.get('SITE_URL')}/employee`;
        break;
      case 'supervisor':
        loginUrl = `${Deno.env.get('SITE_URL')}/supervisor`;
        break;
      case 'manager':
      case 'admin':
        loginUrl = `${Deno.env.get('SITE_URL')}/admin`;
        break;
    }

    // Create simple welcome email HTML (without template file)
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to TrainSmart</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #3B82F6; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TrainSmart</h1>
                <p style="color: white; margin: 5px 0 0 0;">Smart Training Management</p>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #333; margin-bottom: 20px;">Welcome to TrainSmart!</h2>
                <p style="color: #666; line-height: 1.6;">Hello ${user.first_name} ${user.last_name},</p>
                <p style="color: #666; line-height: 1.6;">Welcome to TrainSmart! Your account has been successfully created and you're ready to start your training journey.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #333; margin-top: 0;">Account Details:</h3>
                    <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
                    <p style="color: #666; margin: 5px 0;"><strong>Role:</strong> ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
                    <p style="color: #666; margin: 5px 0;"><strong>Account Created:</strong> ${new Date(user.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="background-color: #22C55E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Get Started</a>
                </div>
                <p style="color: #666; line-height: 1.6; font-size: 14px;">If you have any questions, please don't hesitate to contact your supervisor or administrator.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">This email was sent by TrainSmart Training Management System</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not found in environment variables');
    }

    // Send email via Resend
    const emailData = {
      from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
      to: [user.email],
      subject: 'Welcome to TrainSmart - Your Account is Ready!',
      html: emailHtml
    };

    console.log('Sending welcome email:', {
      to: user.email,
      subject: emailData.subject,
      from: emailData.from
    });

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
      throw new Error(`Resend API error: ${resendData.message || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Welcome email sent successfully',
      emailId: resendData.id,
      userEmail: user.email,
      details: resendData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Welcome email error:', error);
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
