import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatDateForDisplay, formatDateTimeForDisplay } from '../../utils/dateFormat.ts';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    const { signoffId } = await req.json();

    if (!signoffId) {
      return new Response(
        JSON.stringify({ error: 'Sign-off ID is required' }),
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

    // Get sign-off details with all related data
    const { data: signoff, error: signoffError } = await supabase
      .from('trainer_signoffs')
      .select(`
        id,
        signed_at,
        signed_name_snapshot,
        signed_email_snapshot,
        completion_id,
        completions!inner(
          id,
          completed_at,
          assignment_id,
          assignments!inner(
            id,
            assigned_to,
            trainer_user_id,
            module_id,
            modules!inner(
              title,
              version,
              line_id,
              lines!inner(name)
            )
          )
        )
      `)
      .eq('id', signoffId)
      .single();

    if (signoffError) {
      console.error('Error fetching sign-off:', signoffError);
      throw signoffError;
    }

    if (!signoff) {
      return new Response(
        JSON.stringify({ error: 'Sign-off not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user details
    const userIds = [signoff.completions.assignments.assigned_to, signoff.completions.assignments.trainer_user_id].filter(Boolean);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const usersMap = new Map(users?.map(u => [u.id, u]) || []);
    const trainee = usersMap.get(signoff.completions.assignments.assigned_to);
    const trainer = usersMap.get(signoff.completions.assignments.trainer_user_id);

    if (!trainee) {
      return new Response(
        JSON.stringify({ error: 'Trainee not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine login URL based on trainee role
    let loginUrl = `${Deno.env.get('SITE_URL')}/employee`;

    // Prepare email content based on sign-off status (approved/rejected)
    const isApproved = signoff.signed_at !== null;
    const signoffStatusHtml = isApproved ? `
      <div class="approved-notice">
        <h3>✅ Training Approved</h3>
        <p>Your training has been approved by your trainer!</p>
      </div>
    ` : `
      <div class="rejected-notice">
        <h3>❌ Training Needs Revision</h3>
        <p>Your trainer has requested revisions to your training completion.</p>
      </div>
    `;

    const nextStepsHtml = isApproved ? `
      <div class="highlight-box">
        <p><strong>🎉 Congratulations!</strong></p>
        <p>1. Your training is now officially complete</p>
        <p>2. This will be recorded in your training history</p>
        <p>3. You may be assigned additional training modules</p>
        <p>4. Keep up the excellent work!</p>
      </div>
    ` : `
      <div class="highlight-box">
        <p><strong>📝 Next Steps:</strong></p>
        <p>1. Review the trainer's feedback</p>
        <p>2. Make necessary corrections</p>
        <p>3. Resubmit your training for review</p>
        <p>4. Contact your trainer if you have questions</p>
      </div>
    `;

    const trainerCommentsHtml = signoff.signed_name_snapshot ? `
      <p><strong>Comments:</strong> ${signoff.signed_name_snapshot}</p>
    ` : '';

    // Send sign-off notification email to trainee
    const emailResult = await sendEmail('signoff-notification', {
      to: trainee.email,
      subject: `${isApproved ? 'Training Approved' : 'Training Requires Revision'}: ${signoff.completions.assignments.modules.title}`,
      variables: {
        trainee_name: `${trainee.first_name} ${trainee.last_name}`,
        module_title: signoff.completions.assignments.modules.title,
        module_version: signoff.completions.assignments.modules.version,
        completion_date: formatDateForDisplay(signoff.completions.completed_at),
        trainer_name: trainer ? `${trainer.first_name} ${trainer.last_name}` : signoff.signed_name_snapshot,
        trainer_email: trainer?.email || signoff.signed_email_snapshot,
        signoff_date: signoff.signed_at ? formatDateForDisplay(signoff.signed_at) : 'Not Signed',
        signoff_time: signoff.signed_at ? formatDateTimeForDisplay(signoff.signed_at) : 'Not Signed',
        line_name: signoff.completions.assignments.modules.lines.name,
        login_url: loginUrl,
        signoff_status: signoffStatusHtml,
        next_steps: nextStepsHtml,
        trainer_comments: trainerCommentsHtml
      }
    });

    if (!emailResult.success) {
      throw new Error(`Failed to send sign-off email: ${emailResult.error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sign-off notification email sent successfully',
        emailId: emailResult.messageId,
        traineeEmail: trainee.email,
        moduleTitle: signoff.completions.assignments.modules.title,
        isApproved
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Sign-off email error:', error);
    
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
