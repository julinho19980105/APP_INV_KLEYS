
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, Loader2, Sparkles, Edit3, Plus, Search, Trash2, Eraser, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, limit, getDocs, increment } from "firebase/firestore"
import { uploadImageToDrive } from "@/services/sheets-service"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function RegistryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('edit')
  const db = useFirestore()
  const { toast } = useToast()
  
  const [saving, setSaving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  
  const { data: categories = [] } = useCollection(categoriesQuery)
  const { data: collectionsData = [] } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)

  const initialForm = {
    name: "",
    code: "",
    category: "",
    collection: "",
    description: "",
    stock: "",
    priceFardo: "",
    priceMayor: "",
    priceUnidad: "",
  }

  const [form, setForm] = React.useState(initialForm)
  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [manageType, setManageType] = React.useState<'category' | 'collection' | null>(null)
  const [newItemName, setNewItemName] = React.useState("")
  const [editingItem, setEditingItem] = React.useState<{id: string, name: string} | null>(null)
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)

  const [stockEntry, setStockEntry] = React.useState({
    productCode: "",
    quantity: "",
    reason: "Reposición de Mercadería"
  })

  // Cargar persistencia
  React.useEffect(() => {
    if (!editId) {
      const saved = localStorage.getItem('diva_registry_form')
      if (saved) setForm(JSON.parse(saved))
    }
  }, [editId])

  // Guardar persistencia
  React.useEffect(() => {
    if (!editId) {
      localStorage.setItem('diva_registry_form', JSON.stringify(form))
    }
  }, [form, editId])

  const fetchNextCode = React.useCallback(async () => {
    if (!db || editId) return
    try {
      const q = query(collection(db, "products"), orderBy("code", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextNum = 1
      if (!snap.empty) {
        const lastCode = snap.docs[0].data().code || "P-000"
        const match = lastCode.match(/\d+/)
        const lastNum = match ? parseInt(match[0]) : 0
        nextNum = lastNum + 1
      }
      const newCode = `P-${nextNum.toString().padStart(3, '0')}`
      setForm(prev => ({ ...prev, code: newCode }))
    } catch (e) {
      setForm(prev => ({ ...prev, code: "P-001" }))
    }
  }, [db, editId])

  React.useEffect(() => {
    fetchNextCode()
  }, [fetchNextCode])

  React.useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        code: editingProduct.code || "",
        category: editingProduct.category || "",
        collection: editingProduct.collection || "",
        description: editingProduct.description || "",
        stock: editingProduct.stock?.toString() || "",
        priceFardo: editingProduct.priceFardo?.toString() || "",
        priceMayor: editingProduct.priceMayor?.toString() || "",
        priceUnidad: editingProduct.priceUnidad?.toString() || "",
      })
      setLocalImagePreviews(editingProduct.images || [])
    }
  }, [editingProduct])

  const handleClear = () => {
    setForm(initialForm)
    setLocalImagePreviews([])
    localStorage.removeItem('diva_registry_form')
    fetchNextCode()
  }

  const handleSave = async () => {
    if (!db || !isFormValid) return
    setSaving(true)
    try {
      const uploadedImageUrls = await Promise.all(
        localImagePreviews.map(async (img, index) => {
          if (img.startsWith('http')) return img;
          return await uploadImageToDrive(img, `${form.code}_${index}.jpg`);
        })
      );

      const productData = {
        name: form.name.toUpperCase(),
        code: form.code,
        category: form.category,
        collection: form.collection,
        description: form.description,
        stock: Number(form.stock),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: uploadedImageUrls,
        updatedAt: serverTimestamp()
      }

      await setDoc(doc(db, "products", form.code), productData, { merge: true })
      
      if (!editId) {
        await addDoc(collection(db, "movements"), {
          productCode: form.code,
          type: "in",
          quantity: Number(form.stock),
          reason: "Stock Inicial / Registro Nuevo",
          timestamp: serverTimestamp()
        })
      }
      localStorage.removeItem('diva_registry_form')
      toast({ title: "Guardado", description: `Prenda ${form.code} lista.` })
      router.push('/inventory')
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo en base de datos." })
    } finally {
      setSaving(false);
    }
  }

  const handleAddStock = async () => {
    if (!db || !stockEntry.productCode || !stockEntry.quantity) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "products", stockEntry.productCode), {
        stock: increment(Number(stockEntry.quantity)),
        updatedAt: serverTimestamp()
      })
      await addDoc(collection(db, "movements"), {
        productCode: stockEntry.productCode,
        type: "in",
        quantity: Number(stockEntry.quantity),
        reason: "Reposición de Mercadería",
        timestamp: serverTimestamp()
      })
      toast({ title: "Stock Añadido" })
      router.push('/inventory')
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!db || !manageType || !newItemName.trim()) return
    const colName = manageType === 'category' ? 'categories' : 'collections'
    addDoc(collection(db, colName), { name: newItemName.trim() })
      .then(() => {
        setNewItemName("")
        toast({ title: "Añadido" })
      })
  }

  const handleRenameItem = async () => {
    if (!db || !manageType || !editingItem || !editingItem.name.trim()) return
    const colName = manageType === 'category' ? 'categories' : 'collections'
    updateDoc(doc(db, colName, editingItem.id), { name: editingItem.name.trim() })
      .then(() => {
        setEditingItem(null)
        toast({ title: "Renombrado" })
      })
  }

  const isFormValid = React.useMemo(() => {
    const pricesValid = !form.priceFardo || !form.priceMayor || !form.priceUnidad || 
      (Number(form.priceFardo) < Number(form.priceMayor) && Number(form.priceMayor) < Number(form.priceUnidad));
    
    return form.name && form.category && form.collection && form.stock !== "" && pricesValid && !saving;
  }, [form, saving]);

  const getThumbnailUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w200`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 -mt-4">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-full justify-start overflow-hidden border">
          <TabsTrigger value="new" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black uppercase font-headline">NUEVA PRENDA</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black uppercase font-headline">INGRESO STOCK</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-accent/5 border-b py-2 px-6 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary w-4 h-4" />
                    <span className="text-[10px] text-black font-black uppercase tracking-widest">Ficha de Prenda</span>
                  </div>
                  <div className="bg-primary text-white px-4 py-0.5 rounded-lg font-mono font-black text-lg border-2 border-white">{form.code}</div>
                </div>
                <CardContent className="space-y-3 pt-3 px-6">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase font-black text-black ml-1">Nombre Comercial *</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-8 text-black border-accent/20 rounded-xl font-bold text-sm uppercase" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] uppercase font-black text-black ml-1">Categoría Diva *</Label>
                      <div className="flex gap-2">
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                          <SelectTrigger className="h-7 border-accent/20 rounded-xl font-black bg-white text-[10px] text-black">
                            <SelectValue placeholder="Elegir..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {categories.map(c => c.name && <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'category'} onOpenChange={(o) => setManageType(o ? 'category' : null)}>
                          <DialogTrigger asChild><Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-accent text-accent"><Edit3 className="w-3.5 h-3.5" /></Button></DialogTrigger>
                          <DialogContent className="rounded-[2rem] max-w-sm"><DialogHeader><DialogTitle className="text-xs font-black text-black">CATEGORÍAS</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="flex gap-2"><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" /><Button className="h-8 w-8 bg-primary" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button></div>
                              <div className="max-h-40 overflow-y-auto space-y-1">{categories.map(c => <div key={c.id} className="flex items-center justify-between p-2 bg-accent/5 rounded-xl">
                                  {editingItem?.id === c.id ? <div className="flex gap-1"><Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px]" /><Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button></div> 
                                  : <><span className="font-black text-black text-[10px]">{c.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingItem({id: c.id, name: c.name})}><Edit3 className="w-3 h-3 text-accent" /></Button></>}
                                </div>)}</div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] uppercase font-black text-black ml-1">Colección *</Label>
                      <div className="flex gap-2">
                        <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                          <SelectTrigger className="h-7 border-accent/20 rounded-xl font-black bg-white text-[10px] text-black">
                            <SelectValue placeholder="Elegir..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {collectionsData.map(c => c.name && <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'collection'} onOpenChange={(o) => setManageType(o ? 'collection' : null)}>
                          <DialogTrigger asChild><Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-accent text-accent"><Edit3 className="w-3.5 h-3.5" /></Button></DialogTrigger>
                          <DialogContent className="rounded-[2rem] max-w-sm"><DialogHeader><DialogTitle className="text-xs font-black text-black">COLECCIONES</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="flex gap-2"><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" /><Button className="h-8 w-8 bg-primary" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button></div>
                              <div className="max-h-40 overflow-y-auto space-y-1">{collectionsData.map(c => <div key={c.id} className="flex items-center justify-between p-2 bg-accent/5 rounded-xl">
                                  {editingItem?.id === c.id ? <div className="flex gap-1"><Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px]" /><Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button></div> 
                                  : <><span className="font-black text-black text-[10px]">{c.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingItem({id: c.id, name: c.name})}><Edit3 className="w-3 h-3 text-accent" /></Button></>}
                                </div>)}</div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase font-black text-black ml-1">Observaciones Estéticas</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[50px] rounded-xl bg-accent/5 p-2 text-xs font-medium border-none text-black" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-primary/5 py-1 px-6 border-b"><span className="text-[9px] text-primary font-black uppercase">Tarifas Diva</span></div>
                <CardContent className="pt-2 grid grid-cols-4 gap-4 px-6 pb-3">
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-primary uppercase text-center">Stock *</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-8 text-center text-lg font-black text-primary bg-primary/5 rounded-xl" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/20 text-black" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/20 text-black" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/20 text-black" /></div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-accent/5 py-2 px-6 flex justify-between items-center border-b">
                  <span className="text-[9px] font-black text-black uppercase">Catálogo</span>
                  <span className="text-[8px] bg-accent text-white px-2 rounded-full font-black">{localImagePreviews.length}/4</span>
                </div>
                <CardContent className="pt-3 grid grid-cols-2 gap-2 px-6 pb-3">
                   {localImagePreviews.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group bg-muted/30">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {localImagePreviews.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-accent/20 flex flex-col items-center justify-center gap-1 text-accent bg-accent/5 hover:bg-accent/10"><ImagePlus className="w-5 h-5 opacity-40" /><span className="text-[8px] font-black uppercase opacity-40">Cargar</span><input type="file" hidden ref={fileInputRef} onChange={e => {
                      const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setLocalImagePreviews(p => [...p, r.result as string].slice(0, 4)); r.readAsDataURL(file); }
                    }} accept="image/*" /></button>}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-16 w-12 rounded-2xl border-2 border-accent text-accent hover:bg-accent/5" onClick={handleClear}><Eraser className="w-5 h-5" /></Button>
                <Button className="flex-1 h-16 text-lg rounded-2xl bg-primary text-white font-black shadow-lg" onClick={handleSave} disabled={!isFormValid || saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} {editId ? 'ACTUALIZAR' : 'GUARDAR'}
                </Button>
                {editId && <Button variant="outline" size="icon" className="h-16 w-16 rounded-2xl border-destructive text-destructive" onClick={() => router.push('/inventory')}><X className="w-8 h-8" /></Button>}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border shadow-sm bg-white rounded-[2rem] overflow-hidden max-w-xl mx-auto">
            <div className="bg-accent/5 py-4 px-8 border-b"><span className="text-xs text-black font-black uppercase">Reposición Stock</span></div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 border rounded-xl p-2 bg-muted/5">
                {allProducts.map(p => (
                  <div key={p.id} className={cn("flex items-center justify-between p-2 rounded-xl border-2 transition-all cursor-pointer", stockEntry.productCode === p.code ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent/5")} onClick={() => setStockEntry({...stockEntry, productCode: p.code})}>
                    <div className="flex items-center gap-3">
                      <button className="w-8 h-8 rounded-lg overflow-hidden border border-accent/20 bg-white" onClick={e => { e.stopPropagation(); if (p.images?.[0]) setZoomedImage(p.images[0]); }}>
                        {p.images?.[0] ? <img src={getThumbnailUrl(p.images[0])} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="text-[7px] font-black opacity-20">N/A</div>}
                      </button>
                      <div>
                        <div className="font-black text-xs text-black">{p.code} - {p.name}</div>
                        <Badge variant="outline" className="text-[7px] h-3 px-1 border-accent/30 text-accent font-black uppercase">{p.category} | Saldo: {p.stock}</Badge>
                      </div>
                    </div>
                    {stockEntry.productCode === p.code && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5"><Label className="text-[9px] font-black text-black">CANT. INGRESO</Label><Input type="number" value={stockEntry.quantity} onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} className="h-10 text-lg font-black text-center text-primary" placeholder="0" /></div>
                <div className="h-10 mt-5 flex items-center justify-center bg-accent/5 border border-accent/20 rounded-xl font-black text-[10px] text-black">REPOSICIÓN</div>
              </div>
              <Button className="w-full h-14 text-lg font-black rounded-2xl bg-accent text-white" onClick={handleAddStock} disabled={!stockEntry.productCode || !stockEntry.quantity || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} CONFIRMAR INGRESO
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Zoom Alta Calidad</DialogTitle><DialogDescription>Visualización Calidad Original Drive</DialogDescription></DialogHeader>
          {zoomedImage && <div className="relative w-full h-full flex items-center justify-center"><button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 z-50 p-2 bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
            <img src={zoomedImage.includes('id=') ? zoomedImage.replace('export=view', 'export=download') : zoomedImage} alt="" className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95" referrerPolicy="no-referrer" />
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
