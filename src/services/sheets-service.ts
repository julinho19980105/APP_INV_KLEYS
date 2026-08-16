
import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen a Google Drive a través del Web App de Apps Script.
 * Utiliza modo CORS para poder leer la respuesta (URL real).
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Enviamos como text/plain para evitar problemas de preflight CORS con Apps Script
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
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
    
    if (!response.ok) throw new Error("Fallo en la comunicación con Drive");

    const result = await response.json();
    
    if (result.error) {
      console.error("Error de Apps Script:", result.error);
      return "";
    }

    return result.url || "";
  } catch (error) {
    console.error("Error en uploadImageToDrive:", error);
    return "";
  }
}
