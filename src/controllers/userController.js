import { asyncHandler } from "../utils/asyncHandler.js";
import { UserModel } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
//   *****tokens and refresh tokens******
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await UserModel.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens"
    );
  }
};

// *****REGISTER USER*****
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
    req.files.coverImage.length > 0
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

//       *****LOGIN USER*******
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  //validations

  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await UserModel.findOne({
    $or: [{ email }, { username }], //optional for email or password
  });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  // const isMatch = await bcrypt.compare(password, user.password);
  const isMatch = await user.isPasswordCorrect(password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await UserModel.findById(user._id).select(
    "-password -refreshToken"
  );

  //send it to the cookies

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  //taking the user id from the req object which is set from the middleware

  const userId = req.user._id;

  await UserModel.findOneAndUpdate(
    userId,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

//for regenerating the access token from the refreshToken
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await UserModel.findById(decodedRefreshToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid  refresh token ");
    }

    //comapring the refresh token of the user and the coming refreshtoken

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken,  refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
