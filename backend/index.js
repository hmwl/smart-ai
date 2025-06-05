require('dotenv').config({ path: require('path').resolve(__dirname, '.env') }); // Specify .env path within backend
const express = require('express');
const cors = require('cors');
const path = require('path'); // Keep path, might be needed for other things
const mongoose = require('mongoose');
const Application = require('./models/Application'); // Needed for /app route

// Import authentication middleware
const authenticateToken = require('./middleware/authenticateToken');
const isAdmin = require('./middleware/isAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Consider restricting CORS origin in production
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Serve uploaded files statically ---
// Make the /uploads directory accessible via HTTP
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MongoDB Connection ---
// Ensure we ONLY use MONGODB_URI
const mongoConnectionString = process.env.MONGODB_URI;

// Remove any potential leftover checks for the old MONGO_URI variable

if (!mongoConnectionString) {
  console.error('ERROR: MONGODB_URI was not found in .env file or process.env');
  process.exit(1);
}

mongoose.connect(mongoConnectionString) // Use the correct variable
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- API Routes ---
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const pageRoutes = require('./routes/pages');
const articleRoutes = require('./routes/articles');
const menuRoutes = require('./routes/menus'); // Import menu routes
const templateRoutes = require('./routes/templates'); // Import template routes
const publicRoutes = require('./routes/public'); // Import public routes
const apiEntryRoutes = require('./routes/apiEntries'); // Restore API entry routes require
const aiTypeRoutes = require('./routes/aiTypes'); // Import AI Type routes
const aiApplicationRoutes = require('./routes/aiApplications'); // Import AI Application routes
const creditTransactionRoutes = require('./routes/creditTransactions'); // Ensure this is present
const creditSettingsRoutes = require('./routes/creditSettings');
const promotionActivityRoutes = require('./routes/promotionActivities'); // Import Promotion Activity routes
const paymentConfigRoutes = require('./routes/paymentConfig'); // Added for payment config
// const transactionRoutes = require('./routes/transactions'); // This should be removed or commented out

// Import new routes for Works and Inspiration Categories
const worksRoutes = require('./routes/works');
const inspirationCategoriesRoutes = require('./routes/inspirationCategories');
const publicMarketRoutes = require('./routes/publicMarket'); // Added for public market

// Import the new tags router
const tagsRouter = require('./routes/tags');

// Import new Enum routes
const enumTypesRoutes = require('./routes/enumTypes');
const enumConfigsRoutes = require('./routes/enumConfigs');
const publicEnumApiRoutes = require('./routes/publicEnumApi'); // Import new public enum API

// Import new Platform routes
const platformRoutes = require('./routes/platforms');

// Import new Cookie Settings routes
const settingRoutes = require('./routes/settingRoutes');

// Import new form uploads route
const formUploadsRoutes = require('./routes/formUploads');

// Import AIWidget routes
const aiWidgetRoutes = require('./routes/aiWidget'); // 新增 AIWidget 路由

// Import authenticated client routes
const authClientRoutes = require('./routes/authClient'); // 新增认证客户端路由

// Import announcement routes
const announcementRoutes = require('./routes/announcements'); // 新增公告路由

// Mount admin/authenticated routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/menus', menuRoutes); // Restore menu routes
app.use('/api/templates', templateRoutes); // Restore template routes
app.use('/api/api-entries', apiEntryRoutes); // Corrected mount point for API entry routes
app.use('/api/ai-types', aiTypeRoutes); // Mount AI Type routes
app.use('/api/ai-applications', aiApplicationRoutes); // Mount AI Application routes
app.use('/api/credit-transactions', creditTransactionRoutes); // Ensure this is present
app.use('/api/credit-settings', creditSettingsRoutes);
app.use('/api/promotion-activities', promotionActivityRoutes);
// app.use('/api/transactions', transactionRoutes); // This should be removed or commented out

// Mount new routes WITH AUTHENTICATION for admin
app.use('/api/works', authenticateToken, isAdmin, worksRoutes);
app.use('/api/inspiration-categories', authenticateToken, isAdmin, inspirationCategoriesRoutes);
app.use('/api/enum-types', authenticateToken, isAdmin, enumTypesRoutes);
app.use('/api/enum-configs', authenticateToken, isAdmin, enumConfigsRoutes);

// Mount Platform routes (admin only)
app.use('/api/platforms', authenticateToken, isAdmin, platformRoutes);

// Mount Cookie Settings routes (admin only)
app.use('/api/settings', authenticateToken, isAdmin, settingRoutes);

// Mount new form uploads route (needs authentication)
app.use('/api/files/form-upload', authenticateToken, formUploadsRoutes);

// Mount AIWidget routes (admin only)
app.use('/api/ai-widgets', authenticateToken, isAdmin, aiWidgetRoutes);

// Mount authenticated client routes (需要身份验证但不需要管理员权限)
app.use('/api/auth/client', authenticateToken, authClientRoutes);

// Mount announcement routes (admin only)
app.use('/api/announcements', authenticateToken, isAdmin, announcementRoutes);

// Mount public routes
app.use('/api/public', publicRoutes); // Restore public routes
app.use('/api/public/platforms', platformRoutes); // Mount the new public platform API
app.use('/api/public/payment-config', paymentConfigRoutes); // Added for payment config
app.use('/api/public/market', publicMarketRoutes); // Added for public market

// Mount the new tags router
app.use('/api/tags', tagsRouter);

// 注册 comfyui 路由
app.use('/api/comfyui', require('./routes/comfyui'));

// 注册 notifications 路由
const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);

// --- Special Backend Routes (like /app) ---
// Handle /app?id=... specifically
app.get('/app', async (req, res, next) => {
  if (req.query.id) {
    const appId = req.query.id;
    try {
      if (!mongoose.Types.ObjectId.isValid(appId)) {
        return res.status(400).json({ message: 'Invalid Application ID format' });
      }
      const application = await Application.findOne({ _id: appId, status: 'active' });
      if (application) {
        return res.json(application.config || {});
      } else {
        return res.status(404).json({ message: 'Application not found or is inactive' });
      }
    } catch (error) {
      console.error(`Error handling /app?id=${appId}:`, error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } else {
    // If just /app, maybe return an error or specific message?
    res.status(400).json({ message: '/app route requires an id query parameter' });
    // Or let it fall through if /app itself might be a valid API endpoint later
    // next();
    }
});

// --- REMOVED ALL FRONTEND STATIC SERVING AND SPA FALLBACKS ---

// Optional: Add a simple root route for testing
app.get('/', (req, res) => {
    res.send('Backend API is running!');
});

// Optional: Catch-all for unhandled routes (404)
app.use((req, res, next) => {
    res.status(404).json({ message: 'Not Found' });
});

// Optional: Basic error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack || err);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});