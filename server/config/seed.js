// Demo data for the college field-project prototype. All names and data are fictional.
// Run with:  npm run seed   (this ERASES the existing SHG Connect database)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { DEFAULT_CATEGORIES } = require('./constants');
const Category = require('../models/Category');

// Called on every server start: makes sure the category list exists
async function ensureCategories() {
  if ((await Category.estimatedDocumentCount()) > 0) return;
  await Category.insertMany(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })));
  console.log('Default categories created');
}

const DEMO_PASSWORD = 'Demo@123';

const SELLERS = [
  {
    key: 'lakshmi', name: 'Lakshmi Devi', email: 'lakshmi@demo.shgconnect.in', phone: '9876500001', role: 'artisan', location: 'Bastar, Chhattisgarh',
    profile: { businessName: 'Lakshmi Bamboo Crafts', description: 'I make bamboo and jute products by hand, using skills learned from my mother. Every basket is woven with locally grown bamboo.', categories: ['handicrafts'], upiId: 'lakshmicrafts@upi', deliveryOptions: ['local', 'nationwide'], featured: true }
  },
  {
    key: 'sunita', name: 'Sunita Pawar', email: 'sunita@demo.shgconnect.in', phone: '9876500002', role: 'shg_leader', location: 'Satara, Maharashtra',
    profile: { businessName: 'Sakhi Mahila Bachat Gat', description: 'A self help group of 14 women making homemade pickles, millet ladoos and spice mixes. Our recipes use no preservatives.', categories: ['food-products'], upiId: 'sakhishg@okbank', deliveryOptions: ['local', 'state'], featured: true }
  },
  {
    key: 'meena', name: 'Meena Kumari', email: 'meena@demo.shgconnect.in', phone: '9876500003', role: 'shg_member', location: 'Chanderi, Madhya Pradesh',
    profile: { businessName: 'Ujala Weavers SHG', description: 'Our group weaves handloom cotton sarees and embroidered dupattas on traditional pit looms.', categories: ['handloom-textile', 'clothing-embroidery'], upiId: 'ujalaweavers@upi', deliveryOptions: ['nationwide'], featured: true }
  },
  {
    key: 'ramesh', name: 'Ramesh Prajapati', email: 'ramesh@demo.shgconnect.in', phone: '9876500004', role: 'artisan', location: 'Khurja, Uttar Pradesh',
    profile: { businessName: 'Prajapati Terracotta', description: 'Third-generation potter. Clay pots, water bottles and festive diyas made on the wheel and fired in our village kiln.', categories: ['pottery'], upiId: '', deliveryOptions: ['local', 'state'] }
  },
  {
    key: 'gopal', name: 'Gopal Nair', email: 'gopal@demo.shgconnect.in', phone: '9876500005', role: 'producer', location: 'Wayanad, Kerala',
    profile: { businessName: 'Green Valley Farm Producers', description: 'Small farmers producer group selling organic turmeric, forest honey and spices directly from our farms.', categories: ['agriculture-products', 'food-products'], upiId: 'greenvalley@okbank', deliveryOptions: ['nationwide'] }
  },
  {
    key: 'farida', name: 'Farida Sheikh', email: 'farida@demo.shgconnect.in', phone: '9876500006', role: 'artisan', location: 'Saharanpur, Uttar Pradesh',
    profile: { businessName: 'Saharanpur Wood & Bead Art', description: 'Hand-carved wooden crafts and handmade bead jewellery. Each piece is unique.', categories: ['wooden-products', 'jewelry-accessories'], upiId: 'faridaart@upi', deliveryOptions: ['state', 'nationwide'] }
  }
];

const CUSTOMERS = [
  { key: 'priya', name: 'Priya Sharma', email: 'priya@demo.shgconnect.in', phone: '9876500011', location: 'Pune, Maharashtra' },
  { key: 'rahul', name: 'Rahul Verma', email: 'rahul@demo.shgconnect.in', phone: '9876500012', location: 'New Delhi, Delhi' },
  { key: 'ananya', name: 'Ananya Iyer', email: 'ananya@demo.shgconnect.in', phone: '9876500013', location: 'Bengaluru, Karnataka' }
];

