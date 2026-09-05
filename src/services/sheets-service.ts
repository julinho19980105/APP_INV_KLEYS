
'use client';

import { API_CONFIG } from '@/lib/api-config';

/**
 * @fileOverview Servicio unificado para Google Drive y Sheets utilizando el script proporcionado.
 */

export async function uploadImageToDrive(base64Data: string, fileName: string): Promise<string> {
  if (!API_CONFIG.WEB_APP_URL || !base64Data || base64Data.startsWith('http')) return base64Data;
  
  try {
    let mimeType = 'image/jpeg';
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/data:([^;]+);/);
      if (match) mimeType = match[1];
    }

    // Limpiar Base64 para Utilities.base64Decode de Google Apps Script
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    console.log("Enviando imagen a Google Drive...");
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
    console.log("Respuesta cruda de Google (Imagen):", responseText);

    const result = JSON.parse(responseText);
    if (result.success && result.url) {
      return result.url;
    }
    
    throw new Error(result.error || "Google Apps Script devolvió éxito pero sin URL válida.");
  } catch (error: any) {
    console.error("Error crítico en uploadImageToDrive:", error);
    throw error;
  }
}

export async function syncCatalogToDrive(products: any[]): Promise<void> {
  if (!API_CONFIG.WEB_APP_URL || !Array.isArray(products)) return;
  
  try {
    // Filtramos para no enviar Base64 al Sheet
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
        stock: p.stock,
        priceFardo: p.priceFardo,
        priceMayor: p.priceMayor,
        priceUnidad: p.priceUnidad,
        images: imgs,
        description: p.description
      };
    });

    console.log("Sincronizando catálogo con Google Sheets...");
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
    console.error("Error al sincronizar catálogo:", error);
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
