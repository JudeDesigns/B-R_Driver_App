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

// Create simple, professional HTML email template for delivery confirmation
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
      <title>Delivery Confirmation - B&R Food Services</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #000000;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .company-logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          margin-bottom: 30px;
          letter-spacing: 1px;
        }
        .title {
          font-size: 22px;
          font-weight: bold;
          color: #000000;
          margin: 0 0 20px 0;
        }
        .message {
          font-size: 16px;
          color: #000000;
          margin: 0 0 40px 0;
          line-height: 1.5;
        }
        .details {
          margin: 30px 0;
          padding: 0;
        }
        .detail-row {
          margin: 15px 0;
          font-size: 16px;
          color: #000000;
        }
        .detail-label {
          font-weight: bold;
          display: inline-block;
          width: 140px;
        }
        .detail-value {
          color: #000000;
        }
        .attachment-note {
          margin: 40px 0;
          padding: 20px;
          border: 1px solid #000000;
          text-align: center;
          font-size: 16px;
          color: #000000;
        }
        .footer {
          text-align: center;
          margin-top: 50px;
          padding-top: 30px;
          border-top: 1px solid #000000;
        }
        .footer-text {
          font-size: 14px;
          color: #000000;
          margin: 0;
        }
        .company-name {
          font-weight: bold;
          color: #000000;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-logo">B&R FOOD SERVICES</div>
          <h1 class="title">Your order has been delivered!</h1>
          <p class="message">
            Thank you for your patronage. Your order has been successfully delivered.
            Attached to this email is the PDF containing important information about your delivery.
          </p>
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Order number:</span>
            <span class="detail-value">${orderNumber}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Delivered to:</span>
            <span class="detail-value">${customerName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Delivery time:</span>
            <span class="detail-value">${deliveryTime}</span>
          </div>
        </div>

        <div class="attachment-note">
          <p>📎 Delivery confirmation document attached</p>
        </div>

        <div class="footer">
          <p class="footer-text">
            <span class="company-name">B&R Food Services</span><br>
            Thank you for choosing our services
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
