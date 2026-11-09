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

export interface PaymentProvider {
  startPayment(input: {
    userId: string;
    plan: PlanDefinition;
  }): Promise<{ status: "mock_paid"; reference: string }>;
}

// Swap this adapter for a verified Flutterwave/DPO implementation later.
export const paymentProvider: PaymentProvider = {
  async startPayment() {
    return {
      status: "mock_paid",
      reference: `mock_${randomUUID()}`,
    };
  },
};

export function getPlan(planId: string): PlanDefinition | undefined {
  return plans.find((plan) => plan.id === planId);
}
