/** @jest-environment node */
import { POST } from "../check-overdue-end-of-day/route";
import prisma from "@/lib/db";
import { findOverdueEndOfDayDrivers } from "@/lib/overdueEndOfDay";
import nodemailer from "nodemailer";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    endOfDayOverdueAlert: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/overdueEndOfDay", () => ({
  findOverdueEndOfDayDrivers: jest.fn(),
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  endOfDayOverdueAlert: { findUnique: jest.Mock; create: jest.Mock };
};

const mockedFindOverdue = findOverdueEndOfDayDrivers as jest.Mock;
const mockedCreateTransport = nodemailer.createTransport as jest.Mock;

function overdueItem(overrides: Partial<any> = {}) {
  return {
    routeId: "route-1",
    routeNumber: "R1",
    driverId: "driver-1",
    driverName: "John Smith",
    lastStopCompletionTime: new Date(),
    hoursOverdue: 4.5,
    ...overrides,
  };
}

describe("POST /api/internal/check-overdue-end-of-day", () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail = jest.fn().mockResolvedValue(true);
    mockedCreateTransport.mockReturnValue({ sendMail });
  });

  it("returns { processed: 0, newAlerts: 0 } when there are no overdue drivers", async () => {
    mockedFindOverdue.mockResolvedValue([]);

    const response = await POST();
    const data = await response.json();

    expect(data).toEqual({ processed: 0, newAlerts: 0 });
  });

  it("creates an EndOfDayOverdueAlert and sends an email for a new overdue driver", async () => {
    const item = overdueItem();
    mockedFindOverdue.mockResolvedValue([item]);
    mockedPrisma.endOfDayOverdueAlert.findUnique.mockResolvedValue(null);
    mockedPrisma.endOfDayOverdueAlert.create.mockResolvedValue({ id: "alert-1" });

    const response = await POST();
    const data = await response.json();

    expect(mockedPrisma.endOfDayOverdueAlert.create).toHaveBeenCalledWith({
      data: { routeId: item.routeId, driverId: item.driverId },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(data.newAlerts).toBe(1);
    expect(data.processed).toBe(1);
  });

  it("does not create an alert or send email again for an already-alerted driver", async () => {
    const item = overdueItem();
    mockedFindOverdue.mockResolvedValue([item]);
    mockedPrisma.endOfDayOverdueAlert.findUnique.mockResolvedValue({ id: "existing-alert" });

    const response = await POST();
    const data = await response.json();

    expect(mockedPrisma.endOfDayOverdueAlert.create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(data.newAlerts).toBe(0);
    expect(data.processed).toBe(1);
  });

  it("still returns 200 when sendMail rejects (email failure doesn't break the response)", async () => {
    const item = overdueItem();
    mockedFindOverdue.mockResolvedValue([item]);
    mockedPrisma.endOfDayOverdueAlert.findUnique.mockResolvedValue(null);
    mockedPrisma.endOfDayOverdueAlert.create.mockResolvedValue({ id: "alert-1" });
    sendMail.mockRejectedValue(new Error("smtp down"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.endOfDayOverdueAlert.create).toHaveBeenCalledTimes(1);
    expect(data.newAlerts).toBe(1);
  });

  it("processed always equals overdue.length regardless of new vs already-alerted mix", async () => {
    const newItem = overdueItem({ routeId: "route-new", driverId: "driver-new" });
    const alreadyItem = overdueItem({ routeId: "route-old", driverId: "driver-old" });
    mockedFindOverdue.mockResolvedValue([newItem, alreadyItem]);

    mockedPrisma.endOfDayOverdueAlert.findUnique.mockImplementation(({ where }: any) => {
      if (where.routeId_driverId.driverId === "driver-old") {
        return Promise.resolve({ id: "existing-alert" });
      }
      return Promise.resolve(null);
    });
    mockedPrisma.endOfDayOverdueAlert.create.mockResolvedValue({ id: "alert-new" });

    const response = await POST();
    const data = await response.json();

    expect(data.processed).toBe(2);
    expect(data.newAlerts).toBe(1);
    expect(mockedPrisma.endOfDayOverdueAlert.create).toHaveBeenCalledTimes(1);
  });
});
