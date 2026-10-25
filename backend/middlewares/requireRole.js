const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
        return res.status(403).json({
            message: "You do not have permission to access this resource.",
            success: false
        });
    }
    next();
};

export default requireRole;
