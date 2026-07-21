import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import prisma from "@/lib/db";
import { EMAIL_CONFIG } from "@/lib/email";
import { findOverdueEndOfDayDrivers } from "@/lib/overdueEndOfDay";

// POST /api/internal/check-overdue-end-of-day
//
// INTERNAL USE ONLY. This endpoint is intentionally unauthenticated — it is
// not linked from any UI and is intended to be called only by the in-process
// background poller started in server.js (every 15 minutes). It detects
// drivers who finished their route more than 3 hours ago but have not yet
// submitted an End-of-Day safety check, and sends a one-time email
// notification to the office for each newly-detected case (deduped via the
// EndOfDayOverdueAlert table so we don't spam on every polling cycle).
export async function POST() {
  try {
    const overdue = await findOverdueEndOfDayDrivers(prisma);

    let newAlerts = 0;

    for (const item of overdue) {
      const existingAlert = await prisma.endOfDayOverdueAlert.findUnique({
        where: {
          routeId_driverId: {
            routeId: item.routeId,
            driverId: item.driverId,
          },
        },
      });

      if (existingAlert) {
        // Already notified for this route+driver — skip.
        continue;
      }

      await prisma.endOfDayOverdueAlert.create({
        data: {
          routeId: item.routeId,
          driverId: item.driverId,
        },
      });
      newAlerts++;

      try {
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT || "587"),
          secure: process.env.EMAIL_SECURE === "true",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"B&R Food Services" <${process.env.EMAIL_FROM || "info@brfood.us"}>`,
          to: process.env.OFFICE_EMAIL || EMAIL_CONFIG.OFFICE_EMAIL,
          subject: `Overdue End-of-Day — ${item.driverName} — Route ${item.routeNumber || item.routeId}`,
          html: `
            <p>Driver <strong>${item.driverName}</strong> completed their last stop on
            Route <strong>${item.routeNumber || item.routeId}</strong>
            approximately <strong>${item.hoursOverdue}</strong> hours ago,
            but has not yet submitted an End-of-Day safety check.</p>
          `,
        });
      } catch (emailError) {
        console.error("Error sending overdue end-of-day email:", emailError);
      }
    }

    return NextResponse.json({ processed: overdue.length, newAlerts });
  } catch (error) {
    console.error("Error checking overdue end-of-day drivers:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
