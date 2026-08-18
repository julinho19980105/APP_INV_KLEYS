/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Pega ÚNICAMENTE la función doPost(e) que aparece abajo.
 * 2. Asegúrate de que el ID de la carpeta sea: 1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT";
 *     var folder = DriveApp.getFolderById(folderId);
 *     var contentType = data.mimeType || "image/jpeg";
 *     var base64 = data.base64.split(",")[1];
 *     var decode = Utilities.base64Decode(base64);
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
 * Sube una imagen a Google Drive y devuelve la URL pública real en calidad original.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || API_CONFIG.WEB_APP_URL === '') {
    console.warn("URL de Google Script no configurada.");
    return base64Data;
  }

  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Petición al script de Google sin 'no-cors' para poder leer el JSON de respuesta
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    if (!response.ok) {
      throw new Error("No se pudo conectar con el servidor de imágenes.");
    }

    const result = await response.json();
    
    if (result.success && result.url) {
      return result.url;
    } else {
      throw new Error(result.error || "Error al subir a Drive.");
    }
  } catch (error) {
    console.error("Error al subir a Drive:", error);
    // Si falla el script, devolvemos el base64 para no perder la imagen (aunque pesará en Firestore)
    return base64Data;
  }
}
