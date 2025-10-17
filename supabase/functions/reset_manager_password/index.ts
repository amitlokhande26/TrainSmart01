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
        // Call the email service
        const { data: emailData, error: emailErr } = await adminClient.functions.invoke('send_welcome_email', {
          body: {
            userId: users.id,
            customPassword: password
          }
        });

        if (emailErr) {
          console.warn('Failed to send password reset email:', emailErr.message);
          emailStatus = 'Failed to send';
        } else if (emailData?.success) {
          emailStatus = 'Sent successfully';
          console.log('Password reset email sent:', emailData);
        } else {
          emailStatus = 'Unknown error';
        }
      } catch (emailError) {
        console.warn('Email sending failed:', emailError);
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
