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
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"; 
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
 *       // 1. ACTUALIZAR JSON (Para Apps)
 *       var jsonFiles = folder.getFilesByName("catalog.json");
 *       if (jsonFiles.hasNext()) {
 *         jsonFiles.next().setContent(JSON.stringify(data.catalog));
 *       } else {
 *         folder.createFile("catalog.json", JSON.stringify(data.catalog), MimeType.PLAIN_TEXT)
 *               .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       }
 *
 *       // 2. ACTUALIZAR GOOGLE SHEET (Para Humanos)
 *       var ssFiles = folder.getFilesByName("Inventario_Diva_Industrial");
 *       var ss;
 *       if (ssFiles.hasNext()) {
 *         ss = SpreadsheetApp.open(ssFiles.next());
 *       } else {
 *         ss = SpreadsheetApp.create("Inventario_Diva_Industrial");
 *         var ssFile = DriveApp.getFileById(ss.getId());
 *         folder.addFile(ssFile);
 *         DriveApp.getRootFolder().removeFile(ssFile);
 *       }
 *       var sheet = ss.getSheets()[0];
 *       sheet.clear();
 *       
 *       var headers = ["CÓDIGO", "NOMBRE", "CATEGORÍA", "COLECCIÓN", "P. FARDO", "P. MAYOR", "P. UNIDAD", "IMÁGENES (LINKS)", "DESCRIPCIÓN"];
 *       sheet.appendRow(headers);
 *       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3").setHorizontalAlignment("center");
 *
 *       data.catalog.forEach(function(p) {
 *         sheet.appendRow([
 *           p.code, 
 *           p.name, 
 *           p.category, 
 *           p.collection, 
 *           p.priceFardo, 
 *           p.priceMayor, 
 *           p.priceUnidad, 
 *           (p.images || []).join("\n"), 
 *           p.description
 *         ]);
 *       });
 *       sheet.setColumnWidth(8, 400); // Columna de imágenes más ancha
 *       sheet.setColumnWidth(9, 300); // Columna de descripción
 *
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
    // Filtrar solo productos con stock > 0 para el catálogo comercial y la hoja de cálculo
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
