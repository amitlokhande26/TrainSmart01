import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Function to get default password based on role
function getDefaultPassword(role: string, customPassword?: string): string {
  if (customPassword) return customPassword;
  
  switch (role.toLowerCase()) {
    case 'employee':
      return 'EmployeeTrain1*';
    case 'supervisor':
      return 'SuperTrain1*';
    case 'manager':
      // For managers, this should be passed from the calling function
      return 'TempPassword123!'; // Fallback
    default:
      return 'DefaultPass1!';
  }
}

// Function to get password type display text
function getPasswordType(role: string, customPassword?: string): string {
  if (role.toLowerCase() === 'manager' && customPassword) {
    return 'Temporary';
  }
  return 'Default';
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { userId, customPassword } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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

    // Local date formatter (DD/MM/YYYY)
    const formatDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const creationDate = formatDate(new Date());

    // Send welcome email
    // Build email HTML from the shared welcome template
    const templatePath = "./templates/welcome-email-v2.html";
    let templateContent: string;
    try {
      templateContent = await Deno.readTextFile(templatePath);
    } catch (e) {
      console.error('Failed to read welcome-email template:', e);
      // Fallback to inline HTML template
      templateContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to TrainSmart</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
              .container { background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
              .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; padding: 30px 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎉 Welcome to TrainSmart!</h1>
              </div>
              <div class="content">
                  <h2>Hello {{USER_NAME}},</h2>
                  <p>Welcome to TrainSmart! Your account has been successfully created and you're ready to start your training journey.</p>
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="{{LOGIN_URL}}" class="cta-button">Access Your Account</a>
                  </div>
                  <p>If you have any questions, please don't hesitate to contact your supervisor or administrator.</p>
              </div>
          </div>
      </body>
      </html>`;
    }

    const defaultPassword = getDefaultPassword(user.role, customPassword);
    const passwordType = getPasswordType(user.role, customPassword);
    const isManager = user.role.toLowerCase() === 'manager' && customPassword;

    // Set password message based on user type
    let passwordMessage: string;
    let messageType: string;
    
    if (isManager) {
      passwordMessage = '<strong>📝 Important:</strong> Please login with the temporary password to set your unique password on logon.';
      messageType = 'manager-instruction';
    } else {
      passwordMessage = 'Please change your password after your first login for security.';
      messageType = 'password-instruction';
    }

    const variables = {
      user_name: `${user.first_name} ${user.last_name}`,
      user_email: user.email,
      user_role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      creation_date: creationDate,
      login_url: loginUrl,
      default_password: defaultPassword,
      password_type: passwordType,
      password_message: passwordMessage,
      manager_message_type: messageType,
    } as Record<string, string>;

    let html = templateContent;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
      html = html.replace(placeholder, value || '');
    });

    // Send via Resend directly
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service configuration error (missing RESEND_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromAddress = `${Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart'} <${Deno.env.get('FROM_EMAIL_ADDRESS') || 'no-reply@trainsmart.smartgendigital.com'}>`;

    const emailData = {
      from: fromAddress,
      to: [user.email],
      subject: 'Welcome to TrainSmart - Your Account is Ready!',
      html,
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const providerData = await (async () => {
      try { return await resendResponse.json(); } catch { return null as any; }
    })();

    if (!resendResponse.ok) {
      console.error('Resend send error (welcome):', providerData);
      return new Response(
        JSON.stringify({ success: false, error: providerData?.message || providerData?.error || 'Send failed', provider: providerData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Welcome email sent successfully',
        emailId: providerData.id,
        userEmail: user.email
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Welcome email error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to send email via the send_email function
async function sendEmail(template: string, emailData: any) {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send_email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template,
        ...emailData
      }),
    });

    const result = await response.json();
    return { success: response.ok, ...result };
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
