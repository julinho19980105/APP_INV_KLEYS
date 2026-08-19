
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
import { ImagePlus, X, Save, Loader2, Sparkles, Edit3, Plus, Search, Eraser } from "lucide-react"
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
  const [stockSearchQuery, setStockSearchQuery] = React.useState("")

  const [stockEntry, setStockEntry] = React.useState({
    productCode: "",
    quantity: "",
    reason: "Reposición de Mercadería"
  })

  React.useEffect(() => {
    if (!editId) {
      const saved = localStorage.getItem('diva_registry_form')
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setForm(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Error parsing saved form", e);
        }
      }
    }
  }, [editId])

  React.useEffect(() => {
    if (!editId && form.name !== "") {
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

      // Usar form.code para el ID del documento, pero si estamos editando
      // aseguramos que usamos el ID original (que debería ser el mismo código)
      const targetId = editId || form.code;

      const productData = {
        name: form.name.toUpperCase(),
        code: targetId, // El código es la identidad única
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

      await setDoc(doc(db, "products", targetId), productData, { merge: true })
      
      if (!editId) {
        await addDoc(collection(db, "movements"), {
          productCode: targetId,
          type: "in",
          quantity: Number(form.stock),
          reason: "Stock Inicial / Registro Nuevo",
          timestamp: serverTimestamp()
        })
      }
      
      localStorage.removeItem('diva_registry_form')
      toast({ title: "Guardado", description: `Prenda ${targetId} lista.` })
      router.push('/inventory')
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" })
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
      toast({ variant: "destructive", title: "Error en ingreso" })
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
        toast({ title: "Elemento añadido" })
      })
  }

  const handleRenameItem = async () => {
    if (!db || !manageType || !editingItem || !editingItem.name.trim()) return
    const colName = manageType === 'category' ? 'categories' : 'collections'
    updateDoc(doc(db, colName, editingItem.id), { name: editingItem.name.trim() })
      .then(() => {
        setEditingItem(null)
        toast({ title: "Elemento actualizado" })
      })
  }

  const isFormValid = React.useMemo(() => {
    const fardo = Number(form.priceFardo || 0);
    const mayor = Number(form.priceMayor || 0);
    const unidad = Number(form.priceUnidad || 0);

    const pricesValid = (fardo === 0 && mayor === 0 && unidad === 0) 
      ? true 
      : (fardo < mayor && mayor < unidad);
    
    return form.name && form.category && form.collection && form.stock !== "" && pricesValid && !saving;
  }, [form, saving]);

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    if (!url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w400`;
  };

  const filteredProductsForStock = allProducts.filter(p => 
    p.code.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(stockSearchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-2">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-full justify-start overflow-hidden border">
          <TabsTrigger value="new" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black uppercase font-headline">NUEVA PRENDA</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-black uppercase font-headline">INGRESO STOCK</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-black/5 border-b py-2 px-6 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary w-4 h-4" />
                    <span className="text-[10px] text-black font-black uppercase tracking-widest">Ficha Técnica</span>
                  </div>
                  <div className="bg-primary text-white px-4 py-0.5 rounded-lg font-mono font-black text-lg border-2 border-white">{form.code}</div>
                </div>
                <CardContent className="space-y-3 pt-3 px-6">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase font-black text-black ml-1">Nombre Comercial *</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 text-black border-black/10 rounded-xl font-black text-sm uppercase" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] uppercase font-black text-black ml-1">Código Identidad *</Label>
                      <Input 
                        value={form.code} 
                        readOnly={!!editId}
                        disabled={!!editId}
                        onChange={e => setForm({...form, code: e.target.value})} 
                        className={cn(
                          "h-10 text-black border-black/10 rounded-xl font-black text-sm uppercase",
                          !!editId && "bg-black/5 opacity-50 cursor-not-allowed"
                        )} 
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] uppercase font-black text-black ml-1">Categoría *</Label>
                      <div className="flex gap-2">
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                          <SelectTrigger className="h-10 border-black/10 rounded-xl font-black bg-white text-[10px] text-black">
                            <SelectValue placeholder="Elegir..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {categories.filter(c => !!c.name).map(c => (
                              <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'category'} onOpenChange={(o) => setManageType(o ? 'category' : null)}>
                          <DialogTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-black/10 text-black"><Edit3 className="w-4 h-4" /></Button></DialogTrigger>
                          <DialogContent className="rounded-[2rem] max-w-sm"><DialogHeader><DialogTitle className="text-xs font-black text-black uppercase">Categorías</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="flex gap-2"><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" /><Button className="h-8 w-8 bg-primary" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button></div>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {categories.map(c => (
                                  <div key={c.id} className="flex items-center justify-between p-2 bg-black/5 rounded-xl">
                                  {editingItem?.id === c.id ? 
                                    <div className="flex gap-1"><Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px]" /><Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button></div> 
                                  : <><span className="font-black text-black text-[10px] uppercase">{c.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingItem({id: c.id, name: c.name})}><Edit3 className="w-3 h-3 text-black" /></Button></>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] uppercase font-black text-black ml-1">Colección *</Label>
                      <div className="flex gap-2">
                        <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                          <SelectTrigger className="h-10 border-black/10 rounded-xl font-black bg-white text-[10px] text-black">
                            <SelectValue placeholder="Elegir..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {collectionsData.filter(c => !!c.name).map(c => (
                              <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'collection'} onOpenChange={(o) => setManageType(o ? 'collection' : null)}>
                          <DialogTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-black/10 text-black"><Edit3 className="w-4 h-4" /></Button></DialogTrigger>
                          <DialogContent className="rounded-[2rem] max-w-sm"><DialogHeader><DialogTitle className="text-xs font-black text-black uppercase">Colecciones</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="flex gap-2"><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" /><Button className="h-8 w-8 bg-primary" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button></div>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {collectionsData.map(c => (
                                  <div key={c.id} className="flex items-center justify-between p-2 bg-black/5 rounded-xl">
                                  {editingItem?.id === c.id ? 
                                    <div className="flex gap-1"><Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px]" /><Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button></div> 
                                  : <><span className="font-black text-black text-[10px] uppercase">{c.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingItem({id: c.id, name: c.name})}><Edit3 className="w-3 h-3 text-black" /></Button></>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <Label className="text-[9px] uppercase font-black text-black ml-1">Observaciones</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[80px] rounded-xl bg-black/5 p-4 text-xs font-black border-none text-black uppercase" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-primary/5 py-1 px-6 border-b"><span className="text-[9px] text-primary font-black uppercase">Tarifas Diva</span></div>
                <CardContent className="pt-2 grid grid-cols-4 gap-4 px-6 pb-3">
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-primary uppercase text-center">Stock *</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-10 text-center text-lg font-black text-primary bg-primary/5 rounded-xl border-none" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl border-black/10 text-black" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl border-black/10 text-black" /></div>
                  <div className="space-y-0.5"><Label className="text-[8px] block font-black text-black uppercase text-center">Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl border-black/10 text-black" /></div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-black/5 py-2 px-6 flex justify-between items-center border-b">
                  <span className="text-[9px] font-black text-black uppercase">Catálogo</span>
                  <span className="text-[8px] bg-black text-white px-2 rounded-full font-black">{localImagePreviews.length}/4</span>
                </div>
                <CardContent className="pt-3 grid grid-cols-2 gap-2 px-6 pb-3">
                   {localImagePreviews.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group bg-muted/30">
                        <img 
                          src={getThumbnailUrl(img)} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {localImagePreviews.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-1 text-black bg-black/5 hover:bg-black/10"><ImagePlus className="w-5 h-5 opacity-40" /><span className="text-[8px] font-black uppercase opacity-40">Cargar</span><input type="file" hidden ref={fileInputRef} onChange={e => {
                      const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setLocalImagePreviews(p => [...p, r.result as string].slice(0, 4)); r.readAsDataURL(file); }
                    }} accept="image/*" /></button>}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border-2 border-black text-black hover:bg-black/5" onClick={handleClear} title="Limpiar Borrador"><Eraser className="w-5 h-5" /></Button>
                <Button className="flex-1 h-12 text-base rounded-2xl bg-primary text-white font-black shadow-lg" onClick={handleSave} disabled={!isFormValid || saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2 w-4 h-4" />} {editId ? 'ACTUALIZAR' : 'GUARDAR'}
                </Button>
                {editId && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-12 w-12 rounded-2xl border-destructive text-destructive hover:bg-destructive/10" 
                    onClick={() => router.push('/inventory')}
                    title="Descartar Edición"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border shadow-sm bg-white rounded-[2rem] overflow-hidden max-w-xl mx-auto">
            <div className="bg-black/5 py-4 px-8 border-b">
              <span className="text-xs text-black font-black uppercase">Reposición Stock</span>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                <Input 
                  placeholder="BUSCAR CÓDIGO O NOMBRE..." 
                  value={stockSearchQuery}
                  onChange={e => setStockSearchQuery(e.target.value)}
                  className="pl-10 h-10 text-[11px] font-black uppercase rounded-xl border-black/10 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 border rounded-xl p-2 bg-muted/5 custom-scrollbar">
                {filteredProductsForStock.map(p => (
                  <div 
                    key={p.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer group",
                      stockEntry.productCode === p.code ? "border-primary bg-primary/5" : "border-transparent hover:bg-black/5"
                    )} 
                    onClick={() => setStockEntry({...stockEntry, productCode: p.code})}
                  >
                    <div className="flex items-center gap-3">
                      <button 
                        className="w-10 h-10 rounded-lg overflow-hidden border border-black/10 bg-white hover:scale-110 transition-transform" 
                        onClick={e => { e.stopPropagation(); if (p.images?.[0]) setZoomedImage(p.images[0]); }}
                      >
                        {p.images?.[0] ? <img src={getThumbnailUrl(p.images[0])} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="text-[7px] font-black opacity-20">N/A</div>}
                      </button>
                      <div>
                        <div className="font-black text-xs text-black group-hover:text-primary transition-colors uppercase">{p.code} - {p.name}</div>
                        <Badge variant="outline" className="text-[7px] h-3 px-1 border-black/10 text-black/60 font-black uppercase">{p.category} | Stock: {p.stock}</Badge>
                      </div>
                    </div>
                    {stockEntry.productCode === p.code && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                  </div>
                ))}
                {filteredProductsForStock.length === 0 && (
                  <div className="py-10 text-center text-[10px] font-black uppercase text-black/20">Sin coincidencias</div>
                )}
              </div>

              {stockEntry.productCode && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] font-black text-black ml-1 uppercase">CANT. INGRESO</Label>
                    <Input 
                      type="number" 
                      autoFocus
                      value={stockEntry.quantity} 
                      onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} 
                      className="h-10 text-lg font-black text-center text-primary rounded-xl border-primary/20 bg-primary/5" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="h-10 mt-5 flex items-center justify-center bg-black/5 border border-black/10 rounded-xl font-black text-[10px] text-black uppercase">REPOSICIÓN</div>
                </div>
              )}

              <Button 
                className="w-full h-14 text-lg font-black rounded-2xl bg-black text-white active:scale-95 transition-all shadow-xl" 
                onClick={handleAddStock} 
                disabled={!stockEntry.productCode || !stockEntry.quantity || saving}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2 w-4 h-4" />} CONFIRMAR INGRESO
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Zoom Alta Calidad</DialogTitle><DialogDescription>Calidad Original Drive</DialogDescription></DialogHeader>
          {zoomedImage && <div className="relative w-full h-full flex items-center justify-center"><button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 z-50 p-2 bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
            <img src={zoomedImage.includes('id=') ? zoomedImage.replace('export=view', 'export=download') : zoomedImage} alt="" className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95" referrerPolicy="no-referrer" />
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
