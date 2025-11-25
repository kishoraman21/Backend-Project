import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getcurrentUser,
  changeCurrentPassword,
  getWatchHistory,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
} from "../controllers/userController.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

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

router.post("/login", loginUser);
router.post("/logout", verifyJwt, logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/changepassword", verifyJwt, changeCurrentPassword);
router.get("/me", verifyJwt, getcurrentUser);
router.patch("update-account", verifyJwt, updateAccountDetails);
router.patch(
  "update-avatar",
  verifyJwt,
  upload.single("avatar"),
  updateUserAvatar
);
router.patch(
  "update-coverImage",
  verifyJwt,
  upload.single("coverImage"),
  updateUserCoverImage
);
router.get("/:username", verifyJwt, getUserChannelProfile);
router.post("/watch-history", verifyJwt, getWatchHistory);

export default router;
