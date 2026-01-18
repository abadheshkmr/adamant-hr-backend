import mongoose from "mongoose";

const industrySchema = new mongoose.Schema({
    name: {type:String , required: true, unique:true},
    description: {type:String , required:true},
    image:{type:String , required:true},
    list:[String]
});

const industryModel = mongoose.models.industries || mongoose.model("industries" , industrySchema);

export default industryModel;   