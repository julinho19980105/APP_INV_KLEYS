import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen a Google Drive a través del Web App de Apps Script.
 * Optimizada para evitar errores de CORS y asegurar el envío de datos.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Usamos text/plain para evitar el preflight de CORS que Google Scripts no maneja bien
    await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'uploadImage',
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    // Como no-cors no devuelve respuesta, esperamos un momento para que el script procese
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Retornamos la URL de la carpeta de Drive como referencia ya que no podemos obtener el ID directo con no-cors
    return `https://drive.google.com/drive/folders/${API_CONFIG.DRIVE_FOLDER_ID}`;
  } catch (error) {
    console.error("Fallo en la comunicación con Drive:", error);
    return "";
  }
}
