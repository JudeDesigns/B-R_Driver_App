const nodemailer = require('nodemailer');
require('dotenv').config();

// Enhanced email debugging for Brevo SMTP
async function debugBrevoEmail() {
  console.log('🔍 B&R Food Services - Brevo SMTP Debug Tool');
  console.log('=============================================');
  console.log('');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Environment Variables Check');
  console.log('=====================================');
  
  const emailConfig = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM
  };

  console.log(`EMAIL_HOST: ${emailConfig.host || 'NOT SET'}`);
  console.log(`EMAIL_PORT: ${emailConfig.port || 'NOT SET'}`);
  console.log(`EMAIL_SECURE: ${emailConfig.secure || 'NOT SET'}`);
  console.log(`EMAIL_USER: ${emailConfig.user || 'NOT SET'}`);
  console.log(`EMAIL_PASS: ${emailConfig.pass ? '***SET***' : 'NOT SET'}`);
  console.log(`EMAIL_FROM: ${emailConfig.from || 'NOT SET'}`);
  console.log('');

  // Check for missing configuration
  const missingConfig = [];
  if (!emailConfig.host) missingConfig.push('EMAIL_HOST');
  if (!emailConfig.port) missingConfig.push('EMAIL_PORT');
  if (!emailConfig.user) missingConfig.push('EMAIL_USER');
  if (!emailConfig.pass) missingConfig.push('EMAIL_PASS');
  if (!emailConfig.from) missingConfig.push('EMAIL_FROM');

  if (missingConfig.length > 0) {
    console.log('❌ Missing Configuration:');
    missingConfig.forEach(config => console.log(`   - ${config}`));
    console.log('');
    console.log('💡 Brevo SMTP Configuration:');
    console.log('   EMAIL_HOST=smtp-relay.brevo.com');
    console.log('   EMAIL_PORT=587');
    console.log('   EMAIL_SECURE=false');
    console.log('   EMAIL_USER=your-brevo-login-email');
    console.log('   EMAIL_PASS=your-brevo-smtp-key');
    console.log('   EMAIL_FROM=your-verified-sender@domain.com');
    return;
  }

  // Step 2: Test SMTP Connection
  console.log('🔌 Step 2: SMTP Connection Test');
  console.log('===============================');

  try {
    const transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: parseInt(emailConfig.port),
      secure: emailConfig.secure === 'true',
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
      debug: true, // Enable debug output
      logger: true, // Log to console
    });

    console.log('⚡ Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    console.log('');

    // Step 3: Send Test Email
    console.log('📧 Step 3: Sending Test Email');
    console.log('=============================');

    const testEmail = {
      from: `"B&R Food Services Test" <${emailConfig.from}>`,
      to: emailConfig.user, // Send to yourself for testing
      subject: 'B&R Food Services - Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Email Test Successful!</h2>
          <p>This is a test email from B&R Food Services.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>SMTP Server:</strong> ${emailConfig.host}</p>
          <p><strong>Port:</strong> ${emailConfig.port}</p>
          <p>If you receive this email, your Brevo SMTP configuration is working correctly.</p>
        </div>
      `,
    };

    console.log(`📤 Sending test email to: ${testEmail.to}`);
    console.log(`📤 From: ${testEmail.from}`);
    console.log(`📤 Subject: ${testEmail.subject}`);
    console.log('');

    const info = await transporter.sendMail(testEmail);
    
    console.log('✅ Test Email Sent Successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Response: ${info.response}`);
    console.log('');

    // Step 4: Brevo-Specific Checks
    console.log('🔍 Step 4: Brevo-Specific Diagnostics');
    console.log('====================================');
    
    console.log('✅ Email Configuration Checks:');
    console.log(`   - SMTP Host: ${emailConfig.host === 'smtp-relay.brevo.com' ? '✅ Correct' : '❌ Should be smtp-relay.brevo.com'}`);
    console.log(`   - Port: ${emailConfig.port === '587' ? '✅ Correct' : '❌ Should be 587'}`);
    console.log(`   - Security: ${emailConfig.secure === 'false' ? '✅ Correct (STARTTLS)' : '❌ Should be false for port 587'}`);
    console.log('');

    console.log('📋 Next Steps:');
    console.log('1. Check your email inbox (including spam folder)');
    console.log('2. Verify sender email is confirmed in Brevo dashboard');
    console.log('3. Check Brevo sending statistics for delivery status');
    console.log('4. Ensure recipient email is not blacklisted');
    console.log('');

    console.log('🎯 If test email works but delivery confirmation doesn\'t:');
    console.log('   - Check PDF attachment size (Brevo has limits)');
    console.log('   - Verify customer email addresses are valid');
    console.log('   - Check Brevo daily sending limits');
    console.log('   - Review Brevo logs for bounce/rejection reasons');

  } catch (error) {
    console.log('❌ SMTP Connection/Send Failed:');
    console.log(`   Error: ${error.message}`);
    console.log('');

    // Specific Brevo error diagnostics
    if (error.message.includes('authentication')) {
      console.log('🔐 Authentication Error - Check:');
      console.log('   - EMAIL_USER should be your Brevo login email');
      console.log('   - EMAIL_PASS should be your Brevo SMTP key (not password)');
      console.log('   - Generate new SMTP key in Brevo dashboard if needed');
    } else if (error.message.includes('connection')) {
      console.log('🌐 Connection Error - Check:');
      console.log('   - Server firewall allows outbound port 587');
      console.log('   - EMAIL_HOST=smtp-relay.brevo.com');
      console.log('   - EMAIL_PORT=587');
      console.log('   - EMAIL_SECURE=false');
    } else if (error.message.includes('sender')) {
      console.log('📧 Sender Error - Check:');
      console.log('   - EMAIL_FROM is verified in Brevo dashboard');
      console.log('   - Sender domain is authenticated');
      console.log('   - No typos in sender email address');
    }
    
    console.log('');
    console.log('💡 Brevo Troubleshooting Resources:');
    console.log('   - Brevo Dashboard: https://app.brevo.com/');
    console.log('   - SMTP Settings: Account > SMTP & API');
    console.log('   - Sending Statistics: Statistics > Email');
    console.log('   - Support: https://help.brevo.com/');
  }
}

// Run the debug tool
debugBrevoEmail().then(() => {
  console.log('Brevo email debug completed.');
}).catch((error) => {
  console.error('Debug tool failed:', error);
});