const img = (n) => [`/assets/demo/${n}.svg`];
const PRODUCTS = [
  { seller: 'lakshmi', name: 'Handmade Bamboo Basket', category: 'handicrafts', price: 450, quantity: 25, images: img('basket'), tags: ['bamboo', 'eco-friendly', 'storage'], deliveryOption: 'nationwide', deliveryCharge: 60, description: 'Strong round basket woven from split bamboo. Size: 30 cm wide, 25 cm tall. Good for fruits, vegetables or storage.' },
  { seller: 'lakshmi', name: 'Jute Shopping Bag', category: 'handicrafts', price: 220, quantity: 40, images: img('jutebag'), tags: ['jute', 'bag', 'eco-friendly'], deliveryOption: 'nationwide', deliveryCharge: 40, description: 'Reusable jute bag with cotton-lined handles. Holds up to 8 kg. Size: 40 x 35 cm.' },
  { seller: 'lakshmi', name: 'Artisan Decorative Wall Piece', category: 'handicrafts', price: 890, quantity: 8, images: img('wallpiece'), tags: ['wall decor', 'gift'], deliveryOption: 'nationwide', deliveryCharge: 80, discountPercent: 10, description: 'Hand-painted round wall hanging made with bamboo and natural colours. Diameter: 45 cm.' },
  { seller: 'sunita', name: 'Homemade Mango Pickle', category: 'food-products', price: 180, quantity: 60, images: img('pickle'), tags: ['pickle', 'achar', 'homemade'], deliveryOption: 'state', deliveryCharge: 40, description: 'Traditional raw mango pickle made in cold-pressed groundnut oil. 500 g glass jar. No preservatives.' },
  { seller: 'sunita', name: 'Millet Ladoo (Pack of 12)', category: 'food-products', price: 240, quantity: 30, images: img('ladoo'), tags: ['millet', 'sweets', 'healthy'], deliveryOption: 'local', deliveryCharge: 30, description: 'Ragi and jaggery ladoos with dry fruits. Made fresh every week by our SHG members. Best before 20 days.' },
  { seller: 'sunita', name: 'Wooden Masala Dabba with Spices', category: 'food-products', price: 650, quantity: 12, images: img('spicebox'), tags: ['spices', 'masala', 'gift'], deliveryOption: 'state', deliveryCharge: 50, description: 'Round sheesham wood spice box with 7 home-ground spices (turmeric, chilli, coriander, garam masala and more).' },
  { seller: 'meena', name: 'Handwoven Cotton Saree', category: 'handloom-textile', price: 2400, quantity: 6, images: img('saree'), tags: ['saree', 'handloom', 'cotton'], deliveryOption: 'nationwide', deliveryCharge: 0, description: 'Soft Chanderi cotton saree with zari border. Length 5.5 m with blouse piece. Hand wash recommended.' },
  { seller: 'meena', name: 'Embroidered Dupatta', category: 'clothing-embroidery', price: 750, quantity: 15, images: img('dupatta'), tags: ['dupatta', 'embroidery'], deliveryOption: 'nationwide', deliveryCharge: 40, description: 'Cotton-silk dupatta with hand embroidery along the border. Length 2.25 m.' },
  { seller: 'meena', name: 'Block Print Cotton Kurta', category: 'clothing-embroidery', price: 980, quantity: 10, images: img('kurta'), tags: ['kurta', 'block print', 'cotton'], deliveryOption: 'nationwide', deliveryCharge: 40, discountPercent: 15, description: 'Hand block-printed kurta in natural indigo. Sizes M, L, XL (mention size in order note).' },
  { seller: 'ramesh', name: 'Handmade Pottery Set', category: 'pottery', price: 560, quantity: 14, images: img('pottery'), tags: ['clay', 'terracotta', 'kitchen'], deliveryOption: 'state', deliveryCharge: 70, description: 'Set of 2 terracotta pots for cooking or storing curd. Big pot 2 L, small pot 1 L. Season before first use.' },
  { seller: 'ramesh', name: 'Clay Water Bottle', category: 'pottery', price: 320, quantity: 20, images: img('bottle'), tags: ['clay', 'bottle', 'natural cooling'], deliveryOption: 'local', deliveryCharge: 40, description: 'Keeps water naturally cool. Capacity 1 litre, with clay stopper.' },
  { seller: 'gopal', name: 'Organic Turmeric Powder', category: 'agriculture-products', price: 199, quantity: 80, images: img('turmeric'), tags: ['turmeric', 'haldi', 'organic'], deliveryOption: 'nationwide', deliveryCharge: 40, description: 'High-curcumin turmeric grown without chemicals and stone-ground. 250 g pouch.' },
  { seller: 'gopal', name: 'Wild Forest Honey', category: 'agriculture-products', price: 420, quantity: 0, images: img('honey'), tags: ['honey', 'natural'], deliveryOption: 'nationwide', deliveryCharge: 50, description: 'Raw honey collected by tribal collectors in Wayanad forests. 500 g glass jar. (Currently out of stock.)' },
  { seller: 'farida', name: 'Traditional Wooden Elephant', category: 'wooden-products', price: 1250, quantity: 7, images: img('elephant'), tags: ['wood carving', 'decor', 'gift'], deliveryOption: 'nationwide', deliveryCharge: 80, description: 'Hand-carved sheesham wood elephant. Height 20 cm. Polished with natural wax.' },
  { seller: 'farida', name: 'Handmade Terracotta Necklace', category: 'jewelry-accessories', price: 380, quantity: 18, images: img('necklace'), tags: ['necklace', 'jewellery', 'terracotta'], deliveryOption: 'nationwide', deliveryCharge: 30, description: 'Light-weight beaded necklace with hand-painted terracotta pendant. Adjustable thread.' },
  { seller: 'farida', name: 'Beaded Bangles Set', category: 'jewelry-accessories', price: 290, quantity: 25, images: img('bangles'), tags: ['bangles', 'beads'], deliveryOption: 'nationwide', deliveryCharge: 30, description: 'Set of 4 hand-beaded bangles. Size 2.4 / 2.6 (mention in order note).' },
  // Waiting for admin approval (for the admin demo)
  { seller: 'ramesh', name: 'Hand-painted Diya Set (12 pcs)', category: 'pottery', price: 260, quantity: 50, images: img('diya'), tags: ['diya', 'festival', 'diwali'], deliveryOption: 'state', deliveryCharge: 40, status: 'pending', description: 'Twelve hand-painted clay diyas for festivals.' },
  // Draft (for the seller demo)
  { seller: 'lakshmi', name: 'Bamboo Pen Stand', category: 'handicrafts', price: 150, quantity: 20, images: [], tags: ['bamboo'], deliveryOption: 'local', deliveryCharge: 20, status: 'draft', description: 'Small bamboo pen stand. (Draft – add a photo and publish.)' }
];

