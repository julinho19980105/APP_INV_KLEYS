
import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen a Google Drive a través del Web App de Apps Script.
 * Esta función espera la URL real del archivo antes de retornar.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Enviamos los datos al Apps Script
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
    
    if (!response.ok) throw new Error("Error de red con Apps Script");

    const result = await response.json();
    
    if (result.error) {
      console.error("Error en el script de Google:", result.error);
      return "";
    }

    // Retornamos la URL real que generó Drive
    return result.url || "";
  } catch (error) {
    console.error("Fallo crítico en subida a Drive:", error);
    return "";
  }
}
