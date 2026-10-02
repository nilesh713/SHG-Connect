const Category = require('../models/Category');
const Product = require('../models/Product');
const { asyncHandler, AppError } = require('../utils/helpers');

// GET /api/categories – active categories with number of live products
exports.getCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' && req.user?.role === 'admin' ? {} : { active: true };
  const [cats, counts] = await Promise.all([
    Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([{ $match: { status: 'approved', sellerActive: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }])
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.n]));
  res.json({ success: true, data: cats.map((c) => ({ ...c, productCount: countMap.get(c.slug) || 0 })) });
});

const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// POST /api/admin/categories
exports.createCategory = asyncHandler(async (req, res) => {
  const slug = slugify(req.body.name);
  if (!slug) throw new AppError('Please use English letters or numbers in the category name.', 422);
  const count = await Category.countDocuments();
  const cat = await Category.create({ slug, name: req.body.name, nameHi: req.body.nameHi || '', icon: req.body.icon || 'package', sortOrder: count });
  res.status(201).json({ success: true, message: 'Category added', data: cat });
});

// PUT /api/admin/categories/:id  (slug stays fixed so existing products keep their category)
exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new AppError('Category not found', 404);
  for (const f of ['name', 'nameHi', 'icon', 'active']) if (req.body[f] !== undefined) cat[f] = req.body[f];
  await cat.save();
  res.json({ success: true, message: 'Category updated', data: cat });
});

// DELETE /api/admin/categories/:id
exports.deleteCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new AppError('Category not found', 404);
  const used = await Product.countDocuments({ category: cat.slug });
  if (used) throw new AppError(`${used} product(s) use this category. Hide it instead of deleting.`, 409);
  await cat.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});
