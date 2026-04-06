import { supabase } from "./supabase";

const IMAGE_MAX = 5 * 1024 * 1024;  // 5MB
const FILE_MAX  = 20 * 1024 * 1024; // 20MB

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES  = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-hwp",
];

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export async function uploadImage(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WEBP)");
  }
  if (file.size > IMAGE_MAX) {
    throw new Error("이미지 파일은 5MB 이하만 업로드 가능합니다");
  }
  return _upload(file, "images");
}

export async function uploadAttachment(file) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error("지원하지 않는 파일 형식입니다");
  }
  if (file.size > FILE_MAX) {
    throw new Error("파일은 20MB 이하만 업로드 가능합니다");
  }
  return _upload(file, "files");
}

async function _upload(file, folder) {
  const ext = file.name.split(".").pop().toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${folder}/${safeName}`;

  const { error } = await supabase.storage
    .from("post-uploads")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from("post-uploads")
    .getPublicUrl(path);

  return { url: publicUrl, name: file.name, size: file.size, type: file.type };
}
