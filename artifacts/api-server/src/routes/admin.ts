import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAdminOverviewResponse,
  ListAdminAdsQueryParams,
  ListAdminAdsResponse,
  ListPendingPaymentsResponse,
  ListWebhookLogsResponse,
  ReviewPaymentBody,
  ReviewPaymentParams,
  ReviewPaymentResponse,
  ReviewAdBody,
  ReviewAdParams,
  ReviewAdResponse,
} from "@workspace/api-zod";
import {
  adsTable,
  db,
  distributionEventsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import {
  getAppUser,
  requireAuth,
  respondWithApiError,
} from "../lib/adReachAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { getSubscriptionExpiry } from "../lib/paymentProvider";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

router.use(requireAuth);
router.use(async (req, res, next): Promise<void> => {
  try {
    const user = await getAppUser(req);
    if (user.role !== "admin") {
      res.status(403).json({ error: "Administrator access is required." });
      return;
    }
    next();
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.get("/admin/overview", async (req, res): Promise<void> => {
  try {
    const [ads, events, pendingPayments] = await Promise.all([
      db.select().from(adsTable),
      db
        .select()
        .from(distributionEventsTable)
        .orderBy(desc(distributionEventsTable.createdAt))
        .limit(8),
      db
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "payment_pending")),
    ]);
    const queueEvents = await db
      .select({ id: distributionEventsTable.id })
      .from(distributionEventsTable)
      .where(inArray(distributionEventsTable.status, ["queued", "ready"]));
    res.json(
      GetAdminOverviewResponse.parse({
        pendingAds: ads.filter((ad) => ad.status === "pending").length,
        activeAds: ads.filter((ad) => ad.status === "active").length,
        rejectedAds: ads.filter((ad) => ad.status === "rejected").length,
        queuedEvents: queueEvents.length,
        pendingPayments: pendingPayments.length,
        latestEvents: events,
      }),
    );
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.get("/admin/subscriptions/pending-payments", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        planId: subscriptionsTable.planId,
        status: subscriptionsTable.status,
        amountK: subscriptionsTable.amountK,
        currency: subscriptionsTable.currency,
        paymentStatus: subscriptionsTable.paymentStatus,
        startedAt: subscriptionsTable.startedAt,
        expiresAt: subscriptionsTable.expiresAt,
        canceledAt: subscriptionsTable.canceledAt,
        paymentReviewedAt: subscriptionsTable.paymentReviewedAt,
        paymentReviewNote: subscriptionsTable.paymentReviewNote,
        userName: usersTable.name,
        email: usersTable.email,
      })
      .from(subscriptionsTable)
      .innerJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
      .where(eq(subscriptionsTable.status, "payment_pending"))
      .orderBy(desc(subscriptionsTable.startedAt));
    res.json(ListPendingPaymentsResponse.parse(rows));
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.patch(
  "/admin/subscriptions/:id/payment-review",
  async (req, res): Promise<void> => {
    try {
      const params = ReviewPaymentParams.safeParse(req.params);
      const body = ReviewPaymentBody.safeParse(req.body);
      if (!params.success || !body.success) {
        res.status(400).json({ error: "Choose confirm or reject." });
        return;
      }
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const [pending] = await tx
          .select()
          .from(subscriptionsTable)
          .where(
            and(
              eq(subscriptionsTable.id, params.data.id),
              eq(subscriptionsTable.status, "payment_pending"),
            ),
          )
          .for("update")
          .limit(1);
        if (!pending) return [null];
        if (body.data.decision === "reject") {
          return tx
            .update(subscriptionsTable)
            .set({
              status: "rejected",
              paymentStatus: "rejected",
              paymentReviewedAt: now,
              paymentReviewNote: body.data.note?.trim() || null,
            })
            .where(eq(subscriptionsTable.id, pending.id))
            .returning();
        }

        const expiry = getSubscriptionExpiry(
          now,
          pending.planId === "weekly" ? "week" : "month",
        );
        await tx
          .update(subscriptionsTable)
          .set({
            status: "canceled",
            canceledAt: now,
          })
          .where(
            and(
              eq(subscriptionsTable.userId, pending.userId),
              eq(subscriptionsTable.status, "active"),
              gt(subscriptionsTable.expiresAt, now),
            ),
          );
        return tx
          .update(subscriptionsTable)
          .set({
            status: "active",
            paymentStatus: "confirmed",
            paymentReviewedAt: now,
            paymentReviewNote: body.data.note?.trim() || null,
            startedAt: now,
            expiresAt: expiry,
            canceledAt: null,
          })
          .where(eq(subscriptionsTable.id, pending.id))
          .returning();
      });
      if (!updated) {
        res.status(409).json({
          error: "This payment request has already been reviewed.",
        });
        return;
      }
      res.json(ReviewPaymentResponse.parse(updated));
    } catch (error) {
      respondWithApiError(req, res, error);
    }
  },
);

router.get("/admin/ads", async (req, res): Promise<void> => {
  try {
    const parsed = ListAdminAdsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a valid review filter." });
      return;
    }

    const status = parsed.data.status;
    const records =
      !status || status === "all"
        ? await db.select().from(adsTable).orderBy(desc(adsTable.createdAt))
        : await db
            .select()
            .from(adsTable)
            .where(eq(adsTable.status, status))
            .orderBy(desc(adsTable.createdAt));

    const now = new Date();
    const subscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          inArray(subscriptionsTable.status, ["active", "canceled"]),
          gt(subscriptionsTable.expiresAt, now),
        ),
      )
      .orderBy(desc(subscriptionsTable.startedAt));
    const tierByUser = new Map<string, "weekly" | "monthly">();
    for (const subscription of subscriptions) {
      if (!tierByUser.has(subscription.userId)) {
        tierByUser.set(subscription.userId, subscription.planId);
      }
    }

    res.json(
      ListAdminAdsResponse.parse(
        records.map((ad) => ({
          ...ad,
          userTier: tierByUser.get(ad.userId) ?? "free",
        })),
      ),
    );
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.patch("/admin/ads/:id/review", async (req, res): Promise<void> => {
  try {
    const params = ReviewAdParams.safeParse(req.params);
    const body = ReviewAdBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose approve or reject." });
      return;
    }

    const [existing] = await db
      .select()
      .from(adsTable)
      .where(eq(adsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Advertisement not found." });
      return;
    }
    if (existing.status !== "pending") {
      res.status(409).json({ error: "This advertisement has already been reviewed." });
      return;
    }

    const reviewedAt = new Date();
    if (body.data.decision === "approve" && existing.imagePath) {
      await objectStorage.trySetObjectEntityAclPolicy(existing.imagePath, {
        owner: existing.userId,
        visibility: "public",
      });
    }

    const updatedAd = await db.transaction(async (tx) => {
      const [ad] = await tx
        .update(adsTable)
        .set({
          status: body.data.decision === "approve" ? "active" : "rejected",
          approvedAt:
            body.data.decision === "approve" ? reviewedAt : null,
          adminNote: body.data.note?.trim() || null,
        })
        .where(eq(adsTable.id, existing.id))
        .returning();

      if (body.data.decision === "approve") {
        await tx.insert(distributionEventsTable).values({
          id: randomUUID(),
          adId: ad.id,
          userId: ad.userId,
          eventType: "ad.approved",
          status: "ready",
          payload: {
            event: "ad.approved",
            adId: ad.id,
            title: ad.title,
            description: ad.description,
            link: ad.link,
            imagePath: ad.imagePath,
            userName: ad.userName,
            email: ad.email,
            approvedAt: reviewedAt.toISOString(),
            distributionStatus: "ready_for_social_channels",
          },
          createdAt: reviewedAt,
        });
      }
      return ad;
    });

    res.json(ReviewAdResponse.parse(updatedAd));
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

router.get("/admin/webhook-logs", async (req, res): Promise<void> => {
  try {
    const events = await db
      .select()
      .from(distributionEventsTable)
      .orderBy(desc(distributionEventsTable.createdAt))
      .limit(100);
    res.json(ListWebhookLogsResponse.parse(events));
  } catch (error) {
    respondWithApiError(req, res, error);
  }
});

export default router;
