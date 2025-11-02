import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email templates mapping
const EMAIL_TEMPLATES = {
  'due-alert-trainee': 'due-alert-trainee.html',
  'due-alert-trainer': 'due-alert-trainer.html',
  'overdue-alert-manager': 'overdue-alert-manager.html',
  'welcome-email': 'welcome-email.html',
  'completion-confirmation': 'completion-confirmation.html',
  'signoff-notification': 'signoff-notification.html'
};

interface EmailRequest {
  template: keyof typeof EMAIL_TEMPLATES;
  to: string | string[];
  subject: string;
  variables: Record<string, string>;
  from?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
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

    const body: EmailRequest = await req.json();
    const template = body.template;
    const to = body.to;
    const subject = body.subject;
    const variables = body.variables;
    const fallbackFromAddress = Deno.env.get('FROM_EMAIL_ADDRESS') || 'no-reply@smartgendigital.com';
    const fallbackFromName = Deno.env.get('FROM_EMAIL_NAME') || 'TrainSmart';
    const from = body.from || `${fallbackFromName} <${fallbackFromAddress}>`;

    // Validate required fields
    if (!template || !to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template, to, subject' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ error: 'Email service configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    // Basic validation: if using a custom From domain, ensure it matches a verified domain (best-effort warning)
    if (from.includes('@')) {
      const fromDomain = from.substring(from.indexOf('@') + 1).replace('>', '').trim();
      const allowedDomain = (Deno.env.get('ALLOWED_EMAIL_DOMAIN') || 'smartgendigital.com').toLowerCase();
      if (!fromDomain.endsWith(allowedDomain)) {
        console.warn(`From address domain (${fromDomain}) does not match allowed domain (${allowedDomain}). Resend may reject this message.`);
      }
    }

    // Load email template
    const templateFile = EMAIL_TEMPLATES[template];
    if (!templateFile) {
      return new Response(
        JSON.stringify({ error: `Template '${template}' not found` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let templateContent: string;
    try {
      // Read template file from the templates directory
      const templatePath = `./templates/${templateFile}`;
      templateContent = await Deno.readTextFile(templatePath);
    } catch (error) {
      console.error('Error reading template file:', error);
      return new Response(
        JSON.stringify({ error: 'Template file not found' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Replace template variables
    let emailContent = templateContent;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
      emailContent = emailContent.replace(placeholder, value || '');
    });

    // Prepare email data for Resend
    const emailData = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailContent,
    };

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });
    // Read response body safely (JSON or text)
    let resendData: any = null;
    let resendRaw: string | null = null;
    try {
      resendData = await resendResponse.json();
    } catch (_e) {
      try {
        resendRaw = await resendResponse.text();
      } catch (_e2) {
        resendRaw = null;
      }
    }

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData || resendRaw);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Email sending failed: ${
            (resendData && (resendData.message || resendData.error)) || (resendRaw || 'Unknown error')
          }`,
          provider: resendData || resendRaw
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful email sending
    console.log(`Email sent successfully:`, {
      template,
      to,
      subject,
      messageId: resendData.id
    });

    const response: EmailResponse = {
      success: true,
      messageId: resendData.id
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email sending error:', error);
    
    const response: EmailResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
