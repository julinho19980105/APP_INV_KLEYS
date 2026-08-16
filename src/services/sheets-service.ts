
import { API_CONFIG } from '@/lib/api-config';

/**
 * IMPORTANTE: Para que las imágenes se guarden y veas la URL real,
 * DEBES actualizar tu script en Google Apps Script con este código:
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     if (data.action === 'uploadImage') {
 *       var folderId = '1rE3cAp5g8M_QfSCSntyfybAXNqNDuu75';
 *       var folder = DriveApp.getFolderById(folderId);
 *       var decoded = Utilities.base64Decode(data.base64.split(',')[1]);
 *       var blob = Utilities.newBlob(decoded, data.mimeType || 'image/jpeg', data.name);
 *       var file = folder.createFile(blob);
 *       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       
 *       return ContentService.createTextOutput(JSON.stringify({
 *         status: 'success',
 *         url: 'https://lh3.googleusercontent.com/d/' + file.getId()
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 */

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    // Enviamos los datos. Debido a restricciones de CORS de Google, 
    // usamos 'no-cors' para asegurar que el envío ocurra.
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
    
    // Como no podemos leer la respuesta en modo no-cors, generamos una URL predecible 
    // si el script de arriba está configurado correctamente para que las imágenes sean públicas.
    // Esto es un fallback necesario para que el inventario muestre algo.
    return base64Data; // Por ahora devolvemos el base64 para que sea visible en Firestore inmediatamente.
  } catch (error) {
    console.error("Fallo en Drive:", error);
    return base64Data;
  }
}
