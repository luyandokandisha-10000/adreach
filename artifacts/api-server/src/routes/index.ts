import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import adRouter from "./ads";
import adminRouter from "./admin";
import storageRouter from "./storage";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(adRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(socialRouter);

export default router;
