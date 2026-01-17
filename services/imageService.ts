import { ResponseType } from "@/types";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/constants";
import axios from "axios";

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadFileToCloudinary = async (
  file: { uri?: string } | string,
  folderName: string
): Promise<ResponseType> => {
  try {
    // Prepare the file data

    if (typeof file === "string") {
      return {
        success: true,
        data: file,
      };
    }

    if (file && file.uri) {
      const formData = new FormData();
      formData.append("file", {
        uri: file?.uri,
        type: "image/jpeg",
        name: file?.uri?.split("/").pop() || "file.jpg",
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", folderName);

      const response = await axios.post(CLOUDINARY_UPLOAD_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Return the success response
      return {
        success: true,
        data: response.data.secure_url,
      };
    } else {
      return { success: false, msg: "Invalid file" };
    }
  } catch (error: any) {
    console.error("Error during file upload:", error);
    return {
      success: false,
      msg: error?.message || "Could not uplaod media",
    };
  }
};

export const getProfileImage = (file: any) => {
  if (file && typeof file == "string") return file;
  if (file && typeof file == "object" && file.uri) return file.uri;

  return require("../assets/images/defaultAvatar.png");
};
export const getFilePath = (file: any) => {
  if (file && typeof file == "string") return file;
  if (file && typeof file == "object" && file.uri) return file.uri;
};
