import { asyncHandler } from "../utils/asyncHandler.js";
import { UserModel } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import bcrypt from "bcrypt";


const registerUser = asyncHandler(async (req, res) => {
  // console.log("body:" , req.body)
  const { fullName, username, email, password } = req.body;

  //   console.log("email:", email);

  //validation of the data fields
  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await UserModel.findOne({
    $or: [{ username }, { email }],
  });

  if (user) {
    throw new ApiError(409, "User already exists");
  }

  //check for avatar and coverImnage path

  //   console.log("req files : " , req.files)
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //   const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.lenght > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //uploading the avatr and coverimages to the cloudinary

  const uploadAvatarFile = await uploadOnCloudinary(avatarLocalPath);
  const uploadCoverImageFile = await uploadOnCloudinary(coverImageLocalPath);

  if (!uploadAvatarFile) {
    throw new ApiError(400, "Avatar file is is required ");
  }

  //user object
  const newUser = await UserModel.create({
    fullName,
    avatar: uploadAvatarFile.url,
    coverImage: uploadCoverImageFile?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  //removing the password and refresh token from the user obj using select "-"
  const isNewUser = await UserModel.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!isNewUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, isNewUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  //validations

 if(!username || !email){
   throw new ApiError(400 , "username or email is required")
 }

  const user = await UserModel.findOne({
    $or: [{ email }, { username }], //optional for email or password 
  });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

//   const isMatch = await bcrypt.compare(password, user.password);
     const isMatch = await user.isPasswordCorrect(password)

  if (!isMatch) {
    throw new ApiError(401, "Invalid user credentials");
  }

//   const 


});

export { registerUser , loginUser };
