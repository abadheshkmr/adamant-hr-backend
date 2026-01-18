import mongoose from "mongoose";

const connectDB = async () => {
    await mongoose.connect(process.env.URI).then(() =>{console.log("DB connected");
    });
    console.log("MongoDB connected");
}

export default connectDB;