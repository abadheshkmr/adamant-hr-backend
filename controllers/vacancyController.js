import vacancyModel from "../models/vacancyModel.js";
import industryModel from "../models/industryModel.js";
import ClientModel from "../models/clientModel.js";
import mongoose from "mongoose";

// Helper function to check if request is from admin
const isAdminRequest = (req) => {
  const authHeader = req.header("Authorization");
  return !!authHeader && authHeader.startsWith("Bearer ");
};

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

        // Validate client if provided
        if (req.body.client) {
            const clientExists = await ClientModel.findById(req.body.client);
            if (!clientExists) {
                return res.json({success: false, message: "Invalid client selected"});
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
            client: req.body.client || null,
            showClientToCandidate: req.body.showClientToCandidate === true || req.body.showClientToCandidate === 'true',
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
        
        // Populate client for admin response
        if (vacancy.client) {
            await vacancy.populate('client', 'name');
        }
        
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

        // Client filter (admin only)
        const isAdmin = isAdminRequest(req);
        if (req.query.client && isAdmin) {
            filter.client = req.query.client;
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
        
        // Fetch with pagination, filters, and populate industry and client
        let vacancies = await vacancyModel
            .find(filter)
            .populate('industry', 'name image') // Populate industry name and image
            .populate('client', 'name') // Populate client name
            .select('jobTitle description qualification jobId createdAt industry location employmentType experienceLevel salary applicationDeadline numberOfOpenings skills client showClientToCandidate')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for faster queries (returns plain JS objects)

        // Remove client info from public responses unless showClientToCandidate is true
        if (!isAdmin) {
            vacancies = vacancies.map(vacancy => {
                if (!vacancy.showClientToCandidate) {
                    delete vacancy.client;
                }
                delete vacancy.showClientToCandidate; // Never expose this flag to public
                return vacancy;
            });
        }

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
        const isAdmin = isAdminRequest(req);

        // Check if id is a valid MongoDB ObjectId (24 character hex string)
        if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
            // Try to find by MongoDB _id
            // For admin requests, return all fields; for public, filter client
            vacancy = await vacancyModel
                .findById(id)
                .populate('industry', 'name description image list')
                .populate('client', 'name description contactPerson email phone address website isActive') // Populate full client data for admin
                .lean();
        } else {
            // If not a valid ObjectId, try to find by numeric jobId
            const jobId = parseInt(id);
            if (!isNaN(jobId)) {
                vacancy = await vacancyModel
                    .findOne({ jobId: jobId })
                    .populate('industry', 'name description image list')
                    .populate('client', 'name description contactPerson email phone address website isActive') // Populate full client data for admin
                    .lean();
            }
        }

        if (!vacancy) {
            return res.json({ success: false, message: "Vacancy not found" });
        }

        // Remove client info from public responses unless showClientToCandidate is true
        if (!isAdmin) {
            if (!vacancy.showClientToCandidate) {
                delete vacancy.client;
            }
            delete vacancy.showClientToCandidate; // Never expose this flag to public
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
        const { id, ...updateFields } = req.body;
        
        console.log(`[${new Date().toISOString()}] Update Vacancy Request - ID: ${id}`);
        console.log(`[${new Date().toISOString()}] Update Fields:`, JSON.stringify(req.body, null, 2));
        
        if (!id) {
            return res.json({ success: false, message: "Vacancy ID is required" });
        }

        // Get existing vacancy to preserve data
        const existingVacancy = await vacancyModel.findById(id);
        if (!existingVacancy) {
            return res.json({ success: false, message: "Vacancy not found" });
        }

        console.log(`[${new Date().toISOString()}] Existing Vacancy Data:`, {
            jobTitle: existingVacancy.jobTitle,
            city: existingVacancy.location?.city,
            state: existingVacancy.location?.state,
            client: existingVacancy.client,
            showClientToCandidate: existingVacancy.showClientToCandidate
        });

        // Build updateData - only include fields that are explicitly provided
        const updateData = {
            updatedAt: new Date()
        };

        // Only update fields that are explicitly provided in the request
        if (req.body.jobTitle !== undefined) updateData.jobTitle = req.body.jobTitle;
        if (req.body.description !== undefined) updateData.description = req.body.description;
        if (req.body.qualification !== undefined) updateData.qualification = req.body.qualification;
        
        // Industry - validate if provided
        if (req.body.industry !== undefined) {
            if (req.body.industry === null || req.body.industry === '') {
                updateData.industry = null;
            } else {
                const industryExists = await industryModel.findById(req.body.industry);
                if (!industryExists) {
                    return res.json({success: false, message: "Invalid industry selected"});
                }
                updateData.industry = req.body.industry;
            }
        }
        
        // Client - validate if provided
        if (req.body.client !== undefined) {
            if (req.body.client === null || req.body.client === '') {
                updateData.client = null;
            } else {
                const clientExists = await ClientModel.findById(req.body.client);
                if (!clientExists) {
                    return res.json({success: false, message: "Invalid client selected"});
                }
                updateData.client = req.body.client;
            }
        }
        
        // Show client to candidate - only update if explicitly provided
        if (req.body.showClientToCandidate !== undefined) {
            updateData.showClientToCandidate = req.body.showClientToCandidate === true || req.body.showClientToCandidate === 'true';
        }
        
        // Skills - only update if provided
        if (req.body.skills !== undefined) {
            updateData.skills = Array.isArray(req.body.skills) ? req.body.skills : [];
        }
        
        // Location - only update if any location field is provided
        if (req.body.city !== undefined || req.body.state !== undefined || req.body.country !== undefined || req.body.isRemote !== undefined) {
            // Preserve existing location data
            const existingLocation = existingVacancy.location?.toObject ? existingVacancy.location.toObject() : existingVacancy.location || {};
            updateData.location = {
                ...existingLocation
            };
            // Only update fields that are explicitly provided
            if (req.body.city !== undefined) updateData.location.city = req.body.city;
            if (req.body.state !== undefined) updateData.location.state = req.body.state;
            if (req.body.country !== undefined) updateData.location.country = req.body.country;
            if (req.body.isRemote !== undefined) updateData.location.isRemote = req.body.isRemote;
        }
        
        // Employment details - only update if provided
        if (req.body.employmentType !== undefined) updateData.employmentType = req.body.employmentType;
        if (req.body.experienceLevel !== undefined) updateData.experienceLevel = req.body.experienceLevel;
        
        // Salary - only update if provided
        if (req.body.salary !== undefined) {
            if (typeof req.body.salary === 'object' && req.body.salary !== null) {
                updateData.salary = {
                    ...existingVacancy.salary?.toObject ? existingVacancy.salary.toObject() : existingVacancy.salary || {}, // Preserve existing salary data
                    ...req.body.salary // Override with new values
                };
            } else {
                updateData.salary = req.body.salary;
            }
        }
        
        // Application details - only update if provided
        if (req.body.applicationDeadline !== undefined) {
            updateData.applicationDeadline = req.body.applicationDeadline || null;
        }
        if (req.body.numberOfOpenings !== undefined) {
            updateData.numberOfOpenings = req.body.numberOfOpenings;
        }
        
        // Status - only update if provided
        if (req.body.status !== undefined) {
            updateData.status = req.body.status;
            
            // Set publishedAt when status changes to active
            if (req.body.status === 'active' && (!existingVacancy.publishedAt)) {
                updateData.publishedAt = new Date();
            }
        }

        console.log(`[${new Date().toISOString()}] Update Data to be applied:`, JSON.stringify(updateData, null, 2));

        const vacancy = await vacancyModel.findByIdAndUpdate(
            id,
            { $set: updateData }, // Use $set to only update provided fields
            { new: true, runValidators: true }
        ).populate('client', 'name').populate('industry', 'name');

        if (!vacancy) {
            return res.json({ success: false, message: "Vacancy not found" });
        }

        console.log(`[${new Date().toISOString()}] Vacancy Updated Successfully`);

        res.json({ success: true, message: "Vacancy Updated", data: vacancy });
    } catch (error) {
        console.log(`[${new Date().toISOString()}] Update Vacancy Error:`, error);
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
