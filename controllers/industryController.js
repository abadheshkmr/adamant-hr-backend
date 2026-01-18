import industryModel from "../models/industryModel.js";
import fs from 'fs';

// add industry

const addIndustry = async (req , res) => {
    let image_filename = `${req.file.filename}`;

    const industry = new industryModel({
        name:req.body.name,
        description:req.body.description,
        image:image_filename,
        list:JSON.parse(req.body.list)
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

const listIndustry = async (req,res) => {
    try {
        const industries = await industryModel.find({});
        res.json({success:true, data:industries})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"});
        
    }
}

//update industry

const updateIndustry = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      list: req.body.list ? JSON.parse(req.body.list) : []
    };

    if (req.file) updateData.image = req.file.filename;

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
        fs.unlink(`uploads/${industry.image}` , ()=>{})

        await industryModel.findByIdAndDelete(req.body.id);
        res.json({success:true,message:"industry Removed"})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"})
    }
}

export {addIndustry , getIndustry , listIndustry , removeIndustry , updateIndustry};