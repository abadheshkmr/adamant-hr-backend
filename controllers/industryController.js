import industryModel from "../models/industryModel.js";
import fs from 'fs';

// add industry

const addIndustry = async (req , res) => {
    const image_filename = req.file ? req.file.filename : null;

    const industry = new industryModel({
        name: req.body.name,
        description: req.body.description,
        image: image_filename,
        list: JSON.parse(req.body.list || '[]')
    })

    try{
        await industry.save();
        res.json({success:true,message:"Industry Added"})
    } catch(error) {
        console.log(error);
        res.json({success:false,message:"Error"});
        
    }

}

// get industry

const getIndustry = async (req , res) => {
    try {
        
        const industry = await industryModel.findById(req.params.id);
        res.json({success:true, data:industry});
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"});
    }
}

// all industry list
// GET /api/industry/list - full details
// GET /api/industry/list?minimal=true - only _id and name (for dropdowns)

const listIndustry = async (req, res) => {
  try {
    const minimal = req.query.minimal === 'true';
    if (minimal) {
      const industries = await industryModel.find({}).select('_id name').sort({ name: 1 }).lean();
      return res.json({ success: true, data: industries });
    }
    const industries = await industryModel.find({});
    res.json({ success: true, data: industries });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: 'Error' });
  }
};

//update industry

const updateIndustry = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      list: req.body.list ? JSON.parse(req.body.list) : []
    };

    if (req.file) {
      updateData.image = req.file.filename;
    } else if (req.body.imagePath && typeof req.body.imagePath === 'string') {
      // Set image path without file upload (e.g. "industry/information-technology.png" for frontend static images)
      updateData.image = req.body.imagePath.trim();
    }

    const industry = await industryModel.findByIdAndUpdate(req.body.id, updateData, { new: true });

    res.json(industry ? { success: true, message: "Industry Updated", data: industry }
                      : { success: false, message: "Industry not found" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};



//remove industry

const removeIndustry = async (req , res) => {
    try {
        const industry = await industryModel.findById(req.body.id);
        if (industry?.image) {
            try {
                fs.unlinkSync(`uploads/${industry.image}`);
            } catch (e) {
                if (e.code !== 'ENOENT') console.error('Remove industry image:', e);
            }
        }

        await industryModel.findByIdAndDelete(req.body.id);
        res.json({success:true,message:"industry Removed"})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"})
    }
}

// bulk add/update industries (JSON body, no image)
const bulkIndustries = async (req, res) => {
  try {
    const { industries } = req.body;
    if (!Array.isArray(industries)) {
      return res.status(400).json({ success: false, message: 'Body must include industries array' });
    }

    const results = { added: 0, updated: 0, errors: [] };

    for (let i = 0; i < industries.length; i++) {
      const item = industries[i];
      const { name, description, list } = item;

      if (!name || typeof name !== 'string') {
        results.errors.push({ index: i, message: 'name is required' });
        continue;
      }

      const listArr = Array.isArray(list) ? list : [];

      const imagePath = typeof item.image === 'string' ? item.image.trim() : null;

      try {
        const existing = await industryModel.findOne({ name: name.trim() });
        if (existing) {
          existing.description = description || existing.description;
          existing.list = listArr;
          if (imagePath) existing.image = imagePath;
          await existing.save();
          results.updated++;
        } else {
          await industryModel.create({
            name: name.trim(),
            description: description || '',
            list: listArr,
            image: imagePath
          });
          results.added++;
        }
      } catch (err) {
        results.errors.push({ index: i, name, message: err.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk complete: ${results.added} added, ${results.updated} updated`,
      data: results
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

export { addIndustry, getIndustry, listIndustry, removeIndustry, updateIndustry, bulkIndustries };