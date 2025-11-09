import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors"
const app = express();

//importing routes
// import { userrouter } from "./routes/userRoutes";
import userRouter from "./routes/userRoutes.js"

//middlewares
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))
app.use(express.urlencoded({extended:true, limit:"20kb"}))
app.use(express.json({limit:"20kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes

app.use("/users", userRouter)
export {app} 