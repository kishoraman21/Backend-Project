import { asyncHandler } from "../utils/asyncHandler.js";
import { UserModel } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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
  //generating the access and refresh tokens to the user
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

//       *****LOGOUT USER*******
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
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await UserModel.findById(req.user?._id);

  const isPassMatch = await user.isPasswordCorrect(oldPassword, user.password);

  if (!isPassMatch) {
    throw new ApiError(400, "Invalid old Password ");
  }

  //seting new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); //saving this new changes to the db

  return res.status(200).json(new ApiResponse(200, {}, "Password changed "));
});

const getcurrentUser = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  console.log(currentUser);

  // const user = await UserModel.findById(currentUser);

  if (!currentUser) {
    throw new ApiError(400, "No User found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, `current user : ${currentUser}`));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await UserModel.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));

  user.fullName = fullName;
  user.email = email;
  await user.save();
});

//  ***** AVATAR CHANGES ******

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading the avatar file");
  }

  const user = await UserModel.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Image is changed successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const CoverLocalPath = req.file?.path;
  if (!CoverLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverImage = await uploadOnCloudinary(CoverLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading the Cover Image file");
  }

  const user = await UserModel.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image is changed successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(401, "Username is missing");
  }

  const channel = UserModel.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel", //selecting this for finding out subscribers
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber", //selecting this for finding out subscribed to
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers", //for no of subscribers
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo", //for no of channels subscribed by the user
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  console.log("channel :", channel)

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched succesfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  // run the aggregation and await result
  const user = await UserModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id), //found the user
      },
    },
    {
      $lookup: {
        from: "vidoes",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  // console.log("user data: ", user)


  return res
    .status(200)
    .json(
      new ApiResponse(
        200, user[0].watchHistory, "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getcurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
