import nodemailer from 'nodemailer';
import prisma from './db';
import { generateDeliveryPDF } from '@/utils/pdfGenerator';

// Email configuration flags
export const EMAIL_CONFIG = {
  // Set to true to send emails to customers, false to send to office
  SEND_TO_CUSTOMERS: false,
  // Office email address
  OFFICE_EMAIL: process.env.OFFICE_EMAIL || 'infobrfood@gmail.com',
};

// Configure the email transporter
const createTransporter = () => {
  console.log(`Creating email transporter for environment: ${process.env.NODE_ENV}`);
  console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST}`);
  console.log(`EMAIL_PORT: ${process.env.EMAIL_PORT}`);
  console.log(`EMAIL_SECURE: ${process.env.EMAIL_SECURE}`);
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM}`);

  // Always use production SMTP settings for Brevo
  const transporterConfig = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true, // Enable debug output
    logger: true, // Log to console
  };

  console.log('Transporter config:', {
    host: transporterConfig.host,
    port: transporterConfig.port,
    secure: transporterConfig.secure,
    user: transporterConfig.auth.user,
    hasPassword: !!transporterConfig.auth.pass
  });

  return nodemailer.createTransport(transporterConfig);
};

// Create HTML email template for delivery confirmation - matching the clean design
const createDeliveryConfirmationEmail = (
  customerName: string,
  orderNumber: string,
  deliveryTime: string
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your order has been delivered!</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding: 40px 40px 20px 40px;
          background-color: #ffffff;
        }
        .company-logo {
          font-size: 28px;
          font-weight: bold;
          color: #1a1a1a;
          margin-bottom: 24px;
          letter-spacing: 1px;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }
        .subtitle {
          font-size: 16px;
          color: #666;
          margin: 0;
        }
        .content {
          padding: 20px 40px 40px 40px;
        }
        .details-section {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 24px;
          margin: 24px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 500;
          color: #495057;
        }
        .detail-value {
          color: #1a1a1a;
          font-weight: 500;
        }

        .footer {
          text-align: center;
          padding: 24px 40px;
          background-color: #f8f9fa;
          border-top: 1px solid #e9ecef;
        }
        .footer-text {
          font-size: 14px;
          color: #6c757d;
          margin: 0;
        }
        .company-name {
          font-weight: 600;
          color: #495057;
        }
        .help-section {
          margin-top: 32px;
          padding: 20px;
          text-align: center;
        }
        .help-title {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }
        .help-text {
          font-size: 14px;
          color: #666;
          margin: 0;
        }
        .attachment-note {
          background-color: #e3f2fd;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          border-left: 4px solid #2196f3;
        }
        .attachment-text {
          font-size: 14px;
          color: #1565c0;
          margin: 0;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-logo">B&R Food Services</div>
          <h1 class="title">Your order has been delivered!</h1>
          <p class="subtitle">Good news! According to our records, your order has been delivered to you.</p>
        </div>

        <div class="content">
          <div class="details-section">
            <div class="detail-row">
              <span class="detail-label">Order number:</span>
              <span class="detail-value">${orderNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Delivered to:</span>
              <span class="detail-value">${customerName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${deliveryTime}</span>
            </div>
          </div>

          <div class="attachment-note">
            <p class="attachment-text">📎 Your delivery confirmation document is attached to this email for your records.</p>
          </div>

          <div class="help-section">
            <h3 class="help-title">Need help?</h3>
            <p class="help-text">If you have any questions, please contact us by email at support@brfoodservices.com</p>
          </div>
        </div>

        <div class="footer">
          <p class="footer-text">
            <span class="company-name">B&R Food Services</span><br>
            Professional Food Distribution & Delivery Solutions
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send delivery confirmation email with PDF attachment
export const sendDeliveryConfirmationEmail = async (
  stopId: string,
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  deliveryTime: string,
  stopData: any, // Full stop data for PDF generation
  imageUrls: any[], // Image URLs for PDF
  returns: any[], // Return items for PDF
  sendToCustomer: boolean = false // New parameter to control customer vs office email
) => {
  try {
    // Generate the delivery confirmation PDF
    console.log('Generating delivery confirmation PDF...');
    const pdfBuffer = await generateDeliveryPDF(stopData, imageUrls, returns);
    console.log(`PDF generated successfully, size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Create the email HTML content
    const emailHtml = createDeliveryConfirmationEmail(
      customerName,
      orderNumber,
      deliveryTime
    );

    // Determine email recipient and subject based on configuration
    const shouldSendToCustomer = sendToCustomer && EMAIL_CONFIG.SEND_TO_CUSTOMERS;
    const actualRecipient = shouldSendToCustomer ? customerEmail : EMAIL_CONFIG.OFFICE_EMAIL;
    const emailSubject = shouldSendToCustomer
      ? 'Your order has been delivered!'
      : `Delivery Completed - ${customerName} - Order ${orderNumber}`;

    // Create the email record in the database
    const emailRecord = await prisma.customerEmail.create({
      data: {
        stopId,
        customerEmail: actualRecipient, // Store actual recipient
        subject: emailSubject,
        body: emailHtml,
        signedInvoiceUrl: '', // Not needed since we're attaching PDF
        originalInvoiceUrl: '', // Not needed since we're attaching PDF
        status: 'PENDING',
      },
    });

    // Create the transporter
    const transporter = createTransporter();

    // Generate filename for the PDF attachment
    const pdfFilename = `delivery-confirmation-${orderNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.pdf`;

    // Send the email with PDF attachment
    console.log(`Attempting to send email to: ${actualRecipient} (${shouldSendToCustomer ? 'customer' : 'office'})`);
    console.log(`PDF attachment size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`Email configuration - SEND_TO_CUSTOMERS: ${EMAIL_CONFIG.SEND_TO_CUSTOMERS}`);

    const info = await transporter.sendMail({
      from: `"B&R Food Services" <${process.env.EMAIL_FROM || 'infobrfood@gmail.com'}>`,
      to: actualRecipient,
      subject: emailSubject,
      html: emailRecord.body,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`Email sent successfully - Message ID: ${info.messageId}`);
    console.log(`SMTP Response: ${info.response}`);

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

    // If we have a stopId, try to update any pending email record with the error
    if (stopId) {
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
