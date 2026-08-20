/**
 * INSTRUCCIONES ACTUALIZADAS PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Crea un nuevo proyecto en Apps Script.
 * 2. Pega este código y reemplaza el ID de la carpeta por el tuyo.
 * 3. Despliega como "Aplicación Web".
 *    - Ejecutar como: YO (tu cuenta).
 *    - Quién tiene acceso: CUALQUIERA (Anyone).
 * 
 * function doPost(e) {
 *   var result = { success: false };
 *   try {
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"; // <-- CAMBIA ESTO POR TU ID DE CARPETA
 *     var folder = DriveApp.getFolderById(folderId);
 *     
 *     if (data.action === "uploadImage") {
 *       var base64Content = data.base64;
 *       if (base64Content && base64Content.indexOf(",") > -1) {
 *         base64Content = base64Content.split(",")[1];
 *       }
 *       var decode = Utilities.base64Decode(base64Content);
 *       var blob = Utilities.newBlob(decode, data.mimeType || "image/jpeg", data.name || "img_" + Date.now());
 *       var file = folder.createFile(blob);
 *       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       result = { success: true, url: "https://drive.google.com/uc?export=view&id=" + file.getId() };
 *     }
 *
 *     if (data.action === "updateCatalog") {
 *       // 1. JSON
 *       var jsonName = "catalog.json";
 *       var jsonFiles = folder.getFilesByName(jsonName);
 *       if (jsonFiles.hasNext()) { jsonFiles.next().setContent(JSON.stringify(data.catalog)); }
 *       else { folder.createFile(jsonName, JSON.stringify(data.catalog), MimeType.PLAIN_TEXT).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
 *
 *       // 2. GOOGLE SHEET
 *       var ssName = "Inventario_Diva_Industrial";
 *       var ssFiles = folder.getFilesByName(ssName);
 *       var ss;
 *       if (ssFiles.hasNext()) { ss = SpreadsheetApp.open(ssFiles.next()); }
 *       else { 
 *         ss = SpreadsheetApp.create(ssName);
 *         var ssFile = DriveApp.getFileById(ss.getId());
 *         folder.addFile(ssFile);
 *         DriveApp.getRootFolder().removeFile(ssFile);
 *       }
 *       var sheet = ss.getSheets()[0];
 *       sheet.clear();
 *       var headers = ["CÓDIGO", "NOMBRE", "CATEGORÍA", "COLECCIÓN", "P. FARDO", "P. MAYOR", "P. UNIDAD", "IMÁGENES", "DESCRIPCIÓN"];
 *       sheet.appendRow(headers);
 *       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#000000").setFontColor("#FFFFFF").setHorizontalAlignment("center");
 *
 *       if (data.catalog && Array.isArray(data.catalog)) {
 *         data.catalog.forEach(function(p) {
 *           sheet.appendRow([
 *             p.code || "", p.name || "", p.category || "", p.collection || "", 
 *             p.priceFardo || 0, p.priceMayor || 0, p.priceUnidad || 0, 
 *             (p.images || []).join("\n"), p.description || ""
 *           ]);
 *         });
 *       }
 *       sheet.setColumnWidth(8, 400); 
 *       sheet.setColumnWidth(9, 300);
 *       sheet.setFrozenRows(1);
 *       result = { success: true };
 *     }
 *
 *     if (data.action === "getCatalog") {
 *       var files = folder.getFilesByName("catalog.json");
 *       var content = files.hasNext() ? files.next().getBlob().getDataAsString() : "[]";
 *       return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
 *     }
 *     
 *   } catch (err) {
 *     result = { success: false, error: err.toString() };
 *   }
 *   return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
 * }
 */

import { API_CONFIG } from '@/lib/api-config';

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || !base64Data || base64Data.startsWith('http')) return base64Data;
  
  try {
    let mimeType = 'image/jpeg';
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);/);
      if (match) mimeType = match[1];
    }

    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
  if (!API_CONFIG.WEB_APP_URL || !Array.isArray(products)) return;
  
  try {
    const cleanCatalog = products
      .filter(p => (Number(p.stock) || 0) > 0)
      .map(p => {
        const { stock, updatedAt, id, ...rest } = p;
        return rest;
      });

    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "updateCatalog",
        catalog: cleanCatalog
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error("Error Apps Script:", result.error);
      throw new Error(result.error || "Error en Drive");
    }
  } catch (error) {
    console.error("Error al sincronizar con Drive:", error);
    throw error;
  }
}

export async function getCatalogFromDrive(): Promise<any[]> {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
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