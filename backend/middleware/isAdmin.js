const isAdmin = (req, res, next) => {
    // This middleware assumes authenticateToken has already run and populated req.user
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Forbidden: Requires admin privileges' });
    }
    // If user is admin, proceed to the next middleware or route handler
    next();
};

module.exports = isAdmin; 