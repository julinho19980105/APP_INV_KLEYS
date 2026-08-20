
import { API_CONFIG } from '@/lib/api-config';

/**
 * Sube una imagen al Drive usando el script original de imágenes.
 */
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
    console.error("Error al subir imagen:", error);
    return base64Data;
  }
}

/**
 * Sincroniza el catálogo con el NUEVO Sheet de Inventario y actualiza el JSON.
 * Los datos se envían filtrados (solo stock > 0) y sin columna de cantidad.
 * El script del Sheet distribuye las fotos en 4 columnas independientes.
 */
export async function syncCatalogToDrive(products: any[]): Promise<void> {
  if (!API_CONFIG.INVENTORY_SHEET_URL || !Array.isArray(products)) return;
  
  try {
    const cleanCatalog = products
      .filter(p => (Number(p.stock) || 0) > 0)
      .map(p => {
        // Enviamos el objeto completo, el script se encarga de mapear las 4 fotos
        const { updatedAt, id, ...rest } = p;
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
    console.error("Error al sincronizar inventario:", error);
    throw error;
  }
}

/**
 * Obtiene el catálogo desde el script del Sheet de Inventario (que lee el JSON).
 */
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
