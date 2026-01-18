import vacancyModel from "../models/vacancyModel.js";

// add vacancy

const addVacancy = async (req , res) => {
    try {
        // Get the count of existing vacancies to generate jobId
        const lastVacancy = await vacancyModel.findOne().sort({ jobId: -1 }).select("jobId");
        const jobId = lastVacancy ? lastVacancy.jobId + 1 : 1;


        const vacancy = new vacancyModel({
            jobTitle:req.body.jobTitle,
            description:req.body.description,
            qualification:req.body.qualification,
            jobId: jobId
        })

        await vacancy.save();
        res.json({success:true,message:"Vacancy Added"})
    } catch(error) {
        console.log(error);
        res.json({success:false,message:"Error"});

    }

}

// all vacancy list

const listVacancy = async (req,res) => {
    try {
        const vacancies = await vacancyModel.find({}).sort({ createdAt: -1 });
        res.json({success:true, data:vacancies})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"});

    }
}

//remove vacancy

const removeVacancy = async (req , res) => {
    try {
        await vacancyModel.findByIdAndDelete(req.body.id);
        res.json({success:true,message:"Vacancy Removed"})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:"Error"})
    }
}

export {addVacancy , listVacancy , removeVacancy};
