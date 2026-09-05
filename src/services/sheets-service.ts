'use client';

import { API_CONFIG } from '@/lib/api-config';

/**
 * @fileOverview Servicio unificado para Google Drive y Sheets utilizando el script proporcionado.
 * Mapeo industrial: STOCK se envía para ser ubicado en la Columna M (13).
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

    const responseText = await response.text();
    const result = JSON.parse(responseText);
    if (result.success && result.url) {
      return result.url;
    }
    
    throw new Error(result.error || "Error en Drive");
  } catch (error: any) {
    throw error;
  }
}

export async function syncCatalogToDrive(products: any[]): Promise<void> {
  if (!API_CONFIG.WEB_APP_URL || !Array.isArray(products)) return;
  
  try {
    const cleanCatalog = products.map(p => {
      const imgs = (p.images || []).map((img: string) => {
        const s = String(img || "");
        return (s.startsWith('data:') || s.startsWith('blob:')) ? "" : s;
      });
      return {
        code: p.code,
        name: p.name,
        category: p.category,
        collection: p.collection,
        stock: Number(p.stock || 0), // Dato maestro de inventario
        priceFardo: p.priceFardo,
        priceMayor: p.priceMayor,
        priceUnidad: p.priceUnidad,
        images: imgs,
        description: p.description
      };
    });

    const response = await fetch(API_CONFIG.WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "updateCatalog",
        catalog: cleanCatalog
      })
    });
    
    const responseText = await response.text();
    const result = JSON.parse(responseText);
    if (!result.success) {
      throw new Error(result.error || "Error en el script del Sheet");
    }
  } catch (error) {
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
    return [];
  }
}
