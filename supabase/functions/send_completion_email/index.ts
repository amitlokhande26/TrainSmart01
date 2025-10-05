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

    const { completionId } = await req.json();

    if (!completionId) {
      return new Response(
        JSON.stringify({ error: 'Completion ID is required' }),
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

    // Get completion details with all related data
    const { data: completion, error: completionError } = await supabase
      .from('completions')
      .select(`
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
      `)
      .eq('id', completionId)
      .single();

    if (completionError) {
      console.error('Error fetching completion:', completionError);
      throw completionError;
    }

    if (!completion) {
      return new Response(
        JSON.stringify({ error: 'Completion not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user details
    const userIds = [completion.assignments.assigned_to, completion.assignments.trainer_user_id].filter(Boolean);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const usersMap = new Map(users?.map(u => [u.id, u]) || []);
    const trainee = usersMap.get(completion.assignments.assigned_to);
    const trainer = usersMap.get(completion.assignments.trainer_user_id);

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

    // Send completion confirmation email to trainee
    const emailResult = await sendEmail('completion-confirmation', {
      to: trainee.email,
      subject: `Training Completed: ${completion.assignments.modules.title}`,
      variables: {
        trainee_name: `${trainee.first_name} ${trainee.last_name}`,
        module_title: completion.assignments.modules.title,
        module_version: completion.assignments.modules.version,
        completion_date: formatDateForDisplay(completion.completed_at),
        completion_time: formatDateTimeForDisplay(completion.completed_at),
        trainer_name: trainer ? `${trainer.first_name} ${trainer.last_name}` : 'No Trainer Assigned',
        line_name: completion.assignments.modules.lines.name,
        login_url: loginUrl
      }
    });

    if (!emailResult.success) {
      throw new Error(`Failed to send completion email: ${emailResult.error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Completion confirmation email sent successfully',
        emailId: emailResult.messageId,
        traineeEmail: trainee.email,
        moduleTitle: completion.assignments.modules.title
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Completion email error:', error);
    
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
