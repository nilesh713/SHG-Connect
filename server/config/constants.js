// Shared enums used by models, validators and controllers.

const ROLES = ['customer', 'artisan', 'shg_member', 'shg_leader', 'producer', 'admin'];
const SELLER_ROLES = ['artisan', 'shg_member', 'shg_leader', 'producer'];
// Roles a visitor may pick on the public registration form (admin is never self-assigned)
const REGISTRATION_ROLES = ['customer', ...SELLER_ROLES];

const PRODUCT_STATUSES = ['draft', 'pending', 'approved', 'rejected'];

// Order lifecycle in the order sellers move through it
const ORDER_FLOW = ['new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
const ORDER_STATUSES = [...ORDER_FLOW, 'cancelled'];

const PAYMENT_METHODS = ['cod', 'upi'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const DELIVERY_OPTIONS = ['pickup', 'local', 'state', 'nationwide'];

const REVIEW_STATUSES = ['approved', 'flagged', 'hidden'];

const PROMOTION_TYPES = ['promoted', 'featured', 'discount'];
const PROMOTION_DURATIONS = [3, 7, 15, 30]; // days

const DEFAULT_CATEGORIES = [
  { slug: 'handicrafts', name: 'Handicrafts', nameHi: 'हस्तशिल्प', icon: 'scissors' },
  { slug: 'handloom-textile', name: 'Handloom / Textile', nameHi: 'हथकरघा / कपड़ा', icon: 'layers' },
  { slug: 'clothing-embroidery', name: 'Clothing / Embroidery', nameHi: 'कपड़े / कढ़ाई', icon: 'shirt' },
  { slug: 'food-products', name: 'Food Products', nameHi: 'खाद्य उत्पाद', icon: 'soup' },
  { slug: 'jewelry-accessories', name: 'Jewelry / Accessories', nameHi: 'आभूषण / एक्सेसरीज़', icon: 'gem' },
  { slug: 'pottery', name: 'Pottery', nameHi: 'मिट्टी के बर्तन', icon: 'amphora' },
  { slug: 'wooden-products', name: 'Wooden Products', nameHi: 'लकड़ी के उत्पाद', icon: 'trees' },
  { slug: 'agriculture-products', name: 'Agriculture Products', nameHi: 'कृषि उत्पाद', icon: 'wheat' },
  { slug: 'other', name: 'Other', nameHi: 'अन्य', icon: 'package' }
];

module.exports = {
  ROLES,
  SELLER_ROLES,
  REGISTRATION_ROLES,
  PRODUCT_STATUSES,
  ORDER_FLOW,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  DELIVERY_OPTIONS,
  REVIEW_STATUSES,
  PROMOTION_TYPES,
  PROMOTION_DURATIONS,
  DEFAULT_CATEGORIES
};
