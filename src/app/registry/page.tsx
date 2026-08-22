
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { 
  ImagePlus, 
  X, 
  Save, 
  Loader2, 
  Edit2,
  Trash2,
  Package
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, getDocs, limit, writeBatch } from "firebase/firestore"
import { uploadImageToDrive } from "@/services/sheets-service"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function getDriveThumb(url: string, size: number = 400) {
  if (!url || !url.includes('drive.google.com')) return url;
  let fileId = '';
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) fileId = idMatch[1];
  else {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) fileId = dMatch[1];
  }
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : url;
}

export default function RegistryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('edit')
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  
  const [saving, setSaving] = React.useState(false)
  const [nextId, setNextId] = React.useState("P-001")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const { data: allProducts = [] } = useCollection(productsQuery)

  const [form, setForm] = React.useState({ 
    name: "", 
    category: "GENERAL", 
    collection: "GENERAL", 
    description: "", 
    stock: "", 
    priceFardo: "", 
    priceMayor: "", 
    priceUnidad: "" 
  })
  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  
  const [isRenameOpen, setIsRenameOpen] = React.useState(false)
  const [renameData, setRenameData] = React.useState({ type: "category", oldName: "", newName: "" })

  const uniqueCategories = React.useMemo(() => Array.from(new Set(allProducts.map(p => (p.category || 'GENERAL').toUpperCase()).filter(Boolean))).sort(), [allProducts])
  const uniqueCollections = React.useMemo(() => Array.from(new Set(allProducts.map(p => (p.collection || 'GENERAL').toUpperCase()).filter(Boolean))).sort(), [allProducts])

  React.useEffect(() => {
    if (!db || editId) return
    const fetchNextId = async () => {
      const q = query(collection(db, "products"), orderBy("code", "desc"), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const lastCode = snap.docs[0].id
        const lastNum = parseInt(lastCode.split('-')[1]) || 0
        setNextId(`P-${(lastNum + 1).toString().padStart(3, '0')}`)
      }
    }
    fetchNextId()
  }, [db, editId])

  React.useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        category: editingProduct.category || "GENERAL",
        collection: editingProduct.collection || "GENERAL",
        description: editingProduct.description || "",
        stock: editingProduct.stock?.toString() || "",
        priceFardo: editingProduct.priceFardo?.toString() || "",
        priceMayor: editingProduct.priceMayor?.toString() || "",
        priceUnidad: editingProduct.priceUnidad?.toString() || "",
      })
      setLocalImagePreviews(editingProduct.images || [])
      setNextId(editingProduct.code)
    }
  }, [editingProduct])

  const handleSave = async () => {
    if (!db || !form.name) return
    setSaving(true)
    const productCode = nextId.toUpperCase()
    try {
      const productData = {
        name: form.name.toUpperCase(),
        code: productCode,
        category: (form.category || "GENERAL").toUpperCase(),
        collection: (form.collection || "GENERAL").toUpperCase(),
        description: form.description,
        stock: Number(form.stock),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: localImagePreviews,
        updatedAt: serverTimestamp()
      }
      
      await setDoc(doc(db, "products", productCode), productData, { merge: true })
      toast({ title: editId ? "PRENDA ACTUALIZADA" : "PRENDA REGISTRADA" })
      router.push('/inventory')
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al guardar" }) 
    }
    finally { setSaving(false) }
  }

  const handleRenameLabel = async () => {
    if (!db || !renameData.newName || !renameData.oldName) return
    setSaving(true)
    try {
      const batch = writeBatch(db)
      const targetProducts = allProducts.filter(p => (p[renameData.type] || 'GENERAL').toUpperCase() === renameData.oldName.toUpperCase())
      
      targetProducts.forEach(p => {
        const ref = doc(db, "products", p.id)
        batch.update(ref, { [renameData.type]: renameData.newName.toUpperCase(), updatedAt: serverTimestamp() })
      })
      
      await batch.commit()
      toast({ title: "Cambio Global Exitoso", description: `Se actualizaron ${targetProducts.length} productos.` })
      setIsRenameOpen(false)
      if (renameData.type === 'category') setForm({...form, category: renameData.newName.toUpperCase()})
      else setForm({...form, collection: renameData.newName.toUpperCase()})
    } catch (e) {
      toast({ variant: "destructive", title: "Error en renombrado" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4 pb-24 px-2 md:px-0">
      <div className="flex justify-between items-end border-b-2 border-primary/10 pb-6 mb-4">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="text-4xl font-headline font-black text-foreground uppercase tracking-tight">Registro de productos</h1>
          </div>
        </div>
        <div className="bg-primary text-white px-8 py-2 rounded-2xl font-black text-2xl shadow-xl shadow-primary/20">{nextId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
            <CardContent className="space-y-10 pt-10 px-10 pb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[11px] uppercase font-black ml-1 text-primary tracking-widest">Nombre de la Prenda *</Label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    placeholder="ESCRIBIR NOMBRE..."
                    className="h-14 border-primary/10 rounded-2xl font-black text-base uppercase focus:ring-primary shadow-sm" 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 ml-1">
                      <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Categoría</Label>
                      <button 
                        className="text-primary/40 hover:text-primary transition-colors" 
                        onClick={() => { setRenameData({ type: 'category', oldName: form.category, newName: "" }); setIsRenameOpen(true); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        list="categories" 
                        value={form.category} 
                        onChange={e => setForm({...form, category: e.target.value.toUpperCase()})} 
                        className="h-14 border-primary/10 rounded-2xl font-black text-[12px] uppercase shadow-sm" 
                      />
                      <datalist id="categories">
                        {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 ml-1">
                      <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Colección</Label>
                      <button 
                        className="text-primary/40 hover:text-primary transition-colors" 
                        onClick={() => { setRenameData({ type: 'collection', oldName: form.collection, newName: "" }); setIsRenameOpen(true); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        list="collections" 
                        value={form.collection} 
                        onChange={e => setForm({...form, collection: e.target.value.toUpperCase()})} 
                        className="h-14 border-primary/10 rounded-2xl font-black text-[12px] uppercase shadow-sm" 
                      />
                      <datalist id="collections">
                        {uniqueCollections.map(col => <option key={col} value={col} />)}
                      </datalist>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Stock</Label>
                  <Input 
                    type="number" 
                    value={form.stock} 
                    onChange={e => setForm({...form, stock: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-green-200 bg-green-50 text-green-700 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Fardo</Label>
                  <Input 
                    type="number" 
                    value={form.priceFardo} 
                    onChange={e => setForm({...form, priceFardo: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-200 bg-orange-50 text-orange-700 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Mayor</Label>
                  <Input 
                    type="number" 
                    value={form.priceMayor} 
                    onChange={e => setForm({...form, priceMayor: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-200 bg-orange-50 text-orange-700 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Unidad</Label>
                  <Input 
                    type="number" 
                    value={form.priceUnidad} 
                    onChange={e => setForm({...form, priceUnidad: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-200 bg-orange-50 text-orange-700 shadow-sm focus:ring-primary" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] uppercase font-black ml-1 text-primary tracking-widest">Descripción Estética</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="MATERIAL, TEXTURA, AJUSTE, ETC..."
                  className="min-h-[120px] rounded-[2rem] bg-primary/5 p-6 text-sm font-medium border-none text-foreground focus:ring-primary shadow-inner" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-primary/5 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-primary tracking-widest">Galería Drive</span>
              <span className="text-[10px] font-black text-primary/40">{localImagePreviews.length} / 4 FOTOS</span>
            </div>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 px-6 pb-6">
              {localImagePreviews.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-primary/5 shadow-md group">
                  <img src={getDriveThumb(img, 400)} className="w-full h-full object-cover" alt="Previa" />
                  <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {localImagePreviews.length < 4 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 bg-primary/5 hover:bg-primary/10 transition-all group">
                  <ImagePlus className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase text-primary/40">Agregar Foto</span>
                </button>
              )}
              <input type="file" hidden ref={fileInputRef} onChange={async e => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onloadend = async () => {
                    toast({ title: "Subiendo imagen...", description: "Conectando con Drive" });
                    const url = await uploadImageToDrive(r.result as string, `${nextId}_${Date.now()}.jpg`);
                    setLocalImagePreviews(p => [...p, url]);
                    toast({ title: "Imagen Lista" });
                  };
                  r.readAsDataURL(f);
                }
              }} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Button className="h-20 rounded-[2.5rem] bg-primary text-white font-black text-xl shadow-2xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="mr-3 w-6 h-6" />} 
              {editId ? "ACTUALIZAR FICHA" : "GUARDAR PRENDA"}
            </Button>
            {editId && (
              <Button variant="outline" className="h-16 rounded-[2rem] border-primary/10 text-primary font-black uppercase tracking-widest text-[10px] bg-white" onClick={() => router.push('/inventory')}>
                <X className="w-4 h-4 mr-2" /> CANCELAR EDICIÓN
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-primary uppercase tracking-widest text-center">Corregir Nombre</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 text-center">
              <span className="text-[10px] font-black uppercase text-primary/40 block mb-1">Actual</span>
              <span className="text-xl font-headline font-black text-foreground uppercase">{renameData.oldName || 'GENERAL'}</span>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 ml-1">Nuevo Nombre</Label>
              <Input 
                value={renameData.newName} 
                onChange={e => setRenameData({...renameData, newName: e.target.value.toUpperCase()})}
                placeholder="ESCRIBIR NUEVO NOMBRE..."
                className="h-14 font-black uppercase text-center border-primary/10 rounded-2xl shadow-inner"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-14 rounded-2xl font-black text-[10px] uppercase border-primary/10" onClick={() => setIsRenameOpen(false)}>CANCELAR</Button>
              <Button className="h-14 rounded-2xl bg-primary text-white font-black text-[10px] uppercase shadow-lg shadow-primary/20" onClick={handleRenameLabel} disabled={saving || !renameData.newName}>
                {saving ? <Loader2 className="animate-spin" /> : "ACTUALIZAR TODO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
