/**
 * INSTRUCCIONES ACTUALIZADAS PARA GOOGLE APPS SCRIPT (script.google.com):
 * 
 * 1. Crea un nuevo proyecto en Apps Script.
 * 2. Pega el código que te proporcioné anteriormente.
 * 3. Asegúrate de que el folderId sea: "1eiNwGNeMfRcP7yd6-XkhLLzTCoxC4uOT"
 * 4. Despliega como "Aplicación Web".
 *    - Ejecutar como: YO (tu cuenta).
 *    - Quién tiene acceso: CUALQUIERA (Anyone).
 * 5. Copia la URL del despliegue en src/lib/api-config.ts.
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
        // Enviar todos los datos excepto stock y marcas de tiempo internas
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
