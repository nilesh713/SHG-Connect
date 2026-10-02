# SHG Connect – Artisan & Self Help Group Marketplace

A responsive full-stack marketplace prototype, built for a college field project. It helps Self Help Groups (SHGs), artisans, craftspersons and small-scale producers show their products, reach more customers, manage orders, update delivery status, track sales and receive digital payments.

> **Prototype notice.** This project was designed around the problems found in our field survey. It does not claim to solve every problem artisans face.
> - UPI uses a **demo flow**: a UPI link and QR code that pay the seller's own UPI ID, plus a transaction reference the seller verifies. There is no payment gateway.
> - Delivery tracking shows **status updates entered by the seller**. There is no GPS tracking.
> - Promotion is an **internal featured/promoted system**. There is no paid advertising.

---

## 1. Survey finding → feature

| Survey finding | What the platform does |
|---|---|
| Finding new customers, low visibility | Public marketplace with search (product, seller, category), filters (price, location, stock), sorting, and category pages |
| Lack of product promotion | Free **Promote / Feature / Discount** promotions, a "Promoted Products" strip, "Featured Products" and "Featured Artisans" sections, and stats on views, clicks and orders |
| Lack of online knowledge | A 3-step Add Product form with hints, big buttons, a "next step" button on every order, a setup checklist, empty states with guidance, and Hindi |
| Lack of time | Save Draft, one-tap status updates, photo compression done by the server |
| Delivery / transport problems | Order timeline, delivery partner and tracking number fields, a Delivery page, WhatsApp "message customer" |
| Payment problems | Cash on Delivery (marked paid automatically on delivery) and UPI to the seller's own UPI ID, with payment statuses Pending / Paid / Failed / Refunded |
| Wanted: reviews, sales history, notifications, WhatsApp, local language | Verified-buyer reviews, sales charts with date filters, real-time notifications (Socket.io), WhatsApp contact/share links, English/Hindi toggle |

---

## 2. Tech stack

- **Frontend:** HTML5, CSS3 (Grid/Flexbox, mobile-first), vanilla JavaScript. No framework. Lucide icons (served locally) and Google Fonts (Noto Sans and Noto Sans Devanagari).
- **Backend:** Node.js, Express (REST API), Socket.io
- **Database:** MongoDB with Mongoose
- **Auth & security:** JWT, bcrypt password hashing (`bcryptjs`), role-based access, express-validator, express-mongo-sanitize, Helmet (with a Content Security Policy), CORS, rate limiting on login and register
- **Uploads:** Multer, compressed to WebP with `sharp`. Stored in `/uploads`, or on Cloudinary if configured.
- **Other:** dotenv, morgan, compression, qrcode (UPI QR)

---

## 3. Run it locally

