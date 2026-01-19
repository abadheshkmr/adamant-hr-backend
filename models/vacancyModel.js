import mongoose from 'mongoose'

const vacancySchema = new mongoose.Schema({
    jobTitle: {type:String , required: true},
    description: {type:String , required:true},
    qualification:{type:String , required:true},
    jobId: {type:Number , unique:true , required:true},
    createdAt: { type: Date, default: Date.now }

})

// Add indexes for faster queries
vacancySchema.index({ createdAt: -1 }); // For sorting by creation date
vacancySchema.index({ jobId: 1 }); // Already unique, but explicit index helps

const vacancyModel = mongoose.models.vacancies || mongoose.model("vacancies" , vacancySchema);

export default vacancyModel;
