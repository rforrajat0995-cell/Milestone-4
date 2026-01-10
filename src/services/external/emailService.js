/**
 * Email service using Nodemailer with Gmail SMTP
 * Creates email drafts for bookings, reschedules, and cancellations
 */

import nodemailer from 'nodemailer';

// Initialize email transporter
let transporter = null;

/**
 * Gets configured email transporter
 */
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword
    }
  });

  return transporter;
}

/**
 * Creates an email draft for a new booking
 * @param {Object} bookingData - { bookingCode, topic, selectedSlot, secureLink }
 * @returns {Promise<Object>} Email message info
 */
export async function createBookingEmailDraft(bookingData) {
  try {
    const emailTransporter = getTransporter();
    const { bookingCode, topic, selectedSlot, secureLink } = bookingData;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER, // Send to self as draft (or use a specific advisor email)
      subject: `New Advisor Booking: ${bookingCode} - ${topic}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">New Advisor Booking Confirmed</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Code:</strong> ${bookingCode}</p>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Date & Time:</strong> ${selectedSlot.formatted} IST</p>
          </div>
          
          <p>This is a tentative booking hold. The customer needs to complete their contact details using the secure link below.</p>
          
          <div style="margin: 30px 0;">
            <a href="${secureLink}" 
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Complete Booking Details
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Secure Link: <a href="${secureLink}">${secureLink}</a>
          </p>
        </div>
      `,
      text: `
New Advisor Booking Confirmed

Booking Code: ${bookingCode}
Topic: ${topic}
Date & Time: ${selectedSlot.formatted} IST

This is a tentative booking hold. The customer needs to complete their contact details using the secure link:

${secureLink}
      `
    };

    // For now, we'll save as draft by sending to self
    // In production, you might want to use Gmail API to create actual drafts
    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log(`[Email Service] Created booking email draft for ${bookingCode}`);
    return info;
  } catch (error) {
    console.error('[Email Service] Error creating booking email draft:', error.message);
    throw error;
  }
}

/**
 * Creates an email draft for a rescheduled booking
 * @param {Object} rescheduleData - { bookingCode, topic, newSlot, previousSlot }
 * @returns {Promise<Object>} Email message info
 */
export async function createRescheduleEmailDraft(rescheduleData) {
  try {
    const emailTransporter = getTransporter();
    const { bookingCode, topic, newSlot, previousSlot } = rescheduleData;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER, // Send to self as draft
      subject: `Booking Rescheduled: ${bookingCode} - ${topic}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">Booking Rescheduled</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Code:</strong> ${bookingCode}</p>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Previous Slot:</strong> ${previousSlot?.formatted || 'N/A'} IST</p>
            <p><strong>New Slot:</strong> ${newSlot.formatted} IST</p>
          </div>
          
          <p>The booking has been successfully rescheduled. Please update your calendar accordingly.</p>
        </div>
      `,
      text: `
Booking Rescheduled

Booking Code: ${bookingCode}
Topic: ${topic}
Previous Slot: ${previousSlot?.formatted || 'N/A'} IST
New Slot: ${newSlot.formatted} IST

The booking has been successfully rescheduled.
      `
    };

    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log(`[Email Service] Created reschedule email draft for ${bookingCode}`);
    return info;
  } catch (error) {
    console.error('[Email Service] Error creating reschedule email draft:', error.message);
    throw error;
  }
}

/**
 * Creates an email draft for a cancelled booking
 * @param {Object} cancellationData - { bookingCode, topic, originalSlot }
 * @returns {Promise<Object>} Email message info
 */
export async function createCancellationEmailDraft(cancellationData) {
  try {
    const emailTransporter = getTransporter();
    const { bookingCode, topic, originalSlot } = cancellationData;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER, // Send to self as draft
      subject: `Booking Cancelled: ${bookingCode} - ${topic}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Booking Cancelled</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Code:</strong> ${bookingCode}</p>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Original Slot:</strong> ${originalSlot?.formatted || 'N/A'} IST</p>
          </div>
          
          <p>The booking has been cancelled. The calendar slot has been freed up.</p>
        </div>
      `,
      text: `
Booking Cancelled

Booking Code: ${bookingCode}
Topic: ${topic}
Original Slot: ${originalSlot?.formatted || 'N/A'} IST

The booking has been cancelled.
      `
    };

    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log(`[Email Service] Created cancellation email draft for ${bookingCode}`);
    return info;
  } catch (error) {
    console.error('[Email Service] Error creating cancellation email draft:', error.message);
    throw error;
  }
}

