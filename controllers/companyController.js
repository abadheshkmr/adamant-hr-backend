import CompanyModel from '../models/companyModel.js';

const addCompany = async (req, res) => {
  try {
    const company = new CompanyModel({
      name: req.body.name,
      description: req.body.description,
      founded: req.body.founded,
      employees: req.body.employees,
      logo: req.body.logo,
      website: req.body.website,
      benefits: Array.isArray(req.body.benefits) ? req.body.benefits : [],
      culture: req.body.culture,
      image: req.body.image,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });
    await company.save();
    res.json({ success: true, message: 'Company added successfully', data: company });
  } catch (error) {
    console.error('[addCompany]', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ success: false, message: `Validation error: ${errors}` });
    }
    res.status(500).json({ success: false, message: 'Error adding company', error: error.message });
  }
};

const getCompany = async (req, res) => {
  try {
    const company = await CompanyModel.findById(req.params.id).lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    console.error('[getCompany]', error);
    res.status(500).json({ success: false, message: 'Error fetching company' });
  }
};

const listCompanies = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      filter.name = new RegExp(req.query.search, 'i');
    }
    const companies = await CompanyModel.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error('[listCompanies]', error);
    res.status(500).json({ success: false, message: 'Error listing companies' });
  }
};

const updateCompany = async (req, res) => {
  try {
    const updates = {};
    const allowed = ['name', 'description', 'founded', 'employees', 'logo', 'website', 'culture', 'image', 'isActive'];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    if (req.body.benefits !== undefined) {
      updates.benefits = Array.isArray(req.body.benefits) ? req.body.benefits : [];
    }
    const company = await CompanyModel.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company updated successfully', data: company });
  } catch (error) {
    console.error('[updateCompany]', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ success: false, message: `Validation error: ${errors}` });
    }
    res.status(500).json({ success: false, message: 'Error updating company' });
  }
};

const removeCompany = async (req, res) => {
  try {
    const company = await CompanyModel.findByIdAndDelete(req.body.id || req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company removed successfully' });
  } catch (error) {
    console.error('[removeCompany]', error);
    res.status(500).json({ success: false, message: 'Error removing company' });
  }
};

export { addCompany, getCompany, listCompanies, updateCompany, removeCompany };
