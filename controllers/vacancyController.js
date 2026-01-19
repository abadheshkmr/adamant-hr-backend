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

// all vacancy list with pagination

const listVacancy = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default 10 per page
        const skip = (page - 1) * limit;

        // Get total count for pagination info
        const total = await vacancyModel.countDocuments({});
        
        // Fetch with pagination and projection (only needed fields)
        const vacancies = await vacancyModel
            .find({})
            .select('jobTitle description qualification jobId createdAt') // Only return needed fields
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for faster queries (returns plain JS objects)

        res.json({
            success: true,
            data: vacancies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.log(error);
        res.json({success: false, message: "Error"});
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
