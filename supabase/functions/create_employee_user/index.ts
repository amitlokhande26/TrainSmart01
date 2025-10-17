import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface CreateEmployeePayload {
  first_name: string;
  last_name: string;
  email: string;
  default_password?: string; // if omitted, use EmployeeTrain1*
  initial_module_ids?: string[];
}

const DEFAULT_PASSWORD = 'EmployeeTrain1*';

export default async function handler(req: Request): Promise<Response> {
  try {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    const supabase = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    // Verify caller is admin/manager
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const role = (user.app_metadata as any)?.role || (user.user_metadata as any)?.role;
    if (!['admin','manager'].includes(role)) return new Response('Forbidden', { status: 403, headers: corsHeaders });

    const body = await req.json() as CreateEmployeePayload;
    const pwd = body.default_password || DEFAULT_PASSWORD;

    // Create auth user with default password
    const adminClient = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: pwd,
      email_confirm: true,
      app_metadata: { role: 'employee' },
      user_metadata: { first_name: body.first_name, last_name: body.last_name }
    });
    if (createErr) return new Response(createErr.message, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

    const newUserId = created.user?.id as string;

    // Insert sidecar profile
    const { error: profileErr } = await adminClient
      .from('users')
      .insert({ id: newUserId, first_name: body.first_name, last_name: body.last_name, email: body.email, role: 'employee', is_active: true });
    if (profileErr) return new Response(profileErr.message, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

    // Optional initial assignments
    if (body.initial_module_ids && body.initial_module_ids.length > 0) {
      const assigns = body.initial_module_ids.map((mid) => ({ module_id: mid, assigned_to: newUserId, assigned_by: user.id }));
      const { error: assignErr } = await adminClient.from('assignments').insert(assigns);
      if (assignErr) return new Response(assignErr.message, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Send welcome email to employee
    try {
      // Check if RESEND_API_KEY is set
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        // Create inline HTML template for employee welcome email
        const htmlTemplate = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>TrainSmart Employee Welcome</title>
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
                  .account-details-box {
                      background-color: #f8fafc;
                      border: 1px solid #e2e8f0;
                      border-left: 4px solid #3b82f6;
                      border-radius: 8px;
                      padding: 20px;
                      margin: 25px 0;
                  }
                  .account-details-box h3 {
                      color: #1e40af;
                      margin: 0 0 15px 0;
                      font-size: 18px;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                      gap: 8px;
                  }
                  .account-details-box p {
                      margin: 8px 0;
                      color: #374151;
                      display: flex;
                      align-items: center;
                      gap: 8px;
                  }
                  .role-badge {
                      background-color: #3b82f6;
                      color: white;
                      padding: 4px 12px;
                      border-radius: 20px;
                      font-size: 12px;
                      font-weight: 600;
                      display: inline-block;
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

                  <h2 class="welcome-title">Welcome ${body.first_name}!</h2>
                  
                  <p class="intro-text">Hello ${body.first_name} ${body.last_name},</p>
                  <p class="intro-text">Welcome to <span class="highlight"><span class="train">Train</span><span class="smart">Smart</span><span class="trademark">™</span></span>! Your account has been successfully created and you're ready to start your training journey. We're excited to have you on board!</p>

                  <!-- Account Details Section -->
                  <div class="account-details-box">
                      <h3>📋 Your Account Details</h3>
                      <p>✉️&nbsp;&nbsp;<strong>Email:</strong> <a href="mailto:${body.email}" style="color: #3b82f6;">${body.email}</a></p>
                      <p>👤&nbsp;&nbsp;<strong>Role:</strong> <span class="role-badge">EMPLOYEE</span></p>
                      <p>📅&nbsp;&nbsp;<strong>Account Created:</strong> ${new Date().toLocaleDateString()}</p>
                  </div>

                  <!-- Login Credentials Section -->
                  <div class="credentials-box">
                      <h3>🔑 Your Login Credentials</h3>
                      <p>✉️&nbsp;&nbsp;<strong>Email:</strong> <a href="mailto:${body.email}" style="color: #3b82f6;">${body.email}</a></p>
                      <p>🔑&nbsp;&nbsp;<strong>Default Password:</strong></p>
                      <div class="password-field">${pwd}</div>
                      <div class="password-instruction">
                          <strong>📝&nbsp;&nbsp;Note:</strong> This is your default password for employee access. Please keep it secure and use it to login to your account.
                      </div>
                  </div>

                  <!-- Get Started Button -->
                  <div class="cta-section">
                      <a href="${Deno.env.get('SITE_URL')}/employee" class="cta-button">🎯 Get Started</a>
                  </div>

                  <!-- Instructions -->
                  <p class="footer-text">Your training journey begins now! Click the "Get Started" button above to access your personalized dashboard using your login credentials.</p>

                  <p class="footer-text">If you have any questions or need assistance, please don't hesitate to contact your supervisor or administrator.</p>

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
            to: [body.email],
            subject: 'Welcome to TrainSmart - Your Employee Account is Ready!',
            html: htmlTemplate,
          }),
        });

        if (emailResponse.ok) {
          console.log('Employee welcome email sent successfully');
        } else {
          console.error('Failed to send employee welcome email:', await emailResponse.text());
        }
      } else {
        console.error('RESEND_API_KEY not configured');
      }
    } catch (emailError) {
      console.error('Error sending employee welcome email:', emailError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      user_id: newUserId,
      message: 'Employee created successfully and welcome email sent',
      default_password: pwd
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    return new Response(`Error: ${e}`, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
}

Deno.serve(handler);





