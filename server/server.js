require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');

const connectDB = require('./config/db');
const { ensureCategories } = require('./config/seed');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socket');
const { startPromotionScheduler } = require('./services/promotionService');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set a long random value.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const corsOrigin = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`).split(',').map((s) => s.trim());

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers. Scripts only from this server; fonts from Google Fonts.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Strip keys starting with "$" or containing "." (MongoDB operator injection)
app.use(mongoSanitize({ replaceWith: '_' }));

// Static files
const staticOpts = { maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0 };
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '30d' }));
app.use('/vendor/lucide.min.js', (req, res) => res.sendFile(require.resolve('lucide/dist/umd/lucide.min.js')));
app.use(express.static(path.join(__dirname, '../public'), { ...staticOpts, extensions: ['html'] }));

// REST API
app.get('/api/health', (req, res) => res.json({ success: true, message: 'SHG Connect API is running', time: new Date() }));
app.use('/api', apiRoutes);

// Friendly 404 page for unknown pages
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '../public/404.html')));
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await ensureCategories();
    initSocket(server, corsOrigin);
    startPromotionScheduler();
    server.listen(PORT, () => console.log(`SHG Connect running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, server };
