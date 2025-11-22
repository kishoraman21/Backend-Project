import { Router } from "express";
import { registerUser } from "../controllers/userController.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post(
  "/registerUser",
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);


export default router;
