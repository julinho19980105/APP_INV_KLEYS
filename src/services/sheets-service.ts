/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Crea un nuevo proyecto en Google Apps Script.
 * 2. Pega este código y reemplaza "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT" con el ID de tu carpeta de Drive.
 * 3. Despliega como "Aplicación Web" (Configurar: Ejecutar como: Yo, Acceso: Cualquiera).
 * 4. Copia la URL del despliegue en src/lib/api-config.ts.
 * 
 * function doPost(e) {
 *   try {
 *     if (!e || !e.postData || !e.postData.contents) {
 *        throw new Error("No se recibieron datos en la petición");
 *     }
 *     var data = JSON.parse(e.postData.contents);
 *     var folderId = "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"; 
 *     var folder = DriveApp.getFolderById(folderId);
 *     
 *     if (data.action === "uploadImage") {
 *       if (!data.base64) throw new Error("Base64 no recibido");
 *       var base64Content = data.base64;
 *       if (base64Content.indexOf(",") > -1) {
 *         base64Content = base64Content.split(",")[1];
 *       }
 *       var decode = Utilities.base64Decode(base64Content);
 *       var blob = Utilities.newBlob(decode, data.mimeType || "image/jpeg", data.name || "prenda_" + Date.now());
 *       var file = folder.createFile(blob);
 *       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       return ContentService.createTextOutput(JSON.stringify({ 
 *         success: true, 
 *         url: "https://drive.google.com/uc?export=view&id=" + file.getId() 
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *
 *     if (data.action === "updateCatalog") {
 *       // 1. ACTUALIZAR JSON (Para Aplicaciones Externas)
 *       var jsonFiles = folder.getFilesByName("catalog.json");
 *       if (jsonFiles.hasNext()) {
 *         jsonFiles.next().setContent(JSON.stringify(data.catalog));
 *       } else {
 *         folder.createFile("catalog.json", JSON.stringify(data.catalog), MimeType.PLAIN_TEXT)
 *               .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *       }
 *
 *       // 2. ACTUALIZAR GOOGLE SHEET (Inventario Maestro Activo)
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
 *       var headers = ["CÓDIGO", "NOMBRE", "CATEGORÍA", "COLECCIÓN", "P. FARDO", "P. MAYOR", "P. UNIDAD", "IMÁGENES", "DESCRIPCIÓN"];
 *       sheet.appendRow(headers);
 *       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#000000").setFontColor("#FFFFFF").setHorizontalAlignment("center");
 *
 *       if (data.catalog && Array.isArray(data.catalog)) {
 *         data.catalog.forEach(function(p) {
 *           sheet.appendRow([
 *             p.code || "", 
 *             p.name || "", 
 *             p.category || "", 
 *             p.collection || "", 
 *             p.priceFardo || 0, 
 *             p.priceMayor || 0, 
 *             p.priceUnidad || 0, 
 *             (p.images || []).join("\n"), 
 *             p.description || ""
 *           ]);
 *         });
 *       }
 *       sheet.setColumnWidth(8, 400); 
 *       sheet.setColumnWidth(9, 300);
 *       sheet.setFrozenRows(1);
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
 *     
 *     return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Acción no reconocida" }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
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
    // Filtrar solo productos con stock > 0 y limpiar campos para el Sheet (sin stock ni metadatos internos)
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
      throw new Error(result.error || "Error desconocido en Apps Script");
    }
  } catch (error) {
    console.error("Error al sincronizar catálogo con Drive:", error);
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
    console.error("Error al obtener catálogo desde Drive:", error);
    return [];
  }
}