import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema({
    title: {type:String , required: true , unique:true},
    description: {type:String , required:true},
    icon:{type:String , required:true},

})

const serviceModel = mongoose.models.services || mongoose.model("services" , serviceSchema);

export default serviceModel;