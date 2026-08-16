
import { API_CONFIG } from '@/lib/api-config';

/**
 * Obtiene datos de una hoja específica del Google Sheet.
 */
export async function getSheetData(sheetName: string) {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(`${API_CONFIG.WEB_APP_URL}?sheet=${sheetName}`);
    if (!response.ok) throw new Error('Error en la respuesta del servidor');
    return await response.json();
  } catch (error) {
    console.error(`Error fetching sheet data (${sheetName}):`, error);
    return [];
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
