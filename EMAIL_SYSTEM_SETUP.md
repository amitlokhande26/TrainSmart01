# TrainSmart Email System Setup Guide

## 🚀 Overview

This guide will help you set up the complete email notification system for TrainSmart using Resend and Supabase Edge Functions.

## 📧 Email Templates Created

✅ **6 Professional HTML Email Templates:**
- `due-alert-trainee.html` - Orange theme, alerts trainees about upcoming due dates
- `due-alert-trainer.html` - Purple theme, notifies trainers about trainee due dates
- `overdue-alert-manager.html` - Red theme, urgent notifications for managers
- `welcome-email.html` - Green theme, welcomes new users to the system
- `completion-confirmation.html` - Green theme, confirms training completion
- `signoff-notification.html` - Blue theme, notifies about trainer approval/rejection

## 🔧 Edge Functions Created

✅ **6 Supabase Edge Functions:**
- `send_email` - Main email sending function with template processing
- `send_due_alerts` - Sends due alerts (4 days and 1 day before due date)
- `send_overdue_alerts` - Sends overdue notifications to all managers
- `send_welcome_email` - Sends welcome emails to new users
- `send_completion_email` - Sends completion confirmation emails
- `send_signoff_email` - Sends sign-off notification emails
- `daily_email_checks` - Automated daily email checking function

## 📋 Setup Instructions

### 1. Deploy Edge Functions

```bash
# Deploy all functions to Supabase
supabase functions deploy send_email
supabase functions deploy send_due_alerts
supabase functions deploy send_overdue_alerts
supabase functions deploy send_welcome_email
supabase functions deploy send_completion_email
supabase functions deploy send_signoff_email
supabase functions deploy daily_email_checks
```

### 2. Set Environment Variables

In your Supabase dashboard, go to Edge Functions → Settings and add:

```env
RESEND_API_KEY=your_resend_api_key_here
SITE_URL=https://your-domain.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Set Up Resend Templates (Optional)

You can also create templates in your Resend dashboard using the HTML files provided. This gives you:
- Template versioning
- Visual template editor
- Better template management

### 4. Configure Cron Jobs

#### Option A: Vercel Cron Jobs (Recommended)
Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-email-checks",
      "schedule": "0 9 * * *"
    }
  ]
}
```

#### Option B: GitHub Actions
Create `.github/workflows/email-cron.yml`:

```yaml
name: Daily Email Checks
on:
  schedule:
    - cron: '0 9 * * *'  # Run at 9 AM UTC daily
jobs:
  email-checks:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Daily Email Checks
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/daily_email_checks" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

## 🔄 Integration with Existing Flows

### 1. Welcome Emails

Add to your user creation functions:

```typescript
// After creating a new user
await supabase.functions.invoke('send_welcome_email', {
  body: { userId: newUser.id }
});
```

### 2. Completion Confirmations

Add to your training completion functions:

```typescript
// After marking training as complete
await supabase.functions.invoke('send_completion_email', {
  body: { completionId: completion.id }
});
```

### 3. Sign-off Notifications

Add to your sign-off functions:

```typescript
// After trainer signs off
await supabase.functions.invoke('send_signoff_email', {
  body: { signoffId: signoff.id }
});
```

### 4. Manual Email Sending

For manual email sending:

```typescript
await supabase.functions.invoke('send_email', {
  body: {
    template: 'due-alert-trainee',
    to: 'user@example.com',
    subject: 'Training Due Alert',
    variables: {
      trainee_name: 'John Doe',
      module_title: 'Safety Training',
      due_date: '17/01/2024',
      days_remaining: '4'
    }
  }
});
```

## 📊 Email Types & Triggers

### 1. Due Alerts 📅
- **Trigger**: 4 days before due date, 1 day before due date
- **Recipients**: Trainee + Trainer
- **Frequency**: Daily check at 9 AM UTC

### 2. Overdue Alerts 🚨
- **Trigger**: Daily check for assignments past due date
- **Recipients**: All Manager users
- **Frequency**: Daily check at 9 AM UTC

### 3. Welcome Emails 🎉
- **Trigger**: When new user account is created
- **Recipients**: New user
- **Frequency**: On-demand

### 4. Completion Confirmations ✅
- **Trigger**: When training is marked complete
- **Recipients**: Trainee
- **Frequency**: On-demand

### 5. Sign-off Notifications 👨‍🏫
- **Trigger**: When trainer approves/rejects training
- **Recipients**: Trainee
- **Frequency**: On-demand

## 🧪 Testing

### Test Individual Functions

```bash
# Test due alerts
curl -X POST "your-supabase-url/functions/v1/send_due_alerts" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d "{}"

# Test welcome email
curl -X POST "your-supabase-url/functions/v1/send_welcome_email" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id-here"}'
```

### Test Template Rendering

```bash
# Test email sending with specific template
curl -X POST "your-supabase-url/functions/v1/send_email" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "welcome-email",
    "to": "test@example.com",
    "subject": "Test Email",
    "variables": {
      "user_name": "Test User",
      "user_email": "test@example.com",
      "user_role": "Employee",
      "creation_date": "17/01/2024",
      "login_url": "https://your-domain.com/employee"
    }
  }'
```

## 📈 Monitoring & Analytics

### 1. Resend Dashboard
- Monitor email delivery rates
- Track bounce rates
- View email analytics

### 2. Supabase Logs
- Monitor Edge Function execution
- Check for errors in function logs
- Track performance metrics

### 3. Custom Logging
The functions include comprehensive logging for:
- Email sending success/failure
- Template processing
- Database queries
- Error handling

## 🔧 Troubleshooting

### Common Issues

1. **Template Not Found**
   - Ensure templates are in `supabase/functions/send_email/templates/`
   - Check template file names match the mapping

2. **Resend API Errors**
   - Verify RESEND_API_KEY is correct
   - Check Resend account limits
   - Ensure sender email is verified

3. **Database Query Errors**
   - Verify SUPABASE_SERVICE_ROLE_KEY has proper permissions
   - Check RLS policies allow the service role access

4. **Cron Job Not Running**
   - Verify cron job configuration
   - Check hosting platform cron job limits
   - Monitor function logs for errors

## 🎯 Next Steps

1. **Deploy the functions** to your Supabase project
2. **Set up environment variables** with your Resend API key
3. **Test the functions** manually before enabling automation
4. **Integrate with your existing flows** (user creation, training completion)
5. **Set up cron jobs** for automated daily checks
6. **Monitor and optimize** based on email delivery rates

## 📞 Support

If you encounter any issues:
1. Check the Supabase Edge Function logs
2. Verify all environment variables are set correctly
3. Test individual functions manually
4. Review the Resend dashboard for delivery issues

Your TrainSmart email notification system is now ready to keep your users informed and engaged! 🚀
