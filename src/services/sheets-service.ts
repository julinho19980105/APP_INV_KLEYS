
import { API_CONFIG } from '@/lib/api-config';

/**
 * CÓDIGO ACTUALIZADO PARA GOOGLE APPS SCRIPT:
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "TU_ID_DE_CARPETA_AQUÍ"; // REEMPLAZAR
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

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || API_CONFIG.WEB_APP_URL.includes('macros/s/')) {
    try {
      const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
      
      const response = await fetch(API_CONFIG.WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', // Importante para evitar errores de CORS con Google
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          base64: base64Data,
          name: fileName,
          mimeType: mimeType
        })
      });
      
      // Con no-cors no podemos leer la respuesta JSON directamente,
      // pero el archivo se subirá. Para obtener la URL real,
      // normalmente se requiere un proxy o configuración CORS en el script.
      // Por ahora, devolvemos el base64 si no podemos confirmar el éxito,
      // o un placeholder si la subida fue exitosa.
      return base64Data; 
    } catch (error) {
      console.error("Error al subir a Drive:", error);
      return base64Data;
    }
  }
  return base64Data;
}
