
import { API_CONFIG } from '@/lib/api-config';

export async function getSheetData(sheetName: string) {
  if (!API_CONFIG.WEB_APP_URL) return [];
  try {
    const response = await fetch(`${API_CONFIG.WEB_APP_URL}?sheet=${sheetName}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

export async function appendToSheet(sheetName: string, data: any[]) {
  if (!API_CONFIG.WEB_APP_URL) return;
  try {
    await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'append',
        sheet: sheetName,
        data: data
      })
    });
  } catch (error) {
    console.error('Error appending to sheet:', error);
  }
}
