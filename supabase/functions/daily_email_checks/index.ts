import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const results = {
      dueAlerts: { success: false, emailsSent: 0, error: null },
      overdueAlerts: { success: false, emailsSent: 0, error: null }
    };

    // Run due alerts check
    try {
      console.log('Running due alerts check...');
      const dueAlertsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send_due_alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const dueAlertsData = await dueAlertsResponse.json();
      results.dueAlerts = {
        success: dueAlertsResponse.ok,
        emailsSent: dueAlertsData.emailsSent || 0,
        error: dueAlertsResponse.ok ? null : dueAlertsData.error
      };
    } catch (error) {
      console.error('Due alerts error:', error);
      results.dueAlerts.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Run overdue alerts check
    try {
      console.log('Running overdue alerts check...');
      const overdueAlertsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send_overdue_alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const overdueAlertsData = await overdueAlertsResponse.json();
      results.overdueAlerts = {
        success: overdueAlertsResponse.ok,
        emailsSent: overdueAlertsData.emailsSent || 0,
        error: overdueAlertsResponse.ok ? null : overdueAlertsData.error
      };
    } catch (error) {
      console.error('Overdue alerts error:', error);
      results.overdueAlerts.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const totalEmailsSent = results.dueAlerts.emailsSent + results.overdueAlerts.emailsSent;
    const allSuccessful = results.dueAlerts.success && results.overdueAlerts.success;

    console.log(`Daily email checks completed. Total emails sent: ${totalEmailsSent}`);

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        message: 'Daily email checks completed',
        totalEmailsSent,
        timestamp: new Date().toISOString(),
        results
      }),
      { 
        status: allSuccessful ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Daily email checks error:', error);
    
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
