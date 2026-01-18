import CVModel from "../models/cvModel.js";
import fs from "fs";

// add CV

const addCV = async (req, res) => {
  let resume_filename = req.file ? `${req.file.filename}` : null;

  const cv = new CVModel({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    address: req.body.address,
    mobileNo: req.body.mobileNo,
    jobId: req.body.jobId,
    city: req.body.city,
    state: req.body.state,
    tenthPercentage: req.body.tenthPercentage,
    twelfthPercentage: req.body.twelfthPercentage,
    degree: req.body.degree,
    degreeCgpa: req.body.degreeCgpa,
    resume: { url: resume_filename ? `uploads/resumes/${resume_filename}` : null },
  });

  try {
    const exist = await CVModel.findOne({email:req.body.email});
    
    if(!exist)
    {
      await cv.save();
      res.json({ success: true, message: "CV Added" });
    }
    else{
      res.json({success:false , message: "already applied"});
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error });
  }
};

// get CV by id
const getCV = async (req, res) => {
  try {
    const cv = await CVModel.findById(req.params.id);
    res.json(cv ? { success: true, data: cv } : { success: false, message: "CV not found" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// list all CVs
const listCVs = async (req, res) => {
  try {
    
    const { jobId } = req.query;
    const filter = jobId ? { jobId } : {};
    const cvs = await CVModel.find(filter);
    
    res.json({ success: true, data: cvs });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// remove CV
const removeCV = async (req, res) => {
  console.log("entered remove function");
  
  try {
    const cv = await CVModel.findById(req.body.id);

    if (!cv) {
      return res.json({ success: false, message: "CV not found" });
    }

    if (cv.resume?.url) {
      
      fs.unlink(`${cv.resume.url}` , ()=>{})
    }

    await CVModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, message: "CV Removed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

export { addCV, getCV, listCVs, removeCV };
