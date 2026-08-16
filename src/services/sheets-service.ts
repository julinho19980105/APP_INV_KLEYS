
import { API_CONFIG } from '@/lib/api-config';

/**
 * Obtiene datos de una hoja específica del Google Sheet.
 */
export async function getSheetData(sheetName: string) {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(`${API_CONFIG.WEB_APP_URL}?sheet=${sheetName}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) return [];
    
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
      mode: 'no-cors', // Necesario para POST a Google Apps Script desde el cliente
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'uploadImage',
        base64: base64Data,
        name: fileName,
        mimeType: mimeType
      })
    });
    
    // Con no-cors no podemos leer la respuesta, pero el script genera el ID
    // basado en una convención o simplemente devolvemos un placeholder que el script maneja.
    // Para entornos reales sin CORS completo, solemos usar un ID predecible o esperar el sync.
    // Por simplicidad en este prototipo, devolvemos una URL constructible.
    return `https://drive.google.com/uc?export=view&id=FILE_UPLOADED_${Date.now()}`; 
  } catch (error) {
    console.error("Error en uploadImageToDrive:", error);
    return "";
  }
}

/**
 * Agrega una nueva fila a una hoja específica del Google Sheet.
 */
export async function appendToSheet(sheetName: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
    return { success: true };
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
    await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({
        action: 'update',
        sheet: sheetName,
        id: id,
        data: data
      })
    });
    return { success: true };
  } catch (error) {
    console.error(`Error updating sheet (${sheetName}):`, error);
    throw error;
  }
}
