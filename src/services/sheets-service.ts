import { API_CONFIG } from '@/lib/api-config';

/**
 * @fileOverview Servicio de sincronización con Google Drive y Sheets (Versión Industrial 4 Columnas).
 * 
 * INSTRUCCIONES PARA TU GOOGLE SHEET (Copia este código en el Apps Script del Sheet):
 * 
 * function doPost(e) {
 *   var result = { success: false };
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var ss = SpreadsheetApp.getActiveSpreadsheet();
 *     var sheet = ss.getSheets()[0];
 *     
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"; 
 *     var folder = DriveApp.getFolderById(folderId);
 * 
 *     if (data.action === "updateCatalog") {
 *       sheet.clear();
 *       var headers = ["CÓDIGO", "NOMBRE", "CATEGORÍA", "COLECCIÓN", "P. FARDO", "P. MAYOR", "P. UNIDAD", "FOTO 1", "FOTO 2", "FOTO 3", "FOTO 4", "DESCRIPCIÓN"];
 *       sheet.appendRow(headers);
 *       
 *       var headerRange = sheet.getRange(1, 1, 1, headers.length);
 *       headerRange.setFontWeight("bold").setBackground("#000000").setFontColor("#FFFFFF").setHorizontalAlignment("center");
 * 
 *       if (data.catalog && Array.isArray(data.catalog)) {
 *         var rows = data.catalog.map(function(p) {
 *           var imgs = p.images || [];
 *           return [
 *             p.code || "", 
 *             p.name || "", 
 *             p.category || "", 
 *             p.collection || "", 
 *             p.priceFardo || 0, 
 *             p.priceMayor || 0, 
 *             p.priceUnidad || 0, 
 *             imgs[0] || "", 
 *             imgs[1] || "", 
 *             imgs[2] || "", 
 *             imgs[3] || "", 
 *             p.description || ""
 *           ];
 *         });
 *         if (rows.length > 0) {
 *           sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
 *         }
 *       }
 *       sheet.setFrozenRows(1);
 *       for (var i = 8; i <= 11; i++) { sheet.setColumnWidth(i, 250); }
 *       sheet.setColumnWidth(12, 350);
 *       
 *       var jsonName = "catalog.json";
 *       var files = folder.getFilesByName(jsonName);
 *       if (files.hasNext()) {
 *         files.next().setContent(JSON.stringify(data.catalog));
 *       } else {
 *         folder.createFile(jsonName, JSON.stringify(data.catalog), MimeType.PLAIN_TEXT)
 *               .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       }
 *       result = { success: true };
 *     }
 * 
 *     if (data.action === "getCatalog") {
 *       var files = folder.getFilesByName("catalog.json");
 *       var content = files.hasNext() ? files.next().getBlob().getDataAsString() : "[]";
 *       return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   } catch (err) {
 *     result = { success: false, error: err.toString() };
 *   }
 *   return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
 * }
 */

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || !base64Data || base64Data.startsWith('http')) return base64Data;
  
  try {
    let mimeType = 'image/jpeg';
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);/);
      if (match) mimeType = match[1];
    }

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "uploadImage",
        base64: cleanBase64,
        name: fileName,
        mimeType: mimeType
      })
    });
    const result = await response.json();
    return result.success ? result.url : base64Data;
  } catch (error) {
    console.error("Error al subir imagen:", error);
    return base64Data;
  }
}

export async function syncCatalogToDrive(products: any[]): Promise<void> {
  if (!API_CONFIG.INVENTORY_SHEET_URL || !Array.isArray(products)) return;
  
  try {
    const cleanCatalog = products
      .filter(p => (Number(p.stock) || 0) > 0)
      .map(p => {
        const { updatedAt, id, stock, ...rest } = p;
        return rest;
      });

    const response = await fetch(API_CONFIG.INVENTORY_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "updateCatalog",
        catalog: cleanCatalog
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Error en el script del Sheet");
    }
  } catch (error) {
    console.error("Error al sincronizar catálogo con Drive:", error);
    throw error;
  }
}

export async function getCatalogFromDrive(): Promise<any[]> {
  if (!API_CONFIG.INVENTORY_SHEET_URL) return [];
  try {
    const response = await fetch(API_CONFIG.INVENTORY_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: "getCatalog" })
    });
    const result = await response.json();
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error al obtener catálogo:", error);
    return [];
  }
}
