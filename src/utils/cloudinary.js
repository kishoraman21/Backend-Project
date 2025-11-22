import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localfile) => {
  try {
    if (!localfile) return null;

    //uploading file on clodinary

    const response = await cloudinary.uploader.upload(localfile, {
      resource_type: "auto",
    });

    // console.log("file is uploaded on cloudinary: ", response.url);
    fs.unlinkSync(localfile)
    return response;
  } catch (error) {
    fs.unlinkSync(localfile); //remove the locally saved temp files
    return null;
  }
};


export {uploadOnCloudinary}