### Requirements
- **Node.js 18 or newer**: https://nodejs.org (choose the LTS version)
- **MongoDB**, either
  - MongoDB Community Server installed locally (https://www.mongodb.com/try/download/community), or
  - a free MongoDB Atlas cluster. Paste its connection string into `MONGODB_URI`.

### Steps
```bash
cd shg-connect
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```
Edit `.env`: set `MONGODB_URI` and a long random `JWT_SECRET`. You can generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Load the demo data (**this erases the SHG Connect database**), then start:
```bash
npm run seed
npm start                   # or: npm run dev  (auto-restart with nodemon)
```
Open **http://localhost:5000**

> ⚠️ **Always open the site through the Node server (http://localhost:5000).** Opening the HTML files directly, or with VS Code "Live Server" (port 5500), will **not** work. The CSS/JS paths and all data (`/api/...`) are served by Express. If you do this by mistake, a red warning appears at the top of the page.

---

## 4. Demo accounts

All demo accounts use the password **`Demo@123`**. The login page has buttons that fill these in.

| Role | Email | Mobile |
|---|---|---|
| Admin | admin@demo.shgconnect.in | 9876500000 |
| Artisan (Lakshmi Bamboo Crafts) | lakshmi@demo.shgconnect.in | 9876500001 |
| SHG Leader (Sakhi Mahila Bachat Gat) | sunita@demo.shgconnect.in | 9876500002 |
| SHG Member (Ujala Weavers SHG) | meena@demo.shgconnect.in | 9876500003 |
| Artisan, no UPI ID yet (Prajapati Terracotta) | ramesh@demo.shgconnect.in | 9876500004 |
| Small-scale Producer (Green Valley Farm) | gopal@demo.shgconnect.in | 9876500005 |
| Artisan (Saharanpur Wood & Bead Art) | farida@demo.shgconnect.in | 9876500006 |
| Customer | priya@demo.shgconnect.in | 9876500011 |
| Customer | rahul@demo.shgconnect.in / ananya@demo.shgconnect.in | 9876500012 / 13 |

You can log in with **either email or mobile number**. All names and data are fictional. The demo images are original SVG illustrations in `public/assets/demo`.

The seed creates 6 sellers, 3 customers, 18 products (one waiting for admin approval, one draft), 24 orders across the last 30 days in every status, reviews, active promotions and notifications.

> Before any real deployment, remove the demo-account buttons from `login.html` and change every password.

---

## 5. Suggested demo walkthrough

1. **Customer** (priya): explore → search "bamboo" → open a product → Add to Cart / Buy Now → checkout with **UPI** → scan the QR or "Open UPI app" → enter a UTR such as `412345678901` → track the order.
2. **Seller** (lakshmi): the bell shows the new order in real time → Orders → **Confirm order** → Delivery → move through Processing → Ready to ship → Shipped (enter "India Post" and a tracking number) → Out for delivery → Delivered. On Payments, verify the UPI reference and **Mark as paid**.
3. **Customer:** the timeline updates and notifications arrive → after delivery, write a review on the product page.
4. **Seller:** Add Product (3 steps with photo upload) → Promotions → Promote / Feature / Discount → Sales History (Today / Week / Month / Custom range).
5. **Admin:** approve the pending "Diya Set", feature products and artisans, suspend or activate users, hide abusive reviews, add a category, view reports.
6. Switch **EN / हिं** in the header, and resize the browser to see the mobile layout.

---

## 6. Folder structure

```
shg-connect/
├── public/                     # Frontend (served by Express)
│   ├── index.html              # Landing page (hero, why, featured, how it works, about the project)
│   ├── products.html           # Marketplace: search, filters, promoted products, featured artisans
│   ├── product-details.html    # Gallery, seller box, cart, WhatsApp, reviews
│   ├── seller.html             # Public seller profile
│   ├── cart.html  checkout.html  my-orders.html  order-details.html (tracking + UPI)
│   ├── login.html  register.html  profile.html  settings.html  notifications.html
│   ├── seller-dashboard.html  seller-products.html  add-product.html  orders.html
│   ├── delivery.html  sales-history.html  reviews.html  promotions.html  payments.html
│   ├── admin-dashboard.html    # Sections: #overview #users #products #orders #reviews #categories #reports
│   ├── contact.html  privacy.html  terms.html  404.html
│   ├── css/  style.css (base + components) · dashboard.css · responsive.css (breakpoints)
│   ├── js/
│   │   ├── translations.js     # English/Hindi dictionary + t() + data-i18n
│   │   ├── components.js       # Toast, Modal, Confirm, Spinner, Empty state, Pagination, Form validator, Stars, Badges
│   │   ├── api.js              # fetch wrapper for the REST API (JWT header, errors)
│   │   ├── auth.js             # Session, role guards, login/register pages
│   │   ├── app.js              # Navbar + Footer components, page bootstrap
│   │   ├── dashboard.js        # Sidebar (mobile drawer) + top bar
│   │   ├── products.js         # ProductCard, SellerCard, categories cache
│   │   ├── orders.js           # Status flow, delivery timeline, "next step" action
│   │   ├── notifications.js    # Notification dropdown + Socket.io
│   │   ├── cart.js  charts.js  # Cart store, dependency-free SVG charts
│   │   └── pages/*.js          # One script per page
│   └── assets/                 # favicon, placeholder, demo illustrations
├── server/
│   ├── server.js               # Express app, security middleware, static files, Socket.io
│   ├── config/  db.js · constants.js · seed.js
│   ├── models/  User · SellerProfile · Product · Order · Review · Promotion · Notification · Category · Counter
│   ├── controllers/  auth · user · product · order · review · promotion · notification · seller · category · admin
│   ├── routes/index.js         # Every REST route in one readable file
│   ├── middleware/  auth (JWT + roles) · validators · validate · upload · errorHandler
│   ├── services/  storage (local/Cloudinary + sharp) · socket · notificationService · promotionService
│   └── utils/helpers.js
├── uploads/                    # Uploaded images (git-ignored)
├── .env.example
└── package.json
```

---

## 7. Database schemas (Mongoose)

| Model | Main fields |
|---|---|
| **User** | name, email (unique), phone (unique), password (bcrypt, never returned), role (`customer, artisan, shg_member, shg_leader, producer, admin`), location, profileImage, language, isActive, timestamps |
| **SellerProfile** | userId, sellerType, businessName, description, location, categories[], upiId, deliveryOptions[], whatsappEnabled, featured, rating, ratingCount |
| **Product** | sellerId, name, category, description, price, discountPercent, quantity, images[], location, deliveryOption, deliveryCharge, tags[], status (`draft, pending, approved, rejected`), promoted, featured, adminFeatured, sellerActive, views, soldCount, rating, ratingCount, timestamps. Virtual: finalPrice |
| **Order** | orderNumber (SC1001…), customerId, sellerId, items[{productId, name, image, price, quantity, subtotal}], itemsTotal, deliveryCharge, totalAmount, paymentMethod (`cod, upi`), paymentStatus (`pending, paid, failed, refunded`), paymentReference, orderStatus (`new … delivered, cancelled`), deliveryStatus, deliveryInfo{partner, trackingId, expectedDate}, statusHistory[], shippingAddress, timestamps |
| **Review** | productId, customerId, sellerId, orderId, rating 1–5, comment, status (`approved, flagged, hidden`). Unique per customer and product |
| **Promotion** | productId, sellerId, type (`promoted, featured, discount`), discountPercent, startDate, endDate, active, views, clicks, orders |
| **Notification** | userId, type, title, message, link, data, read, timestamps |
| **Category** | slug, name, nameHi, icon, active, sortOrder |

Indexes cover marketplace queries (status, category, price, promoted/featured), seller and customer order lists, and text fields.

---

## 8. REST API

All responses are JSON: `{ success, message?, data?, pagination?, errors? }`. Validation errors return **422** with field-level `errors`. Other statuses used: 401 (not logged in), 403 (wrong role), 404, 409 (duplicate or conflict).

**Auth**
- `POST /api/auth/register` · `POST /api/auth/login` (email or mobile) · `GET /api/auth/me` · `PUT /api/auth/change-password`

**Users**
- `GET /api/users/profile` · `PUT /api/users/profile` (multipart; sellers can also update business fields, UPI ID and delivery options)

**Categories**
- `GET /api/categories`

**Products**
- `GET /api/products` with `?q, seller, category, minPrice, maxPrice, location, inStock, promoted, featured, sort=newest|price_asc|price_desc|popular|rating, page, limit`
- `GET /api/products/locations` · `GET /api/products/mine` (seller)
- `GET /api/products/:id` (`?ref=promo` counts a promotion click) · `GET /api/products/:id/reviews`
- `POST /api/products` · `PUT /api/products/:id` · `DELETE /api/products/:id` (multipart `images[]`, `action=draft|publish`)

**Sellers**
- `GET /api/sellers?featured=true` · `GET /api/sellers/:id`
- `GET /api/sellers/me/dashboard` · `GET /api/sellers/me/sales?range=today|week|month|all|custom&from&to`

**Orders**
- `POST /api/orders` (one order per seller) · `GET /api/orders` (`?status, paymentStatus, q, view=delivery, as=customer`) · `GET /api/orders/:id`
- `PUT /api/orders/:id/status` · `PUT /api/orders/:id/payment` · `POST /api/orders/:id/payment-reference` · `GET /api/orders/:id/upi`

**Reviews**
- `POST /api/reviews` (only after delivery) · `GET /api/reviews/seller` · `GET /api/reviews/can-review/:productId` · `PUT /api/reviews/:id/report`

**Promotions**
- `POST /api/promotions` · `GET /api/promotions` · `PUT /api/promotions/:id` (`action=stop|extend`)

**Notifications**
- `GET /api/notifications` · `PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all`

**Admin**
- `GET /api/admin/stats` · `GET /api/admin/reports`
- `GET /api/admin/users` · `PUT /api/admin/users/:id/status` · `PUT /api/admin/sellers/:id/featured`
- `GET /api/admin/products` · `PUT /api/admin/products/:id/status` · `PUT /api/admin/products/:id/featured`
- `GET /api/admin/orders` · `GET /api/admin/reviews` · `PUT /api/admin/reviews/:id/status`
- `POST /api/admin/categories` · `PUT /api/admin/categories/:id` · `DELETE /api/admin/categories/:id`

Real-time: the Socket.io client connects with `auth: { token }`. The server pushes `notification` events to the user's private room.

---

## 9. Order flow rules

`New → Confirmed → Processing → Ready to ship → Shipped → Out for delivery → Delivered` (or **Cancelled**)

- Status only moves forward. Sellers can cancel before an order is shipped. Customers can cancel while it is New or Confirmed.
- Stock is reserved atomically when the order is placed and returned if the order is cancelled.
- Cash on Delivery becomes **Paid** automatically on delivery. UPI becomes **Paid** after the seller checks the UTR the customer submitted.
- Customers see a simpler timeline, where "Ready to ship" is merged into "Processing".

---

## 10. Security notes

- Passwords are hashed with bcrypt (12 rounds) and never returned by the API.
- JWT is sent in the `Authorization: Bearer` header. Every protected route checks the token, the account status (suspended accounts are blocked), and the role.
- Input is validated on both the frontend and the backend. MongoDB operator keys (`$`, `.`) are stripped from request bodies and queries. Search text is regex-escaped.
- Helmet with a strict Content Security Policy (scripts only from this server). All user text is HTML-escaped before rendering.
- Uploads: JPG, PNG or WebP only, 5 MB each, at most 5. Files are re-encoded by sharp.
- No card, bank or UPI PIN data is ever collected. Only the UTR reference text is stored.
- Public seller data excludes email and UPI ID. The phone number appears only as a WhatsApp link, and only if the seller allows it.
- `.env` is git-ignored. Use `.env.example` as the template.

Optional settings in `.env`: `PRODUCT_APPROVAL_REQUIRED=true` makes new products wait for admin approval. Setting the `CLOUDINARY_*` variables stores images on Cloudinary.

---

## 11. Responsive & accessibility

- Mobile-first breakpoints: 320+, 768+ (tablet), 1024+ (desktop), 1440+ (large).
- The navbar becomes a hamburger menu and the dashboard sidebar becomes a drawer. The product grid shows 2, 3 or 4 columns. Tables become stacked cards. Touch targets are at least 44–48 px.
- Semantic landmarks, a skip link, labelled form fields with inline error messages, visible focus styles, modals with a focus trap and Escape to close, alt text on images, a table view for every chart, and reduced-motion support.
