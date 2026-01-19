import vacancyModel from "../models/vacancyModel.js";
import industryModel from "../models/industryModel.js";
import mongoose from "mongoose";

// add vacancy

const addVacancy = async (req , res) => {
    try {
        // Validate industry if provided
        if (req.body.industry) {
            const industryExists = await industryModel.findById(req.body.industry);
            if (!industryExists) {
                return res.json({success: false, message: "Invalid industry selected"});
            }
        }

        // Get the count of existing vacancies to generate jobId
        const lastVacancy = await vacancyModel.findOne().sort({ jobId: -1 }).select("jobId");
        const jobId = lastVacancy ? lastVacancy.jobId + 1 : 1;

        const vacancy = new vacancyModel({
            jobTitle: req.body.jobTitle,
            description: req.body.description,
            qualification: req.body.qualification,
            industry: req.body.industry || null,
            skills: req.body.skills || [],
            location: {
                city: req.body.city || '',
                state: req.body.state || '',
                country: req.body.country || 'India',
                isRemote: req.body.isRemote || false
            },
            employmentType: req.body.employmentType || 'Full-time',
            experienceLevel: req.body.experienceLevel || 'Fresher',
            salary: req.body.salary || {},
            applicationDeadline: req.body.applicationDeadline || null,
            numberOfOpenings: req.body.numberOfOpenings || 1,
            status: req.body.status || 'active',
            publishedAt: req.body.status === 'active' ? new Date() : null,
            jobId: jobId
        });

        await vacancy.save();
        res.json({success: true, message: "Vacancy Added", data: vacancy});
    } catch(error) {
        console.log(error);
        res.json({success: false, message: "Error", error: error.message});
    }
}

// all vacancy list with pagination and filtering

