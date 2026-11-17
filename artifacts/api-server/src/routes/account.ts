import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CancelSubscriptionResponse,
  GetAccountResponse,
  ListPlansResponse,
  RequestManualPaymentBody,
  RequestManualPaymentResponse,
} from "@workspace/api-zod";
import {
  db,
  adsTable,
  distributionEventsTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  getAppUser,
  requireAuth,
  respondWithApiError,
} from "../lib/adReachAuth";
import { createManualPaymentReference, getPlan, plans } from "../lib/paymentProvider";

const router: IRouter = Router();
const FREE_ADS_LIMIT = 5;
const PAYMENT_WHATSAPP_NUMBER = "260760312951";

router.get("/plans", (_req, res): void => {
  res.json(ListPlansResponse.parse(plans));
});

router.get("/account", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = await getAppUser(req);
    const now = new Date();
    const [ads, allSubscriptions, events] = await Promise.all([
      db
        .select()
        .from(adsTable)
        .where(eq(adsTable.userId, user.id))
        .orderBy(desc(adsTable.createdAt)),
      db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, user.id))
        .orderBy(desc(subscriptionsTable.startedAt)),
      db
        .select()
        .from(distributionEventsTable)
        .where(eq(distributionEventsTable.userId, user.id))
        .orderBy(desc(distributionEventsTable.createdAt))
        .limit(8),
    ]);

    const latestSubscription = allSubscriptions[0] ?? null;
    let subscription = latestSubscription;
    if (
      latestSubscription?.status === "active" &&
      latestSubscription.expiresAt <= now
    ) {
      const [expired] = await db
        .update(subscriptionsTable)
        .set({ status: "expired" })
        .where(eq(subscriptionsTable.id, latestSubscription.id))
        .returning();
      subscription = expired ?? latestSubscription;
    }

    const freeAdsUsed = ads.filter((ad) => ad.planId === "free").length;
    const hasValidSubscription =
      subscription !== null &&
      (subscription.status === "active" || subscription.status === "canceled") &&
      subscription.expiresAt > now;

    res.json(
      GetAccountResponse.parse({
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        ads,
        plans,
        subscription,
        freeAdsUsed,
        freeAdsLimit: FREE_ADS_LIMIT,
        canSubmit: freeAdsUsed < FREE_ADS_LIMIT || hasValidSubscription,
        events,
      }),
    );
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.post(
  "/subscriptions/manual-payment",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const body = RequestManualPaymentBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: "Choose a valid subscription plan." });
        return;
      }

      const user = await getAppUser(req);
      const plan = getPlan(body.data.planId);
      if (!plan) {
        res.status(400).json({ error: "Choose a valid subscription plan." });
        return;
      }

      const now = new Date();
      const [latestSubscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, user.id))
        .orderBy(desc(subscriptionsTable.startedAt))
        .limit(1);
      const hasCurrentAccess =
        latestSubscription !== undefined &&
        (latestSubscription.status === "active" ||
          latestSubscription.status === "canceled") &&
        latestSubscription.expiresAt > now;
      if (hasCurrentAccess) {
        res.status(409).json({
          error: "Your current subscription is still active.",
        });
        return;
      }
      if (latestSubscription?.status === "payment_pending") {
        res.status(409).json({
          error: "You already have a payment request awaiting confirmation.",
        });
        return;
      }
      const paymentReference = createManualPaymentReference();
      const [subscription] = await db
        .insert(subscriptionsTable)
        .values({
          id: paymentReference,
          userId: user.id,
          planId: plan.id,
          status: "payment_pending",
          amountK: plan.amountK,
          currency: plan.currency,
          paymentStatus: "pending",
          startedAt: now,
          expiresAt: now,
        })
        .returning();

      const message = [
        "Hi, I want to activate my AdReach subscription.",
        `Plan: ${plan.name} (K${plan.amountK} per ${plan.interval}).`,
        `Payment reference: ${paymentReference}.`,
        `Name: ${user.name}.`,
        `Email: ${user.email}.`,
        "I have made the payment and will attach my screenshot here.",
      ].join(" ");
      const whatsappUrl = new URL(`https://wa.me/${PAYMENT_WHATSAPP_NUMBER}`);
      whatsappUrl.searchParams.set("text", message);
      res.status(201).json(
        RequestManualPaymentResponse.parse({
          subscription,
          whatsappUrl: whatsappUrl.toString(),
          whatsappNumber: "+260 760 312 951",
          instructions:
            "Send your payment screenshot in this WhatsApp chat. Paid access starts only after an admin confirms it.",
        }),
      );
    } catch (error) {
      respondWithApiError(req, res, error);
    }
  },
);

router.post(
  "/subscriptions/cancel",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const user = await getAppUser(req);
      const now = new Date();
      const [subscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, user.id),
            eq(subscriptionsTable.status, "active"),
            gt(subscriptionsTable.expiresAt, now),
          ),
        )
        .orderBy(desc(subscriptionsTable.startedAt))
        .limit(1);

      if (!subscription) {
        res.status(404).json({ error: "No active subscription was found." });
        return;
      }

      const [canceled] = await db
        .update(subscriptionsTable)
        .set({ status: "canceled", canceledAt: now })
        .where(eq(subscriptionsTable.id, subscription.id))
        .returning();
      res.json(CancelSubscriptionResponse.parse(canceled));
    } catch (error) {
      respondWithApiError(req, res, error);
    }
  },
);

export default router;
