import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CancelSubscriptionResponse,
  GetAccountResponse,
  ListPlansResponse,
  StartMockCheckoutBody,
  StartMockCheckoutResponse,
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
import { getPlan, paymentProvider, plans } from "../lib/paymentProvider";

const router: IRouter = Router();
const FREE_ADS_LIMIT = 5;

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
  "/subscriptions/mock-checkout",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const body = StartMockCheckoutBody.safeParse(req.body);
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

      const payment = await paymentProvider.startPayment({
        userId: user.id,
        plan,
      });
      const startedAt = new Date();
      const expiresAt = new Date(startedAt);
      if (plan.interval === "week") {
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
      } else {
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
      }

      await db
        .update(subscriptionsTable)
        .set({ status: "canceled", canceledAt: startedAt, expiresAt: startedAt })
        .where(
          and(
            eq(subscriptionsTable.userId, user.id),
            eq(subscriptionsTable.status, "active"),
            gt(subscriptionsTable.expiresAt, startedAt),
          ),
        );

      const [subscription] = await db
        .insert(subscriptionsTable)
        .values({
          id: payment.reference,
          userId: user.id,
          planId: plan.id,
          status: "active",
          amountK: plan.amountK,
          currency: plan.currency,
          paymentStatus: payment.status,
          startedAt,
          expiresAt,
        })
        .returning();

      res.status(201).json(StartMockCheckoutResponse.parse(subscription));
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