const ADDRESSES = {
  priya: { fullName: 'Priya Sharma', phone: '9876500011', addressLine: 'Flat 12, Shanti Apartments, Kothrud', city: 'Pune', state: 'Maharashtra', pincode: '411038' },
  rahul: { fullName: 'Rahul Verma', phone: '9876500012', addressLine: 'House 44, Sector 9, Dwarka', city: 'New Delhi', state: 'Delhi', pincode: '110077' },
  ananya: { fullName: 'Ananya Iyer', phone: '9876500013', addressLine: '7, 3rd Cross, Jayanagar 4th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560011' }
};

const REVIEW_TEXT = [
  [5, 'Beautiful work and very good quality. Packed nicely. Thank you!'],
  [4, 'Good product, delivery took a little time but worth it.'],
  [5, 'Exactly as shown in the photo. Will order again.'],
  [3, 'Product is nice but size was smaller than I expected.'],
  [5, 'Lovely! Gifted it to my mother and she loved it.']
];

async function seed() {
  const connectDB = require('./db');
  const User = require('../models/User');
  const SellerProfile = require('../models/SellerProfile');
  const Product = require('../models/Product');
  const Order = require('../models/Order');
  const Review = require('../models/Review');
  const Promotion = require('../models/Promotion');
  const Notification = require('../models/Notification');
  const Counter = require('../models/Counter');
  const { refreshRatings } = require('../controllers/reviewController');

  await connectDB();
  console.log('Clearing old data…');
  await mongoose.connection.dropDatabase();
  await Promise.all([User, SellerProfile, Product, Order, Review, Promotion, Notification, Category].map((m) => m.syncIndexes()));
  await ensureCategories();

  // Users (passwords hashed by the User model pre-save hook)
  const admin = await User.create({ name: 'Platform Admin', email: 'admin@demo.shgconnect.in', phone: '9876500000', password: DEMO_PASSWORD, role: 'admin', location: 'Mumbai, Maharashtra' });
  const users = {};
  for (const s of SELLERS) {
    users[s.key] = await User.create({ name: s.name, email: s.email, phone: s.phone, password: DEMO_PASSWORD, role: s.role, location: s.location });
    await SellerProfile.create({ userId: users[s.key]._id, sellerType: s.role, location: s.location, whatsappEnabled: true, ...s.profile });
  }
  for (const c of CUSTOMERS) {
    users[c.key] = await User.create({ name: c.name, email: c.email, phone: c.phone, password: DEMO_PASSWORD, role: 'customer', location: c.location });
  }

  // Products, created at staggered times so "Newest" sorting is meaningful
  const products = [];
  for (const [i, p] of PRODUCTS.entries()) {
    const seller = SELLERS.find((s) => s.key === p.seller);
    const createdAt = new Date(Date.now() - (PRODUCTS.length - i) * 36 * 3600 * 1000);
    products.push(await Product.create({
      ...p,
      sellerId: users[p.seller]._id,
      location: seller.location,
      status: p.status || 'approved',
      views: p.status ? 0 : 40 + ((i * 37) % 160),
      createdAt,
      updatedAt: createdAt
    }));
  }
  const live = products.filter((p) => p.status === 'approved' && p.quantity > 0);

  // Orders spread over the last 30 days in different stages
  const flow = ['new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
  const customerKeys = CUSTOMERS.map((c) => c.key);
  const plan = [
    ...Array(14).fill('delivered'),
    'new', 'new', 'new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'cancelled', 'cancelled'
  ];
  const orders = [];
  for (const [i, status] of plan.entries()) {
    const product = live[(i * 5) % live.length];
    const extra = i % 4 === 0 ? live.find((p) => String(p.sellerId) === String(product.sellerId) && p !== product) : null;
    const lines = [product, extra].filter(Boolean).map((p, k) => {
      const quantity = 1 + ((i + k) % 3 === 0 ? 1 : 0);
      const price = p.discountPercent ? Math.round(p.price * (1 - p.discountPercent / 100)) : p.price;
      return { productId: p._id, name: p.name, image: p.images[0] || '', price, quantity, subtotal: price * quantity };
    });
    const itemsTotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const deliveryCharge = Math.max(...[product, extra].filter(Boolean).map((p) => p.deliveryCharge));
    const daysAgo = status === 'delivered' ? 3 + ((i * 2) % 27) : i % 4;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - (i % 5) * 3600 * 1000);
    const customer = customerKeys[i % customerKeys.length];
    const sellerKey = SELLERS.find((s) => String(users[s.key]._id) === String(product.sellerId)).key;
    const sellerHasUpi = Boolean(SELLERS.find((s) => s.key === sellerKey).profile.upiId);
    const paymentMethod = sellerHasUpi && i % 2 === 0 ? 'upi' : 'cod';

    const steps = status === 'cancelled' ? ['new', 'cancelled'] : flow.slice(0, flow.indexOf(status) + 1);
    const history = steps.map((s, k) => ({
      status: s,
      at: new Date(createdAt.getTime() + k * 14 * 3600 * 1000),
      by: s === 'new' ? 'customer' : s === 'cancelled' && i % 2 ? 'customer' : 'seller',
      note: s === 'new' ? 'Order placed' : s === 'cancelled' ? 'Customer changed mind' : ''
    }));

    const paid = status === 'delivered' || (paymentMethod === 'upi' && flow.indexOf(status) >= 2);
    const seq = await Counter.next('order');
    const order = await Order.create({
      orderNumber: `SC${seq}`,
      customerId: users[customer]._id,
      sellerId: product.sellerId,
      items: lines,
      itemsTotal,
      deliveryCharge,
      totalAmount: itemsTotal + deliveryCharge,
      paymentMethod,
      paymentStatus: status === 'cancelled' ? 'pending' : paid ? 'paid' : 'pending',
      paymentReference: paymentMethod === 'upi' && paid ? `UTR${400000000 + i * 7919}` : '',
      paidAt: paid ? history[history.length - 1].at : undefined,
      orderStatus: status,
      deliveryStatus: Order.deliveryStatusFor(status),
      deliveryInfo: flow.indexOf(status) >= 4 ? { partner: i % 2 ? 'India Post' : 'Self delivery', trackingId: i % 2 ? `EE${100200300 + i}IN` : '' } : {},
      statusHistory: history,
      shippingAddress: ADDRESSES[customer],
      cancelReason: status === 'cancelled' ? 'Customer changed mind' : '',
      createdAt,
      updatedAt: history[history.length - 1].at
    });
    orders.push(order);
    if (status !== 'cancelled') {
      for (const l of lines) await Product.updateOne({ _id: l.productId }, { $inc: { soldCount: l.quantity } });
    }
  }

  // Reviews for most delivered orders
  let r = 0;
  for (const order of orders.filter((o) => o.orderStatus === 'delivered')) {
    const item = order.items[0];
    if (r % 6 === 5 || (await Review.exists({ productId: item.productId, customerId: order.customerId }))) { r++; continue; }
    const [rating, comment] = REVIEW_TEXT[r % REVIEW_TEXT.length];
    await Review.create({ productId: item.productId, customerId: order.customerId, sellerId: order.sellerId, orderId: order._id, rating, comment, createdAt: new Date(order.updatedAt.getTime() + 86400000) });
    r++;
  }
  for (const p of products) await refreshRatings(p._id, p.sellerId);

  // Promotions (internal featured / promoted system)
  const DAY = 86400000;
  const promo = async (name, type, days, extra = {}) => {
    const p = products.find((x) => x.name === name);
    await Promotion.create({ productId: p._id, sellerId: p.sellerId, type, startDate: new Date(Date.now() - 2 * DAY), endDate: new Date(Date.now() + days * DAY), views: 120 + days * 3, clicks: 18 + days, orders: 3, ...extra });
    await Product.updateOne({ _id: p._id }, type === 'featured' ? { featured: true } : type === 'promoted' ? { promoted: true } : {});
  };
  await promo('Handmade Bamboo Basket', 'promoted', 12);
  await promo('Handwoven Cotton Saree', 'featured', 10);
  await promo('Homemade Mango Pickle', 'promoted', 5);
  await promo('Traditional Wooden Elephant', 'featured', 20);
  await promo('Organic Turmeric Powder', 'promoted', 8);
  await promo('Embroidered Dupatta', 'promoted', 6);
  await Product.updateMany({ name: { $in: ['Handmade Pottery Set', 'Homemade Mango Pickle'] } }, { adminFeatured: true, featured: true });

  // A few unread notifications so the bell is not empty in the demo
  const newOrders = orders.filter((o) => o.orderStatus === 'new');
  for (const o of newOrders) {
    await Notification.create({ userId: o.sellerId, type: 'new_order', title: 'New order received', message: `Order ${o.orderNumber} for ₹${o.totalAmount}. Please confirm it.`, link: `/order-details.html?id=${o._id}`, data: { orderNumber: o.orderNumber, amount: o.totalAmount } });
  }
  const shipped = orders.find((o) => o.orderStatus === 'out_for_delivery');
  if (shipped) {
    await Notification.create({ userId: shipped.customerId, type: 'out_for_delivery', title: 'Order out for delivery', message: `Your order ${shipped.orderNumber} is now: Out for delivery.`, link: `/order-details.html?id=${shipped._id}`, data: { orderNumber: shipped.orderNumber, status: 'out_for_delivery' } });
  }
  await Notification.create({ userId: admin._id, type: 'system', title: 'Product waiting for approval', message: '"Hand-painted Diya Set (12 pcs)" needs review.', link: '/admin-dashboard.html#products' });

  console.log(`\nSeed complete: ${SELLERS.length} sellers, ${CUSTOMERS.length} customers, ${products.length} products, ${orders.length} orders.`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log('  Admin    : admin@demo.shgconnect.in');
  console.log('  Seller   : lakshmi@demo.shgconnect.in (artisan), sunita@demo.shgconnect.in (SHG leader)');
  console.log('  Customer : priya@demo.shgconnect.in\n');
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(async (err) => {
    console.error('Seed failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { ensureCategories };
