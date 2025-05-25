import nodemailer from 'nodemailer';
import prisma from './db';

// Configure the email transporter
const createTransporter = () => {
  // For development, use a test account
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
    });
  }

  // For production, use the configured SMTP server
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Create HTML email template for delivery confirmation
const createDeliveryConfirmationEmail = (
  customerName: string,
  orderNumber: string,
  deliveryTime: string,
  hasReturns: boolean,
  returnReasons: string[],
  signedInvoiceUrl: string,
  originalInvoiceUrl: string
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 200px;
          height: auto;
        }
        .content {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 5px;
        }
        .delivery-details {
          margin-bottom: 20px;
        }
        .returns {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .button {
          display: inline-block;
          background-color: #000;
          color: #fff;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin-right: 10px;
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://example.com/logo.png" alt="B&R Food Services Logo" class="logo">
        </div>
        <div class="content">
          <h2>Delivery Confirmation</h2>
          <p>Hello ${customerName},</p>
          <p>Your order has been successfully delivered.</p>
          
          <div class="delivery-details">
            <p><strong>Order #:</strong> ${orderNumber}</p>
            <p><strong>Delivered To:</strong> ${customerName}</p>
            <p><strong>Time:</strong> ${deliveryTime}</p>
            <p><strong>Returns:</strong> ${hasReturns ? 'Yes' : 'No'}</p>
          </div>
          
          ${hasReturns ? `
          <div class="returns">
            <h3>Returned Items Summary</h3>
            <ul>
              ${returnReasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="invoice-links">
            <p>You can download your invoices using the links below:</p>
            <a href="${signedInvoiceUrl}" class="button">Download Signed Invoice</a>
            <a href="${originalInvoiceUrl}" class="button">Download Original Invoice</a>
          </div>
        </div>
        
        <div class="footer">
          <p>B&R Food Services</p>
          <p>123 Main Street, City, State, ZIP</p>
          <p>Phone: (123) 456-7890 | Email: info@brfoodservices.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send delivery confirmation email
export const sendDeliveryConfirmationEmail = async (
  stopId: string,
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  deliveryTime: string,
  hasReturns: boolean,
  returnReasons: string[],
  signedInvoiceUrl: string,
  originalInvoiceUrl: string
) => {
  try {
    // Create the email record in the database
    const emailRecord = await prisma.customerEmail.create({
      data: {
        stopId,
        customerEmail,
        subject: 'B&R Food Services - Delivery Confirmation',
        body: createDeliveryConfirmationEmail(
          customerName,
          orderNumber,
          deliveryTime,
          hasReturns,
          returnReasons,
          signedInvoiceUrl,
          originalInvoiceUrl
        ),
        signedInvoiceUrl,
        originalInvoiceUrl,
        status: 'PENDING',
      },
    });

    // Create the transporter
    const transporter = createTransporter();

    // Send the email
    const info = await transporter.sendMail({
      from: `"B&R Food Services" <${process.env.EMAIL_FROM || 'noreply@brfoodservices.com'}>`,
      to: customerEmail,
      subject: 'B&R Food Services - Delivery Confirmation',
      html: emailRecord.body,
    });

    // Update the email record with the sent status
    await prisma.customerEmail.update({
      where: { id: emailRecord.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);

    // If we have an email record, update it with the error
    if (arguments[0]) {
      try {
        const existingEmail = await prisma.customerEmail.findFirst({
          where: {
            stopId,
            status: 'PENDING',
          },
        });

        if (existingEmail) {
          await prisma.customerEmail.update({
            where: { id: existingEmail.id },
            data: {
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      } catch (dbError) {
        console.error('Error updating email record:', dbError);
      }
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export default {
  sendDeliveryConfirmationEmail,
};
