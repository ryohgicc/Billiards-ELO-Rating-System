import type { PlayerPhoto, PlayerPhotoRole } from "@/lib/types";

export const MAX_PLAYER_PHOTOS_PER_UPLOAD = 6;
export const MAX_PLAYER_PHOTOS_PER_PLAYER = 24;
export const MAX_PLAYER_PHOTO_DIMENSION = 1080;
export const PLAYER_PHOTO_OUTPUT_QUALITY = 0.82;
export const MAX_PLAYER_PHOTO_DATA_URL_LENGTH = 1_600_000;

export function normalizePlayerPhotoRole(value: unknown): PlayerPhotoRole {
  return value === "victory" || value === "defeat" ? value : "default";
}

export function getPlayerPhotoCanvasOutputType(fileType: string) {
  void fileType;
  return "image/jpeg";
}

function hashString(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function isPlayerPhotoDataUrl(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value);
}

export function normalizePlayerPhotoImageData(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (!isPlayerPhotoDataUrl(normalized)) {
    return "";
  }

  return normalized.slice(0, MAX_PLAYER_PHOTO_DATA_URL_LENGTH);
}

export function pickFeaturedPhoto(photos: PlayerPhoto[], seed: string) {
  if (photos.length === 0) {
    return null;
  }

  const index = hashString(seed) % photos.length;
  return photos[index];
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("读取照片失败"));
    image.src = url;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("读取照片失败"));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => reject(new Error("读取照片失败"));
    reader.readAsDataURL(file);
  });
}

export async function preparePlayerPhotoPayload(files: FileList | File[]) {
  const fileArray = Array.from(files).slice(0, MAX_PLAYER_PHOTOS_PER_UPLOAD);

  if (fileArray.length === 0) {
    throw new Error("请选择至少一张照片");
  }

  return Promise.all(
    fileArray.map(async (file) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("只能上传图片文件");
      }

      const rawDataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(rawDataUrl);
      const scale = Math.min(
        1,
        MAX_PLAYER_PHOTO_DIMENSION / Math.max(image.width, image.height),
      );
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("浏览器不支持照片处理");
      }

      context.fillStyle = "#f4f7f2";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const outputType = getPlayerPhotoCanvasOutputType(file.type);
      const imageData =
        outputType === "image/jpeg"
          ? canvas.toDataURL(outputType, PLAYER_PHOTO_OUTPUT_QUALITY)
          : canvas.toDataURL(outputType);

      if (imageData.length > MAX_PLAYER_PHOTO_DATA_URL_LENGTH) {
        throw new Error("照片过大，请换一张更小的图片");
      }

      return imageData;
    }),
  );
}
