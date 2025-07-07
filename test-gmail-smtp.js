const nodemailer = require('nodemailer');
require('dotenv').config();

// Test Gmail SMTP configuration
async function testGmailSMTP() {
  console.log('🧪 TESTING GMAIL SMTP CONFIGURATION');
  console.log('===================================\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST}`);
  console.log(`EMAIL_PORT: ${process.env.EMAIL_PORT}`);
  console.log(`EMAIL_SECURE: ${process.env.EMAIL_SECURE}`);
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM}`);
  console.log(`OFFICE_EMAIL: ${process.env.OFFICE_EMAIL}`);
  console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? '***CONFIGURED***' : 'NOT SET'}\n`);

  // Validate required variables
  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.log('\n📝 Please update your .env file with Gmail SMTP settings:');
    console.log('EMAIL_HOST="smtp.gmail.com"');
    console.log('EMAIL_PORT="587"');
    console.log('EMAIL_SECURE="false"');
    console.log('EMAIL_USER="infobrfood@gmail.com"');
    console.log('EMAIL_PASS="qjkm hzqb jmji bgkp"');
    console.log('EMAIL_FROM="infobrfood@gmail.com"');
    console.log('OFFICE_EMAIL="infobrfood@gmail.com"');
    return;
  }

  // Create transporter
  console.log('🔧 Creating Gmail SMTP transporter...');
  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true,
  });

  try {
    // Test connection
    console.log('🔍 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📧 Sending test email...');
    const testEmail = {
      from: `"B&R Food Services Test" <${process.env.EMAIL_FROM}>`,
      to: process.env.OFFICE_EMAIL || process.env.EMAIL_USER,
      subject: 'B&R Driver App - Gmail SMTP Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Gmail SMTP Test Successful! 🎉</h2>
          <p>This is a test email from the B&R Driver App to verify Gmail SMTP configuration.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>SMTP Host:</strong> ${process.env.EMAIL_HOST}</li>
              <li><strong>SMTP Port:</strong> ${process.env.EMAIL_PORT}</li>
              <li><strong>From Email:</strong> ${process.env.EMAIL_FROM}</li>
              <li><strong>Office Email:</strong> ${process.env.OFFICE_EMAIL}</li>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          
          <p><strong>✅ Gmail SMTP is working correctly!</strong></p>
          <p>Delivery confirmation emails will now be sent to your office email address.</p>
          
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated test email from the B&R Food Services Driver App.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📬 Email sent to: ${testEmail.to}\n`);

    console.log('🎉 GMAIL SMTP CONFIGURATION TEST COMPLETE!');
    console.log('==========================================');
    console.log('✅ SMTP connection working');
    console.log('✅ Test email sent successfully');
    console.log('✅ Ready for production use');
    console.log('\n📋 Next Steps:');
    console.log('1. Check your office email for the test message');
    console.log('2. Complete a delivery in the app to test automatic emails');
    console.log('3. Verify delivery confirmation emails are received');

  } catch (error) {
    console.error('❌ Gmail SMTP test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify Gmail app password is correct');
    console.log('2. Ensure 2-factor authentication is enabled on Gmail');
    console.log('3. Check that "Less secure app access" is disabled (use app passwords)');
    console.log('4. Verify network connectivity to smtp.gmail.com:587');
    console.log('5. Check firewall settings');
    
    if (error.code === 'EAUTH') {
      console.log('\n🔐 Authentication Error:');
      console.log('- Double-check your Gmail app password');
      console.log('- Make sure you\'re using the app password, not your regular Gmail password');
      console.log('- Verify the email address is correct');
    }
    
    if (error.code === 'ECONNECTION') {
      console.log('\n🌐 Connection Error:');
      console.log('- Check your internet connection');
      console.log('- Verify firewall allows outbound connections on port 587');
      console.log('- Try using port 465 with secure: true');
    }
  }
}

// Run the test
testGmailSMTP().catch(console.error);
