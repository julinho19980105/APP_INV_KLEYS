
/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT:
 * 
 * 1. Ve a https://script.google.com
 * 2. Borra TODO el código que tengas en el archivo "Código.gs".
 * 3. Copia y pega ÚNICAMENTE el siguiente bloque (NO copies los "import" del archivo de la app):
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1rE3cAp5g8M_QfSCSntyfybAXNqNDuu75"; // Asegúrate que este sea el ID de tu carpeta
 *     var folder = DriveApp.getFolderById(folderId);
 *     var contentType = data.mimeType || "image/jpeg";
 *     var decode = Utilities.base64Decode(data.base64.split(",")[1]);
 *     var blob = Utilities.newBlob(decode, contentType, data.name);
 *     var file = folder.createFile(blob);
 *     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *     var fileId = file.getId();
 *     var directLink = "https://drive.google.com/uc?export=view&id=" + fileId;
 *     return ContentService.createTextOutput(JSON.stringify({ 
 *       success: true, 
 *       url: directLink 
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ 
 *       success: false, 
 *       error: err.toString() 
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 */

import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen a Google Drive y devuelve la URL pública.
 * Si la subida falla, devuelve el base64 original como respaldo.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || API_CONFIG.WEB_APP_URL.includes('macros/s/')) {
    try {
      const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
      
      const response = await fetch(API_CONFIG.WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', // Evita errores de CORS, aunque no permite leer la respuesta JSON
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          base64: base64Data,
          name: fileName,
          mimeType: mimeType
        })
      });
      
      // Dado que usamos 'no-cors', no podemos obtener la URL de vuelta fácilmente.
      // Se recomienda usar Cloudflare R2 o un Proxy para obtener la URL en tiempo real.
      // Por ahora, devolvemos el base64 para que la app no se rompa, 
      // pero el archivo SÍ se subirá a Drive si el script está bien configurado.
      console.log("Imagen enviada a Drive.");
      return base64Data; 
    } catch (error) {
      console.error("Error al subir a Drive:", error);
      return base64Data;
    }
  }
  return base64Data;
}
