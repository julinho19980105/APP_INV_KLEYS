/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Crea un nuevo proyecto en Google Apps Script.
 * 2. Pega este código y reemplaza "TU_ID_DE_CARPETA" con el ID de tu carpeta de Drive.
 * 3. Despliega como "Aplicación Web" (Configurar: Ejecutar como: Yo, Acceso: Cualquiera).
 * 4. Copia la URL del despliegue en src/lib/api-config.ts.
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"; // Asegúrate que este sea tu ID
 *     var folder = DriveApp.getFolderById(folderId);
 *     
 *     if (data.action === "uploadImage") {
 *       var contentType = data.mimeType || "image/jpeg";
 *       var base64 = data.base64.split(",")[1];
 *       var decode = Utilities.base64Decode(base64);
 *       var blob = Utilities.newBlob(decode, contentType, data.name);
 *       var file = folder.createFile(blob);
 *       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       return ContentService.createTextOutput(JSON.stringify({ 
 *         success: true, 
 *         url: "https://drive.google.com/uc?export=view&id=" + file.getId() 
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *
 *     if (data.action === "updateCatalog") {
 *       var files = folder.getFilesByName("catalog.json");
 *       var file;
 *       if (files.hasNext()) {
 *         file = files.next();
 *         file.setContent(JSON.stringify(data.catalog));
 *       } else {
 *         file = folder.createFile("catalog.json", JSON.stringify(data.catalog), MimeType.PLAIN_TEXT);
 *       }
 *       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       return ContentService.createTextOutput(JSON.stringify({ success: true }))
 *         .setMimeType(ContentService.MimeType.JSON);
 *     }
 *
 *     if (data.action === "getCatalog") {
 *       var files = folder.getFilesByName("catalog.json");
 *       if (files.hasNext()) {
 *         var content = files.next().getBlob().getDataAsString();
 *         return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
 *       }
 *       return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
 *     }
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 */

import { API_CONFIG } from '@/lib/api-config';

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL) return base64Data;
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "uploadImage",
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    const result = await response.json();
    return result.success ? result.url : base64Data;
  } catch (error) {
    console.error("Error al subir a Drive:", error);
    return base64Data;
  }
}

export async function syncCatalogToDrive(products: any[]): Promise<void> {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    // Solo productos con stock y sin el campo stock para el catálogo comercial
    const cleanCatalog = products
      .filter(p => p.stock > 0)
      .map(({ stock, updatedAt, ...rest }) => rest);

    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "updateCatalog",
        catalog: cleanCatalog
      })
    });
    const result = await response.json();
    if (!result.success) console.error("Error Apps Script:", result.error);
  } catch (error) {
    console.error("Error al sincronizar catálogo con Drive:", error);
  }
}

export async function getCatalogFromDrive(): Promise<any[]> {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "getCatalog" })
    });
    return await response.json();
  } catch (error) {
    console.error("Error al obtener catálogo desde Drive:", error);
    return [];
  }
}
