import { Router } from "express";
import { registerUser } from "../controllers/userController";

const router = Router();

router.post("/user");

export default router;
