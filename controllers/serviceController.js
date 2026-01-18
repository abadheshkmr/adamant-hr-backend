import serviceModel from "../models/serviceModel.js";
import fs from 'fs';


// add service

const addService = async (req , res) => {
    let image_filename = `${req.file.filename}`;

    const service = new serviceModel({
        title:req.body.title,
        description:req.body.description,
        icon:image_filename
    })

    try{
        await service.save();
        res.json({success:true,message:"service Added"})
    } catch(error) {
        console.log(error);
        res.json({success:false,message:"Error"});
        
    }

}

//get service

const getService = async (req , res) => {
    try {
        const service = await serviceModel.findById(req.params.id);
        res.json({success:true, data:service})  
    } catch (error) {
        log(error);
        res.json({success:false,message:"Error"});
    }
}

// all service list

const listService = async (req,res) => {
    try {
        const services = await serviceModel.find({});
        res.json({success:true, data:services})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"});
        
    }
}

//update service

const updateService = async (req, res) => {
  try {
    const { id, title, description } = req.body;

    // Build update object
    const updateData = {
      title,
      description,
    };

    // Only add icon if a new file was uploaded
    if (req.file) {
      updateData.icon = req.file.filename;
    }

    const service = await serviceModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!service) {
      return res.json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service Updated", service });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};



//remove service

const removeService = async (req , res) => {
    try {
        const service = await serviceModel.findById(req.body.id);
        
        fs.unlink(`uploads/${service.icon}` , ()=>{})

        await serviceModel.findByIdAndDelete(req.body.id);
        res.json({success:true,message:"Service Removed"})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"})
    }
}

export {addService , getService , listService , removeService , updateService};