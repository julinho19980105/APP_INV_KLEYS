
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, History, Edit3, AlertCircle, Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateProductDescription } from "@/ai/flows/generate-product-description"
import { appendToSheet, getSheetData, uploadImageToDrive, updateSheetRow } from "@/services/sheets-service"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function RegistryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('edit')
  
  const { toast } = useToast()
  const [loadingAI, setLoadingAI] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const [categories, setCategories] = React.useState(["Sacos", "Pantalones", "Vestidos", "Blusas"])
  const [collections, setCollections] = React.useState(["Invierno 2024", "Verano 2025"])
  
  const [newCat, setNewCat] = React.useState("")
  const [newColl, setNewColl] = React.useState("")

  const [form, setForm] = React.useState({
    name: "",
    code: "P-001",
    category: "",
    collection: "",
    description: "",
    quantity: "",
    priceFardo: "",
    priceMayor: "",
    priceUnidad: "",
  })

  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [priceError, setPriceError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchDBData = async () => {
      const data = await getSheetData('PRODUCTOS');
      if (data && data.length > 0) {
        const dbCats = Array.from(new Set(data.map((p: any) => p.Categoria).filter(Boolean)));
        const dbColls = Array.from(new Set(data.map((p: any) => p.Coleccion).filter(Boolean)));
        if (dbCats.length > 0) setCategories(prev => Array.from(new Set([...prev, ...dbCats as string[]])));
        if (dbColls.length > 0) setCollections(prev => Array.from(new Set([...prev, ...dbColls as string[]])));

        if (editId) {
          const product = data.find((p: any) => p.Codigo === editId);
          if (product) {
            setForm({
              name: product.Nombre || "",
              code: product.Codigo || "",
              category: product.Categoria || "",
              collection: product.Coleccion || "",
              description: product.Descripcion || "",
              quantity: product.Stock ? String(product.Stock) : "",
              priceFardo: product.PrecioFardo ? String(product.PrecioFardo) : "",
              priceMayor: product.PrecioMayor ? String(product.PrecioMayor) : "",
              priceUnidad: product.PrecioUnidad ? String(product.PrecioUnidad) : "",
            });
            const imgs = [product.Imagen1, product.Imagen2, product.Imagen3, product.Imagen4].filter(Boolean);
            setLocalImagePreviews(imgs);
          }
        } else {
          const lastRow = data[data.length - 1];
          const lastCode = lastRow?.Codigo;
          if (lastCode && lastCode.startsWith('P-')) {
            const num = parseInt(lastCode.split('-')[1]);
            if (!isNaN(num)) {
              setForm(prev => ({ ...prev, code: `P-${String(num + 1).padStart(3, '0')}` }));
            }
          }
        }
      }
    };
    fetchDBData();
  }, [editId]);

  React.useEffect(() => {
    const f = Number(form.priceFardo || 0);
    const m = Number(form.priceMayor || 0);
    const u = Number(form.priceUnidad || 0);

    if (f > 0 && m > 0 && f >= m) {
      setPriceError("El precio Fardo debe ser menor al Mayor");
    } else if (m > 0 && u > 0 && m >= u) {
      setPriceError("El precio Mayor debe ser menor al de Unidad");
    } else {
      setPriceError(null);
    }
  }, [form.priceFardo, form.priceMayor, form.priceUnidad]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "Archivo muy pesado", description: "La imagen debe pesar menos de 3MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalImagePreviews(prev => [...prev, reader.result as string].slice(0, 4));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAI = async () => {
    if (!form.name || !form.category) {
      toast({ title: "Atención", description: "Nombre y categoría son necesarios para la IA.", variant: "destructive" })
      return
    }
    setLoadingAI(true)
    try {
      const res = await generateProductDescription({ 
        productName: form.name, 
        category: form.category,
        existingDescription: form.description 
      })
      setForm(prev => ({ ...prev, description: res.description }))
    } catch (e) {
      toast({ title: "Error", description: "No se pudo generar la descripción." })
    } finally {
      setLoadingAI(false)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.category || !form.collection || !form.quantity) {
      toast({ title: "Campos Incompletos", description: "Nombre, Categoría, Colección y Cantidad son obligatorios.", variant: "destructive" })
      return
    }

    if (priceError) {
      toast({ title: "Error de Precios", description: priceError, variant: "destructive" });
      return;
    }

    setSaving(true)
    try {
      const timestamp = new Date().toISOString();
      const driveImageUrls: string[] = [];
      
      for (let i = 0; i < localImagePreviews.length; i++) {
        const item = localImagePreviews[i];
        if (item.startsWith('data:image')) {
          const url = await uploadImageToDrive(item, `${form.code}_img_${Date.now()}_${i+1}.jpg`);
          driveImageUrls.push(url);
        } else {
          driveImageUrls.push(item);
        }
      }

      const img1 = driveImageUrls[0] || "";
      const img2 = driveImageUrls[1] || "";
      const img3 = driveImageUrls[2] || "";
      const img4 = driveImageUrls[3] || "";

      const productRow = [
        timestamp,
        form.code,
        form.name,
        form.category,
        form.collection,
        form.quantity,
        form.priceFardo,
        form.priceMayor,
        form.priceUnidad,
        img1,
        img2,
        img3,
        img4,
        form.description
      ];

      const catalogRow = [
        form.code,
        form.name,
        form.category,
        form.priceFardo,
        form.priceMayor,
        form.priceUnidad,
        img1,
        img2,
        img3,
        img4,
        form.collection,
        form.description
      ];

      if (editId) {
        await updateSheetRow('PRODUCTOS', form.code, productRow);
        await updateSheetRow('CATALOGO_WEB', form.code, catalogRow);
        toast({ title: "¡Actualizado!", description: `Prenda ${form.code} modificada con éxito.` })
        router.push('/inventory')
      } else {
        await appendToSheet('PRODUCTOS', productRow);
        await appendToSheet('CATALOGO_WEB', catalogRow);
        await appendToSheet('MOVIMIENTOS', [
          Math.random().toString(36).substr(2, 9),
          timestamp,
          form.code,
          'in',
          form.quantity,
          'Registro inicial de prenda'
        ]);

        toast({ title: "¡Guardado!", description: `Prenda ${form.code} registrada correctamente.` })
        
        const nextNum = parseInt(form.code.split('-')[1]) + 1;
        setForm({
          name: "",
          category: form.category,
          collection: form.collection,
          description: "",
          quantity: "",
          priceFardo: "",
          priceMayor: "",
          priceUnidad: "",
          code: `P-${String(nextNum).padStart(3, '0')}`
        })
        setLocalImagePreviews([])
      }
    } catch (e: any) {
      toast({ title: "Error", description: "Error al sincronizar con Google Sheets.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            {editId ? 'Editar Prenda' : 'Registrar Prenda'}
            <Sparkles className="text-accent w-6 h-6" />
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Gestión Maestra de Stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 rounded-xl" onClick={() => router.push('/inventory')}>
            <History className="w-4 h-4 mr-2" />
            Ver Inventario
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-[2.5rem]">
            <CardHeader className="bg-accent/5 border-b border-accent/10 py-6 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-accent flex items-center gap-2 font-bold">
                  <Edit3 className="w-5 h-5" /> Datos del Producto
                </CardTitle>
                <div className="bg-accent text-white px-5 py-1.5 rounded-full font-mono font-black text-sm shadow-lg shadow-accent/20">
                  {form.code}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70 ml-1">Nombre de Prenda *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ej. Saco Velvet Premium" 
                  className="h-14 border-accent/20 focus:border-primary rounded-[1.25rem] text-lg font-medium shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Categoría *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-[9px] text-primary font-black tracking-tighter hover:underline">+ AGREGAR</button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl">
                        <DialogHeader><DialogTitle>Gestionar Categorías</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex gap-2">
                            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría..." className="rounded-xl" />
                            <Button onClick={() => { if(newCat) { setCategories([...categories, newCat]); setNewCat(""); } }} className="rounded-xl">Añadir</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                              <div key={c} className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                {c} <X className="w-3 h-3 cursor-pointer" onClick={() => setCategories(categories.filter(x => x !== c))} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger className="border-accent/20 h-12 rounded-[1.25rem] bg-accent/5 font-bold text-accent">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {categories.map(c => <SelectItem key={c} value={c} className="rounded-lg">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Colección *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-[9px] text-primary font-black tracking-tighter hover:underline">+ AGREGAR</button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl">
                        <DialogHeader><DialogTitle>Gestionar Colecciones</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex gap-2">
                            <Input value={newColl} onChange={e => setNewColl(e.target.value)} placeholder="Nueva colección..." className="rounded-xl" />
                            <Button onClick={() => { if(newColl) { setCollections([...collections, newColl]); setNewColl(""); } }} className="rounded-xl">Añadir</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {collections.map(c => (
                              <div key={c} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                {c} <X className="w-3 h-3 cursor-pointer" onClick={() => setCollections(collections.filter(x => x !== c))} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                    <SelectTrigger className="border-accent/20 h-12 rounded-[1.25rem] bg-accent/5 font-bold text-accent">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {collections.map(c => <SelectItem key={c} value={c} className="rounded-lg">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Descripción Estética</Label>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-8 text-[10px] bg-primary text-white hover:bg-primary/90 font-black tracking-widest rounded-full px-6 shadow-md"
                    onClick={handleAI}
                    disabled={loadingAI}
                  >
                    {loadingAI ? "GENERANDO..." : "MÁGICA IA"}
                  </Button>
                </div>
                <Textarea 
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Escribe sobre la tela, el corte o el estilo..." 
                  className="min-h-[140px] border-accent/20 rounded-[1.5rem] resize-none focus:ring-primary p-5 text-base shadow-inner bg-accent/5"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg text-primary font-bold">Stock y Precios de Venta</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-primary tracking-widest block text-center">Stock Actual *</Label>
                  <Input 
                    type="number" 
                    value={form.quantity}
                    onChange={e => setForm({...form, quantity: e.target.value})}
                    className="border-primary/20 font-black h-14 rounded-[1.25rem] focus:ring-primary text-center text-2xl text-primary bg-primary/5"
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70 block text-center">P. Fardo (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceFardo}
                    onChange={e => setForm({...form, priceFardo: e.target.value})}
                    className={cn("border-accent/20 h-14 rounded-[1.25rem] text-center font-black text-xl text-accent", priceError && "border-destructive")}
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70 block text-center">P. Mayor (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceMayor}
                    onChange={e => setForm({...form, priceMayor: e.target.value})}
                    className={cn("border-accent/20 h-14 rounded-[1.25rem] text-center font-black text-xl text-accent", priceError && "border-destructive")}
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70 block text-center">P. Unidad (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceUnidad}
                    onChange={e => setForm({...form, priceUnidad: e.target.value})}
                    className={cn("border-accent/20 h-14 rounded-[1.25rem] text-center font-black text-xl text-accent", priceError && "border-destructive")}
                    placeholder=""
                  />
                </div>
              </div>
              {priceError && (
                <div className="flex items-center gap-2 text-destructive text-xs font-black animate-pulse bg-destructive/5 p-3 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                  {priceError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5">
              <CardTitle className="text-lg text-accent flex justify-between items-center font-bold">
                Fotos de la Prenda
                <span className="text-[10px] bg-accent text-white px-3 py-1 rounded-full">{localImagePreviews.length}/4</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {localImagePreviews.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border-2 border-accent/10 group shadow-lg">
                    <Image src={img} alt="" fill className="object-cover" />
                    <button 
                      onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {localImagePreviews.length < 4 && (
                  <>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-[1.5rem] border-4 border-dashed border-accent/20 flex flex-col items-center justify-center gap-3 text-accent hover:text-primary hover:border-primary/50 transition-all bg-accent/5 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ImagePlus className="w-7 h-7" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Subir (Max 3MB)</span>
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-24 text-2xl font-headline shadow-2xl shadow-primary/30 rounded-[2.5rem] bg-gradient-to-tr from-primary to-accent hover:opacity-95 active:scale-[0.97] border-none text-white transition-all font-black tracking-tight" 
            onClick={handleSave}
            disabled={saving || !!priceError}
          >
            {saving ? (
              <>
                <Loader2 className="w-8 h-8 mr-4 animate-spin" />
                SINCRONIZANDO...
              </>
            ) : (
              <>
                <Save className="w-8 h-8 mr-4" />
                {editId ? 'ACTUALIZAR PRENDA' : 'GUARDAR PRENDA'}
              </>
            )}
          </Button>
          
          <div className="text-[9px] text-center text-muted-foreground uppercase tracking-[0.4em] font-black px-10 leading-relaxed bg-accent/5 py-4 rounded-2xl">
            * Conectado a Google Drive y Sheets para máxima velocidad *
          </div>
        </div>
      </div>
    </div>
  )
}
