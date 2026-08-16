import { API_CONFIG } from '@/lib/api-config';

/**
 * Obtiene datos de una hoja específica del Google Sheet.
 */
export async function getSheetData(sheetName: string) {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(`${API_CONFIG.WEB_APP_URL}?sheet=${sheetName}`);
    if (!response.ok) throw new Error('Error en la respuesta del servidor');
    
    const data = await response.json();
    
    if (data && typeof data === 'object' && data.error) {
      console.warn(`Aviso de Google Sheets (${sheetName}):`, data.error);
      return [];
    }
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching sheet data (${sheetName}):`, error);
    return [];
  }
}

/**
 * Sube una imagen a Google Drive a través del Apps Script y devuelve la URL.
 */
export async function uploadImageToDrive(base64Data: string, fileName: string) {
  if (!API_CONFIG.WEB_APP_URL) return "";
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1];
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadImage',
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    if (!response.ok) throw new Error('Error al subir imagen a Drive');
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.url;
  } catch (error) {
    console.error("Error en uploadImageToDrive:", error);
    throw error;
  }
}

/**
 * Agrega una nueva fila a una hoja específica del Google Sheet.
 */
export async function appendToSheet(sheetName: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
    if (!response.ok) throw new Error('Error al guardar en el servidor');
    return await response.json();
  } catch (error) {
    console.error(`Error appending to sheet (${sheetName}):`, error);
    throw error;
  }
}

/**
 * Actualiza una fila existente basada en el Código.
 */
export async function updateSheetRow(sheetName: string, id: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        sheet: sheetName,
        id: id,
        data: data
      })
    });
    if (!response.ok) throw new Error('Error al actualizar en el servidor');
    return await response.json();
  } catch (error) {
    console.error(`Error updating sheet (${sheetName}):`, error);
    throw error;
  }
}
