import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

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

    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const supabase = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`
          }
        }
      }
    );

    // Verify caller is admin/manager
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return new Response('Unauthorized', {
      status: 401,
      headers: corsHeaders
    });
    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (!['admin', 'manager'].includes(role)) return new Response('Forbidden', {
      status: 403,
      headers: corsHeaders
    });

    const body = await req.json();
    const { email, new_password } = body;

    if (!email) {
      return new Response('Email is required', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Use custom password or generate a random one
    const password = new_password || generateRandomPassword();
    const isTemporaryPassword = !new_password;

    // Create admin client
    const adminClient = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Find the user by email
    const { data: users, error: findError } = await adminClient
      .from('users')
      .select('id, first_name, last_name, role')
      .eq('email', email)
      .eq('role', 'manager')
      .single();

    if (findError || !users) {
      return new Response('Manager not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    // Update the user's password in Supabase Auth
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      users.id,
      {
        password: password,
        app_metadata: {
          role: 'manager',
          needs_password_reset: isTemporaryPassword // Flag for password reset if temporary
        }
      }
    );

    if (updateError) {
      return new Response(`Error updating password: ${updateError.message}`, {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain'
        }
      });
    }

    // Send email with new password if temporary
    let emailStatus = 'Not sent';
    if (isTemporaryPassword) {
      try {
        // Check if RESEND_API_KEY is set
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          // Create inline HTML template for manager password reset email
          const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>TrainSmart Password Reset</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #374151; 
                        margin: 0; 
                        padding: 40px 20px; 
                        background-color: #f8fafc;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                        padding: 40px;
                    }
                    .logo-section {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        max-width: 300px;
                        height: auto;
                        margin-bottom: 15px;
                    }
                    .welcome-title {
                        font-size: 28px;
                        font-weight: 700;
                        color: #1f2937;
                        margin: 15px 0 20px 0;
                    }
                    .intro-text {
                        color: #374151;
                        font-size: 16px;
                        margin-bottom: 20px;
                    }
                    .highlight {
                        font-weight: 600;
                        display: inline-block;
                    }
                    .highlight .train {
                        color: #2C3E50;
                    }
                    .highlight .smart {
                        background: linear-gradient(135deg, #E91E63 0%, #9C27B0 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                        color: transparent;
                    }
                    .highlight .trademark {
                        color: #616161;
                        font-size: 0.7em;
                        vertical-align: super;
                    }
                    .credentials-box {
                        background-color: #fef3c7;
                        border: 1px solid #f59e0b;
                        border-left: 4px solid #f59e0b;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 25px 0;
                    }
                    .credentials-box h3 {
                        color: #92400e;
                        margin: 0 0 15px 0;
                        font-size: 18px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .credentials-box p {
                        margin: 8px 0;
                        color: #374151;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .password-field {
                        background-color: #ffffff;
                        border: 2px solid #f59e0b;
                        border-radius: 6px;
                        padding: 12px;
                        font-family: 'Courier New', monospace;
                        font-size: 16px;
                        font-weight: 700;
                        color: #92400e;
                        letter-spacing: 1px;
                        margin: 8px 0;
                        text-align: center;
                    }
                    .password-instruction {
                        font-size: 14px;
                        color: #92400e;
                        margin-top: 12px;
                        font-style: italic;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #22c55e;
                        color: white;
                        text-decoration: none;
                        padding: 15px 30px;
                        border-radius: 8px;
                        font-weight: 600;
                        margin: 25px 0;
                        transition: transform 0.2s;
                        text-align: center;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    }
                    .cta-button:hover {
                        transform: translateY(-1px);
                    }
                    .cta-section {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .footer-text {
                        color: #6b7280;
                        font-size: 14px;
                        margin: 20px 0;
                        line-height: 1.5;
                    }
                    .brand-footer {
                        text-align: center;
                        margin-top: 30px;
                        color: #6b7280;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .icon {
                        width: 16px;
                        height: 16px;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <!-- Logo Section -->
                    <div class="logo-section">
                        <img src="https://trainsmart.smartgendigital.com/images/trainsmart-logo.png" alt="TrainSmart Logo" class="logo">
                    </div>

                    <h2 class="welcome-title">Password Reset Complete!</h2>
                    
                    <p class="intro-text">Hello ${users.first_name} ${users.last_name},</p>
                    <p class="intro-text">Your <span class="highlight"><span class="train">Train</span><span class="smart">Smart</span><span class="trademark">™</span></span> manager account password has been successfully reset. You can now access your admin dashboard using your new login credentials below.</p>

                    <!-- Login Credentials Section -->
                    <div class="credentials-box">
                        <h3>🔑 Your New Login Credentials</h3>
                        <p>✉️&nbsp;&nbsp;<strong>Email:</strong> <a href="mailto:${email}" style="color: #3b82f6;">${email}</a></p>
                        <p>🔑&nbsp;&nbsp;<strong>New Password:</strong></p>
                        <div class="password-field">${password}</div>
                        <div class="password-instruction">
                            <strong>📝&nbsp;&nbsp;Important:</strong> This is your new temporary password. Please login and change it to your own secure password immediately.
                        </div>
                    </div>

                    <!-- Login Button -->
                    <div class="cta-section">
                        <a href="${Deno.env.get('SITE_URL')}/admin" class="cta-button">🎯 Access Admin Dashboard</a>
                    </div>

                    <!-- Instructions -->
                    <p class="footer-text">Click the "Access Admin Dashboard" button above to login with your new credentials. After logging in, you'll be prompted to set your own secure password.</p>

                    <p class="footer-text">If you have any questions or need assistance, please don't hesitate to contact your administrator.</p>

                    <div class="brand-footer">
                        <p><strong>TrainSmart™</strong> - Smart Training Management</p>
                    </div>
                </div>
            </body>
            </html>
          `;

          // Send email directly via Resend API
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'noreply@trainsmart.smartgendigital.com'}>`,
              to: [email],
              subject: 'TrainSmart Manager Password Reset - New Login Credentials',
              html: htmlTemplate,
            }),
          });

          if (emailResponse.ok) {
            emailStatus = 'Sent successfully';
            console.log('Password reset email sent successfully');
          } else {
            emailStatus = 'Failed to send';
            console.error('Failed to send password reset email:', await emailResponse.text());
          }
        } else {
          console.error('RESEND_API_KEY not configured');
          emailStatus = 'Failed to send - API key not configured';
        }
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        emailStatus = 'Error occurred';
      }
    }

    return new Response(JSON.stringify({
      success: true,
      email: email,
      new_password: password,
      email_status: emailStatus,
      message: `Password reset for ${email}. New password: ${password}. Email status: ${emailStatus}. ${emailStatus === 'Sent successfully' ? 'Please check your email inbox (including spam folder).' : 'Please share this password manually with the manager.'}`
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (e) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    return new Response(`Error: ${e}`, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain'
      }
    });
  }
}

Deno.serve(handler);
