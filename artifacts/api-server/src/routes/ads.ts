import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { CreateAdBody, CreateAdResponse } from "@workspace/api-zod";
import {
  adsTable,
  db,
  distributionEventsTable,
  imageUploadsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import {
  getAppUser,
  requireAuth,
  respondWithApiError,
} from "../lib/adReachAuth";
import {
  ObjectPermission,
} from "../lib/objectAcl";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const FREE_ADS_LIMIT = 5;
const objectStorage = new ObjectStorageService();

class SubscriptionRequiredError extends Error {}
class InvalidImageError extends Error {}

router.post("/ads", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = CreateAdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Check the ad details and try again." });
      return;
    }
    let destination: URL;
    try {
      destination = new URL(parsed.data.link);
    } catch {
      res.status(400).json({ error: "Enter a valid website or social profile link." });
      return;
    }
    if (!["http:", "https:"].includes(destination.protocol)) {
      res.status(400).json({ error: "Ad links must start with http:// or https://." });
      return;
    }

    const user = await getAppUser(req);
    const imagePath = parsed.data.imagePath ?? null;
    let uploadPath: string | null = null;

    if (imagePath) {
      const [upload] = await db
        .select()
        .from(imageUploadsTable)
        .where(
          and(
            eq(imageUploadsTable.objectPath, imagePath),
            eq(imageUploadsTable.userId, user.id),
            eq(imageUploadsTable.used, false),
          ),
        );
      if (!upload || !imagePath.startsWith("/objects/uploads/")) {
        res.status(400).json({ error: "That image upload is not available." });
        return;
      }
      const file = await objectStorage.getObjectEntityFile(imagePath);
      const [metadata] = await file.getMetadata();
      const actualSize = Number(metadata.size ?? 0);
      const actualType = String(metadata.contentType ?? "");
      if (
        actualSize < 1 ||
        actualSize > 8 * 1024 * 1024 ||
        actualSize !== upload.size ||
        !actualType.startsWith("image/") ||
        actualType !== upload.contentType
      ) {
        throw new InvalidImageError();
      }
      await objectStorage.trySetObjectEntityAclPolicy(imagePath, {
        owner: user.id,
        visibility: "private",
      });
      uploadPath = imagePath;
    }

    const submittedAt = new Date();
    const ad = await db.transaction(async (tx) => {
      await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .for("update");

      let planId: "free" | "weekly" | "monthly";
      const [freeAds] = await tx
        .select({ total: count() })
        .from(adsTable)
        .where(
          and(eq(adsTable.userId, user.id), eq(adsTable.planId, "free")),
        );

      if ((freeAds?.total ?? 0) < FREE_ADS_LIMIT) {
        planId = "free";
      } else {
        const [subscription] = await tx
          .select()
          .from(subscriptionsTable)
          .where(
            and(
              eq(subscriptionsTable.userId, user.id),
              inArray(subscriptionsTable.status, ["active", "canceled"]),
              gt(subscriptionsTable.expiresAt, submittedAt),
            ),
          )
          .orderBy(desc(subscriptionsTable.startedAt))
          .limit(1);
        if (!subscription) {
          throw new SubscriptionRequiredError();
        }
        planId = subscription.planId;
      }

      if (uploadPath) {
        const [claimedUpload] = await tx
          .update(imageUploadsTable)
          .set({ used: true })
          .where(
            and(
              eq(imageUploadsTable.objectPath, uploadPath),
              eq(imageUploadsTable.userId, user.id),
              eq(imageUploadsTable.used, false),
            ),
          )
          .returning();
        if (!claimedUpload) {
          throw new InvalidImageError();
        }
      }

      const id = randomUUID();
      const [createdAd] = await tx
        .insert(adsTable)
        .values({
          id,
          userId: user.id,
          userName: parsed.data.userName,
          email: user.email,
          title: parsed.data.title,
          description: parsed.data.description,
          link: parsed.data.link,
          imagePath: uploadPath,
          status: "pending",
          planId,
          createdAt: submittedAt,
        })
        .returning();

      await tx.insert(distributionEventsTable).values({
        id: randomUUID(),
        adId: createdAd.id,
        userId: user.id,
        eventType: "ad.submitted",
        status: "queued",
        payload: {
          event: "ad.submitted",
          adId: createdAd.id,
          title: createdAd.title,
          description: createdAd.description,
          link: createdAd.link,
          imagePath: createdAd.imagePath,
          userName: createdAd.userName,
          email: createdAd.email,
          submittedAt: submittedAt.toISOString(),
        },
        createdAt: submittedAt,
      });

      return createdAd;
    });

    res.status(201).json(CreateAdResponse.parse(ad));
  } catch (error) {
    if (error instanceof SubscriptionRequiredError) {
      res.status(402).json({
        error: "Your five free ads are used. Choose a paid plan to submit more.",
      });
      return;
    }
    if (error instanceof InvalidImageError) {
      res.status(400).json({
        error: "Upload an image under 8 MB in a supported image format.",
      });
      return;
    }
    respondWithApiError(req, res, error);
  }
});

export default router;