const listVacancy = async (req,res) => {
    try {
        console.log(`[${new Date().toISOString()}] GET /api/vacancy/list - Query params:`, req.query);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default 10 per page
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};
        
        // Status filter - show active by default, or all if status query param provided
        if (req.query.status) {
            filter.status = req.query.status;
        } else {
            // For public endpoint, show active or vacancies without status (backward compatibility)
            // Use $in to check for multiple status values or null/undefined
            filter.$or = [
                { status: 'active' },
                { status: { $exists: false } },
                { status: null }
            ];
        }

        // Industry filter
        if (req.query.industry) {
            filter.industry = req.query.industry;
        }

        // Location filters
        if (req.query.city) {
            filter['location.city'] = new RegExp(req.query.city, 'i');
        }
        if (req.query.state) {
            filter['location.state'] = new RegExp(req.query.state, 'i');
        }
        if (req.query.isRemote !== undefined) {
            filter['location.isRemote'] = req.query.isRemote === 'true';
        }

        // Employment type filter
        if (req.query.employmentType) {
            filter.employmentType = req.query.employmentType;
        }

        // Experience level filter
        if (req.query.experienceLevel) {
            filter.experienceLevel = req.query.experienceLevel;
        }

        // Search in job title and description
        // If we have both status $or and search, combine them with $and
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const searchOr = [
                { jobTitle: searchRegex },
                { description: searchRegex }
            ];
            
            // If we have status $or, combine with $and
            if (filter.$or) {
                filter.$and = [
                    { $or: filter.$or },
                    { $or: searchOr }
                ];
                delete filter.$or;
            } else {
                filter.$or = searchOr;
            }
        }

        console.log(`[${new Date().toISOString()}] Filter object:`, JSON.stringify(filter, null, 2));

        // Get total count with filters
        const total = await vacancyModel.countDocuments(filter);
        console.log(`[${new Date().toISOString()}] Total vacancies found: ${total}`);
        
        // Fetch with pagination, filters, and populate industry
        const vacancies = await vacancyModel
            .find(filter)
            .populate('industry', 'name image') // Populate industry name and image
            .select('jobTitle description qualification jobId createdAt industry location employmentType experienceLevel salary applicationDeadline numberOfOpenings skills')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for faster queries (returns plain JS objects)

        console.log(`[${new Date().toISOString()}] Returning ${vacancies.length} vacancies`);

        res.json({
            success: true,
            data: vacancies,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            },
            filters: {
                industry: req.query.industry || null,
                city: req.query.city || null,
                state: req.query.state || null,
                isRemote: req.query.isRemote || null,
                employmentType: req.query.employmentType || null,
                experienceLevel: req.query.experienceLevel || null,
                search: req.query.search || null
            }
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in listVacancy:`, error);
        console.error('Error stack:', error.stack);
        res.status(500).json({success: false, message: "Error", error: error.message});
    }
}

// Get single vacancy by ID (supports both ObjectId and numeric jobId)
const getVacancy = async (req, res) => {
    try {
        let vacancy;
        const id = req.params.id;

        // Check if id is a valid MongoDB ObjectId (24 character hex string)
        if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
            // Try to find by MongoDB _id
            vacancy = await vacancyModel
                .findById(id)
                .populate('industry', 'name description image list')
                .lean();
        } else {
            // If not a valid ObjectId, try to find by numeric jobId
            const jobId = parseInt(id);
            if (!isNaN(jobId)) {
                vacancy = await vacancyModel
                    .findOne({ jobId: jobId })
                    .populate('industry', 'name description image list')
                    .lean();
            }
        }

        if (!vacancy) {
            return res.json({ success: false, message: "Vacancy not found" });
        }

        // Increment views (use _id for update)
        await vacancyModel.findByIdAndUpdate(vacancy._id, { $inc: { views: 1 } });

        res.json({ success: true, data: vacancy });
    } catch (error) {
        console.log(`[${new Date().toISOString()}] Get Vacancy Error:`, error);
        res.json({ success: false, message: "Error", error: error.message });
    }
};

// Update vacancy
const updateVacancy = async (req, res) => {
    try {
        // Validate industry if provided
        if (req.body.industry) {
            const industryExists = await industryModel.findById(req.body.industry);
            if (!industryExists) {
                return res.json({success: false, message: "Invalid industry selected"});
            }
        }

        const updateData = {
            jobTitle: req.body.jobTitle,
            description: req.body.description,
            qualification: req.body.qualification,
            industry: req.body.industry,
            skills: req.body.skills || [],
            location: {
                city: req.body.city || '',
                state: req.body.state || '',
                country: req.body.country || 'India',
                isRemote: req.body.isRemote || false
            },
            employmentType: req.body.employmentType,
            experienceLevel: req.body.experienceLevel,
            salary: req.body.salary || {},
            applicationDeadline: req.body.applicationDeadline || null,
            numberOfOpenings: req.body.numberOfOpenings || 1,
            status: req.body.status,
            updatedAt: new Date()
        };

        // Set publishedAt when status changes to active
        if (req.body.status === 'active') {
            const existingVacancy = await vacancyModel.findById(req.body.id);
            if (!existingVacancy || !existingVacancy.publishedAt) {
                updateData.publishedAt = new Date();
            }
        }

        const vacancy = await vacancyModel.findByIdAndUpdate(
            req.body.id,
            updateData,
            { new: true }
        );

        if (!vacancy) {
            return res.json({ success: false, message: "Vacancy not found" });
        }

        res.json({ success: true, message: "Vacancy Updated", data: vacancy });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error", error: error.message });
    }
};

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

// Bulk remove vacancies
const bulkRemoveVacancy = async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json({ success: false, message: "No vacancy IDs provided" });
        }

        // Validate all IDs are valid ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        if (validIds.length === 0) {
            return res.json({ success: false, message: "No valid vacancy IDs provided" });
        }

        // Delete multiple vacancies
        const result = await vacancyModel.deleteMany({ _id: { $in: validIds } });
        
        res.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} vacancy/vacancies`,
            deletedCount: result.deletedCount,
            requestedCount: ids.length,
            failed: ids.length - validIds.length > 0 ? ids.length - validIds.length : 0
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.json({ success: false, message: "Error", error: error.message });
    }
};

// Bulk update vacancy status
const bulkUpdateStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json({ success: false, message: "No vacancy IDs provided" });
        }

        if (!status || !['active', 'closed', 'draft'].includes(status)) {
            return res.json({ success: false, message: "Invalid status. Must be 'active', 'closed', or 'draft'" });
        }

        // Validate all IDs are valid ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        if (validIds.length === 0) {
            return res.json({ success: false, message: "No valid vacancy IDs provided" });
        }

        // Prepare update data
        const updateData = {
            status: status,
            updatedAt: new Date()
        };

        // Set publishedAt when activating
        if (status === 'active') {
            updateData.publishedAt = new Date();
        }

        // Update multiple vacancies
        const result = await vacancyModel.updateMany(
            { _id: { $in: validIds } },
            updateData
        );
        
        res.json({
            success: true,
            message: `Successfully updated ${result.modifiedCount} vacancy/vacancies to ${status}`,
            updatedCount: result.modifiedCount,
            requestedCount: ids.length,
            failed: ids.length - validIds.length > 0 ? ids.length - validIds.length : 0
        });
    } catch (error) {
        console.error('Bulk status update error:', error);
        res.json({ success: false, message: "Error", error: error.message });
    }
};

export {addVacancy , listVacancy, getVacancy, updateVacancy, removeVacancy, bulkRemoveVacancy, bulkUpdateStatus};
