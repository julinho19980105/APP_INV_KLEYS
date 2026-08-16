import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen a Google Drive a través del Web App de Apps Script.
 * Optimizada con modo 'no-cors' para evitar bloqueos del navegador al enviar el base64.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada en api-config.ts");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Usamos text/plain y no-cors para saltar las restricciones de seguridad de Google Scripts
    // Esto enviará los datos correctamente aunque no podamos leer la respuesta del servidor.
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
    
    // Esperamos un tiempo prudencial para asegurar que el script se ejecute
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Retornamos el link de la carpeta de Drive como referencia ya que no podemos leer el ID con no-cors
    // El usuario verá este link en Firestore. Para ver la foto real debe entrar a su Drive.
    return `https://drive.google.com/drive/folders/${API_CONFIG.DRIVE_FOLDER_ID}?sort=14&view=2`;
  } catch (error) {
    console.error("Fallo crítico en la comunicación con Drive:", error);
    return "";
  }
}
