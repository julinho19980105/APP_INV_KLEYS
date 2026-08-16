
import { API_CONFIG } from '@/lib/api-config';

/**
 * SERVICIO OPTIMIZADO PARA DRIVE
 * 
 * INSTRUCCIONES PARA EL SCRIPT DE GOOGLE (Apps Script):
 * 1. Copia este código en tu archivo .gs
 * 2. Cambia FOLDER_ID por '1rE3cAp5g8M_QfSCSntyfybAXNqNDuu75'
 * 3. Publica como "Web App" -> "Cualquier persona" (Anyone)
 * 
 * function doPost(e) {
 *   var data = JSON.parse(e.postData.contents);
 *   var folder = DriveApp.getFolderById("1rE3cAp5g8M_QfSCSntyfybAXNqNDuu75");
 *   var blob = Utilities.newBlob(Utilities.base64Decode(data.base64.split(",")[1]), data.mimeType, data.name);
 *   var file = folder.createFile(blob);
 *   file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *   return ContentService.createTextOutput(JSON.stringify({url: file.getUrl()})).setMimeType(ContentService.MimeType.JSON);
 * }
 */

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) return "";
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', // Modo silencioso para evitar errores de red bloqueantes
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'uploadImage',
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    // Como usamos no-cors no podemos leer la URL real, devolvemos un ID temporal
    // o el enlace a la carpeta para no romper el inventario.
    return `https://drive.google.com/drive/folders/${API_CONFIG.DRIVE_FOLDER_ID}`;
  } catch (error) {
    console.error("Fallo subida:", error);
    return "";
  }
}
