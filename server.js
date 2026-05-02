// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { getPool } from './db/connect.js';
import { buildAdminRouter } from './admin/index.js';
import { startDibbsCron } from './routes/dibss.js';

// Routes
import authRouter      from './routes/auth.js';
import searchRouter    from './routes/search.js';
import rfqRouter       from './routes/rfq.js';
import quoteRouter     from './routes/quotes.js';
import orderRouter     from './routes/orders.js';
import supplierRouter  from './routes/suppliers.js';
import sourcingRouter  from './routes/sourcing.js';
import invoiceRouter   from './routes/invoices.js';
import shipmentRouter  from './routes/shipments.js';
import documentRouter  from './routes/documents.js';
import customerRouter  from './routes/customers.js';
import dibssRouter     from './routes/dibss.js';
import settingsRouter  from './routes/settings.js';
import commsRouter     from './routes/communications.js';
import contactRouter   from './routes/contact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://jupiteroneusa.com', 'https://www.jupiteroneusa.com']
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth',      authRouter);
app.use('/api/search',    searchRouter);
app.use('/api/rfq',       rfqRouter);
app.use('/api/quotes',    quoteRouter);
app.use('/api/orders',    orderRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/sourcing',  sourcingRouter);
app.use('/api/invoices',  invoiceRouter);
app.use('/api/shipments', shipmentRouter);
app.use('/api/documents', documentRouter);
app.use('/api/customers', customerRouter);
app.use('/api/dibss',     dibssRouter);
app.use('/api/settings',  settingsRouter);
app.use('/api/communications', commsRouter);
app.use('/api/contact',   contactRouter);

app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

async function start() {
  try {
    await getPool();
    console.log('✅ Database connected');

    // Admin panel — registered BEFORE catch-all
    const { admin, adminRouter } = await buildAdminRouter();
    app.use(admin.options.rootPath, adminRouter);
    console.log('✅ Admin panel ready');

    // Catch-all → frontend
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public/index.html'));
    });

    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 Jupiter One USA');
      console.log(`   Site:   http://localhost:${PORT}`);
      console.log(`   API:    http://localhost:${PORT}/api`);
      console.log(`   Admin:  http://localhost:${PORT}/admin`);
      console.log('');
    });

    startDibbsCron();

  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

start();
