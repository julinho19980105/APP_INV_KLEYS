
import { API_CONFIG } from '@/lib/api-config';

/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT (Copiar y pegar en script.google.com):
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folder = DriveApp.getFolderById("1rE3cAp5g8M_QfSCSntyfybAXNqNDuu75"); // REEMPLAZAR CON TU ID DE CARPETA
 *     var contentType = data.mimeType || "image/jpeg";
 *     var decode = Utilities.base64Decode(data.base64.split(",")[1]);
 *     var blob = Utilities.newBlob(decode, contentType, data.name);
 *     var file = folder.createFile(blob);
 *     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *     
 *     // Generar link directo de visualización
 *     var fileId = file.getId();
 *     var directLink = "https://drive.google.com/uc?export=view&id=" + fileId;
 *     
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
  if (!API_CONFIG.WEB_APP_URL) {
    console.warn("URL de Web App no configurada en api-config.ts");
    return base64Data; // Fallback a base64 si no hay URL
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    const result = await response.json();
    if (result.success) {
      return result.url;
    } else {
      console.error("Error en Apps Script:", result.error);
      return base64Data;
    }
  } catch (error) {
    console.error("Error de conexión con Drive:", error);
    return base64Data;
  }
}
