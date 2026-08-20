
/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Pega este código en Código.gs:
 * 
 * function doPost(e) {
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT";
 *     var folder = DriveApp.getFolderById(folderId);
 *     
 *     // ACCIÓN: SUBIR IMAGEN
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
 *     // ACCIÓN: ACTUALIZAR CATALOGO JSON
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
 *     // ACCIÓN: OBTENER CATALOGO JSON
 *     if (data.action === "getCatalog") {
 *       var files = folder.getFilesByName("catalog.json");
 *       if (files.hasNext()) {
 *         var content = files.next().getBlob().getDataAsString();
 *         return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
 *       }
 *       return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
 *     }
 *
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ 
 *       success: false, 
 *       error: err.toString() 
 *     })).setMimeType(ContentService.MimeType.JSON);
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
    // Filtrar solo productos con stock y eliminar el campo stock del JSON
    const cleanCatalog = products
      .filter(p => p.stock > 0)
      .map(({ stock, updatedAt, ...rest }) => rest);

    await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "updateCatalog",
        catalog: cleanCatalog
      })
    });
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
