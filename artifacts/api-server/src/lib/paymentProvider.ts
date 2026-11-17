import { randomUUID } from "node:crypto";

export type PlanId = "weekly" | "monthly";
export type PlanDefinition = {
  id: PlanId;
  name: string;
  amountK: number;
  currency: "ZMK";
  interval: "week" | "month";
  description: string;
};

export const plans: PlanDefinition[] = [
  {
    id: "weekly",
    name: "Tier 1",
    amountK: 20,
    currency: "ZMK",
    interval: "week",
    description: "Weekly access after your five free ads.",
  },
  {
    id: "monthly",
    name: "Tier 2",
    amountK: 100,
    currency: "ZMK",
    interval: "month",
    description: "Monthly access after your five free ads.",
  },
];

export function createManualPaymentReference(): string {
  return `AR-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function getSubscriptionExpiry(
  start: Date,
  interval: PlanDefinition["interval"],
): Date {
  const expiresAt = new Date(start);
  if (interval === "week") {
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
    return expiresAt;
  }
  const dayOfMonth = expiresAt.getUTCDate();
  expiresAt.setUTCDate(1);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);
  const lastDayOfMonth = new Date(
    Date.UTC(
      expiresAt.getUTCFullYear(),
      expiresAt.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  expiresAt.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
  return expiresAt;
}

export function getPlan(planId: string): PlanDefinition | undefined {
  return plans.find((plan) => plan.id === planId);
}
