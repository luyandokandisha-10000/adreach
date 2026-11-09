import { Readable } from "node:stream";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, imageUploadsTable } from "@workspace/db";
import {
  getAppUser,
  requireAuth,
  respondWithApiError,
} from "../lib/adReachAuth";
import { ObjectPermission } from "../lib/objectAcl";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const maxImageBytes = 8 * 1024 * 1024;

router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const user = await getAppUser(req);
      const parsed = RequestUploadUrlBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Provide a valid image file." });
        return;
      }
      const { name, size, contentType } = parsed.data;
      if (
        size > maxImageBytes ||
        !allowedImageTypes.has(contentType.toLowerCase())
      ) {
        res.status(400).json({
          error: "Images must be 8 MB or smaller and use JPG, PNG, WebP, GIF, or AVIF.",
        });
        return;
      }

      const uploadURL = await storage.getObjectEntityUploadURL();
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      await db.insert(imageUploadsTable).values({
        objectPath,
        userId: user.id,
        name: name.slice(0, 255),
        size,
        contentType: contentType.toLowerCase(),
      });

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      respondWithApiError(req, res, error);
    }
  },
);

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectFile = await storage.getObjectEntityFile(
      `/objects/${wildcardPath}`,
    );
    const authUserId = getAuth(req).userId ?? undefined;
    let allowed = await storage.canAccessObjectEntity({
      userId: authUserId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });

    if (!allowed && authUserId) {
      const user = await getAppUser(req);
      allowed = user.role === "admin";
    }
    if (!allowed) {
      res.status(403).json({ error: "You cannot access this image." });
      return;
    }

    const response = await storage.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      ).pipe(res);
      return;
    }
    res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found." });
      return;
    }
    if (error instanceof Error && "status" in error) {
      respondWithApiError(req, res, error);
      return;
    }
    req.log.error({ err: error }, "Could not serve uploaded image");
    res.status(500).json({ error: "Image could not be served." });
  }
});

export default router;
