// Image handling utilities
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function svgToPng(svgText: string): Promise<string> {
  const svgData = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
  const img = new Image();
  img.width = 800;
  img.height = 600;

  return new Promise<string>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const pngData = canvas.toDataURL("image/png");
        resolve(pngData);
      } catch (error) {
        reject(new Error("Failed to convert to PNG"));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load SVG"));
    };

    img.src = svgData;
  });
}

export async function resizeImage(
  dataUrl: string,
  maxDimension: number = 1024,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      // Create canvas and resize
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to data URL
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };

    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = dataUrl;
  });
}

export function formatImageData(base64Data: string): string | Promise<string> {
  if (base64Data.startsWith("data:image/")) {
    return base64Data;
  }

  let imageType = "png";

  if (base64Data.startsWith("/9j/")) {
    imageType = "jpeg";
  } else if (base64Data.startsWith("R0lGOD")) {
    imageType = "gif";
  } else if (base64Data.startsWith("UklGR")) {
    imageType = "webp";
  } else if (base64Data.includes("<svg") || base64Data.startsWith("PHN2Zz")) {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        reject(new Error("Failed to convert SVG to PNG"));
      };
      img.src = base64Data.startsWith("data:")
        ? base64Data
        : `data:image/svg+xml;base64,${base64Data}`;
    });
  }

  return `data:image/${imageType};base64,${base64Data.replace(/^data:.+;base64,/, "")}`;
}
