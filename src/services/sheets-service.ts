
import { API_CONFIG } from '@/lib/api-config';

// Caché global en memoria para evitar recargas lentas
let dataCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 2; // 2 minutos de caché

/**
 * Obtiene datos de una hoja con caché inteligente.
 */
export async function getSheetData(sheetName: string, forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && dataCache[sheetName] && (now - dataCache[sheetName].timestamp < CACHE_DURATION)) {
    return dataCache[sheetName].data;
  }

  if (!API_CONFIG.WEB_APP_URL) return [];
  
  try {
    const response = await fetch(`${API_CONFIG.WEB_APP_URL}?sheet=${sheetName}`, {
      method: 'GET',
    });
    
    if (!response.ok) return dataCache[sheetName]?.data || [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    
    dataCache[sheetName] = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error(`Error fetching sheet data (${sheetName}):`, error);
    return dataCache[sheetName]?.data || [];
  }
}

/**
 * Sube una imagen a Google Drive y devuelve la URL REAL.
 * Es crítico que el Apps Script esté desplegado como "Cualquier persona".
 */
export async function uploadImageToDrive(base64Data: string, fileName: string) {
  if (!API_CONFIG.WEB_APP_URL) {
    console.error("WEB_APP_URL no configurada");
    return "";
  }
  
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/jpeg';
    
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadImage',
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    if (!response.ok) {
      console.error("Respuesta de red no OK", response.status);
      return "";
    }

    const result = await response.json();
    
    if (result.error) {
      console.error("Error devuelto por Apps Script:", result.error);
      return "";
    }

    return result.url || "";
  } catch (error) {
    console.error("Error en uploadImageToDrive:", error);
    return "";
  }
}

/**
 * Agrega una nueva fila.
 */
export async function appendToSheet(sheetName: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    delete dataCache[sheetName];
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`Error appending to sheet (${sheetName}):`, error);
    throw error;
  }
}

/**
 * Actualiza una fila existente basándose en el código de producto.
 */
export async function updateSheetRow(sheetName: string, id: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    delete dataCache[sheetName];
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        sheet: sheetName,
        id: id,
        data: data
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`Error updating sheet (${sheetName}):`, error);
    throw error;
  }
}
