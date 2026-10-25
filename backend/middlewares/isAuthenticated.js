import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({
                message: "User not authenticated",
                success: false,
            })
        }
        const decode = jwt.verify(token, process.env.SECRET_KEY);
        if(!decode){
            return res.status(401).json({
                message:"Invalid token",
                success:false
            })
        };
        const user = await User.findById(decode.userId).select("_id role isBlocked");
        if (!user) {
            return res.status(401).json({
                message: "User account no longer exists.",
                success: false
            });
        }
        if (user.isBlocked) {
            return res.status(403).json({
                message: "This account has been blocked. Contact support for assistance.",
                success: false
            });
        }
        req.id = decode.userId;
        req.role = user.role;
        next();
    } catch (error) {
        console.log(error);
        const isInvalidToken = ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name);
        return res.status(isInvalidToken ? 401 : 500).json({
            message: isInvalidToken ? "Invalid or expired session. Please log in again." : "Unable to verify your session right now.",
            success: false
        });
    }
}
export default isAuthenticated;