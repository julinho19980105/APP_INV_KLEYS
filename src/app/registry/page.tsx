
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ImagePlus, X, Save, History, Loader2, Sparkles, Settings2, Edit3, Plus, Search, Maximize2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, limit, getDocs, increment } from "firebase/firestore"
import { uploadImageToDrive } from "@/services/sheets-service"
import { Badge } from "@/components/ui/badge"

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

  const [form, setForm] = React.useState({
    name: "",
    code: "",
    category: "",
    collection: "",
    description: "",
    stock: "",
    priceFardo: "",
    priceMayor: "",
    priceUnidad: "",
  })

  const [stockEntry, setStockEntry] = React.useState({
    productCode: "",
    quantity: "",
    reason: "Reposición de Mercadería"
  })

  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [manageType, setManageType] = React.useState<'category' | 'collection' | null>(null)
  const [newItemName, setNewItemName] = React.useState("")
  const [editingItem, setEditingItem] = React.useState<{id: string, name: string} | null>(null)
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLocalImagePreviews(prev => [...prev, reader.result as string].slice(0, 4))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddItem = async () => {
    if (!db || !manageType || !newItemName.trim()) return
    const colName = manageType === 'category' ? 'categories' : 'collections'
    addDoc(collection(db, colName), { name: newItemName.trim() })
      .then(() => {
        setNewItemName("")
        toast({ title: "Agregado", description: "Nuevo elemento guardado." })
      })
  }

  const handleRenameItem = async () => {
    if (!db || !manageType || !editingItem || !editingItem.name.trim()) return
    const colName = manageType === 'category' ? 'categories' : 'collections'
    const itemRef = doc(db, colName, editingItem.id)
    updateDoc(itemRef, { name: editingItem.name.trim() })
      .then(() => {
        setEditingItem(null)
        toast({ title: "Actualizado", description: "Nombre modificado correctamente." })
      })
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
        name: form.name,
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

      const pRef = doc(db, "products", form.code)
      await setDoc(pRef, productData, { merge: true })
      
      if (!editId) {
        await addDoc(collection(db, "movements"), {
          productCode: form.code,
          type: "in",
          quantity: Number(form.stock),
          reason: "Stock Inicial / Registro Nuevo",
          timestamp: serverTimestamp()
        })
      }

      toast({ title: "Éxito", description: `Prenda ${form.code} registrada correctamente.` })
      router.push('/inventory')
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Hubo un problema al guardar." })
    } finally {
      setSaving(false);
    }
  }

  const handleAddStock = async () => {
    if (!db || !stockEntry.productCode || !stockEntry.quantity) return
    setSaving(true)
    try {
      const pRef = doc(db, "products", stockEntry.productCode)
      const qty = Number(stockEntry.quantity)
      
      await updateDoc(pRef, {
        stock: increment(qty),
        updatedAt: serverTimestamp()
      })

      await addDoc(collection(db, "movements"), {
        productCode: stockEntry.productCode,
        type: "in",
        quantity: qty,
        reason: stockEntry.reason,
        timestamp: serverTimestamp()
      })

      toast({ title: "Ingreso Exitoso", description: `Se agregaron ${qty} unidades a ${stockEntry.productCode}.` })
      router.push('/inventory')
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el ingreso." })
    } finally {
      setSaving(false)
    }
  }

  const getThumbnailUrl = (url: string) => {
    if (!url || !url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) return url;
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w200`;
  };

  const isFormValid = form.name && form.category && form.collection && form.stock !== "" && !saving

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
            Gestión de Inventario
            <Sparkles className="text-accent w-5 h-5" />
          </h1>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">Operaciones de Almacén Diva</p>
        </div>
        <Button variant="outline" className="border-accent text-accent bg-white rounded-xl h-8 px-4 font-bold text-xs" onClick={() => router.push('/inventory')}>
          <History className="w-3 h-3 mr-2" /> Kardex
        </Button>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="new" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white text-xs">{editId ? 'Editar Prenda' : 'Nueva Prenda'}</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white text-xs">Ingreso de Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-accent/5 border-b border-accent/10 py-4 flex flex-row items-center justify-between px-6">
                  <CardTitle className="text-sm text-accent font-black uppercase tracking-widest">Ficha de Prenda</CardTitle>
                  <div className="bg-primary text-white px-6 py-2 rounded-xl font-mono font-black text-xl shadow-md border-2 border-white">
                    {form.code}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6 px-6">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Nombre de Prenda *</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 border-accent/20 rounded-xl text-base font-bold" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Categoría *</Label>
                      <div className="flex gap-2">
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                          <SelectTrigger className="h-9 border-accent/20 rounded-xl font-bold bg-white text-sm px-4">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {categories.filter(c => c.name).map(cat => (
                              <SelectItem key={cat.id} value={cat.name} className="rounded-lg">{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'category'} onOpenChange={(o) => setManageType(o ? 'category' : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-accent text-accent shrink-0">
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="text-primary font-black uppercase tracking-widest text-xs">Categorías</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div className="flex gap-2">
                                <Input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs" />
                                <Button className="h-8 w-8 bg-primary p-0" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button>
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {categories.map(cat => (
                                  <div key={cat.id} className="flex items-center justify-between p-2 bg-accent/5 rounded-xl border border-accent/10">
                                    {editingItem?.id === cat.id ? (
                                      <div className="flex gap-1 w-full">
                                        <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px] font-bold" />
                                        <Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEditingItem(null)}><X className="w-3 h-3" /></Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-bold text-accent text-xs">{cat.name}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({id: cat.id, name: cat.name})}>
                                          <Edit3 className="w-3 h-3 text-accent" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Colección *</Label>
                      <div className="flex gap-2">
                        <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                          <SelectTrigger className="h-9 border-accent/20 rounded-xl font-bold bg-white text-sm px-4">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {collectionsData.filter(c => c.name).map(col => (
                              <SelectItem key={col.id} value={col.name} className="rounded-lg">{col.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'collection'} onOpenChange={(o) => setManageType(o ? 'collection' : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-accent text-accent shrink-0">
                              <Settings2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="text-primary font-black uppercase tracking-widest text-xs">Colecciones</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div className="flex gap-2">
                                <Input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs" />
                                <Button className="h-8 w-8 bg-primary p-0" onClick={handleAddItem}><Plus className="w-4 h-4" /></Button>
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {collectionsData.map(col => (
                                  <div key={col.id} className="flex items-center justify-between p-2 bg-accent/5 rounded-xl border border-accent/10">
                                    {editingItem?.id === col.id ? (
                                      <div className="flex gap-1 w-full">
                                        <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-7 text-[10px] font-bold" />
                                        <Button size="icon" className="h-7 w-7 bg-green-500" onClick={handleRenameItem}><Save className="w-3 h-3" /></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEditingItem(null)}><X className="w-3 h-3" /></Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-bold text-accent text-xs">{col.name}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({id: col.id, name: col.name})}>
                                          <Edit3 className="w-3 h-3 text-accent" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Descripción</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[80px] rounded-xl bg-accent/5 p-4 text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                 <CardHeader className="bg-primary/5 border-b border-primary/10 py-3 px-6">
                  <CardTitle className="text-xs text-primary font-black uppercase tracking-widest">Stock y Tarifas</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-6">
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-primary uppercase">Stock Inicial *</Label>
                    <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-10 text-center text-xl font-black text-primary bg-primary/5 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Fardo (S/)</Label>
                    <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-10 text-center text-sm font-black rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Al Mayor (S/)</Label>
                    <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-10 text-center text-sm font-black rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Unidad (S/)</Label>
                    <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-10 text-center text-sm font-black rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-accent/5 py-4 px-6 flex justify-between items-center">
                  <CardTitle className="text-[10px] font-black text-accent uppercase">Fotos (4)</CardTitle>
                  <span className="text-[9px] bg-accent text-white px-2 py-0.5 rounded-full">{localImagePreviews.length}/4</span>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 gap-2 px-6">
                   {localImagePreviews.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-muted">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {localImagePreviews.length < 4 && (
                      <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-accent/20 flex flex-col items-center justify-center gap-1 text-accent bg-accent/5 hover:bg-accent/10 transition-colors">
                        <ImagePlus className="w-6 h-6" />
                        <span className="text-[8px] font-black uppercase">Subir</span>
                        <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                      </button>
                    )}
                </CardContent>
              </Card>

              <Button 
                className="w-full h-16 text-xl font-headline shadow-lg rounded-[1.5rem] bg-gradient-to-tr from-primary to-accent text-white font-black hover:scale-[1.02] transition-transform" 
                onClick={handleSave}
                disabled={!isFormValid || saving}
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                {editId ? 'ACTUALIZAR' : 'REGISTRAR'}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden max-w-xl mx-auto">
            <CardHeader className="bg-accent/5 py-4 px-8">
              <CardTitle className="text-sm text-accent font-black uppercase tracking-widest flex items-center gap-2">
                <Search className="w-4 h-4" /> Ingreso de Mercadería
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest">Seleccionar Prenda</Label>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-2xl p-2 bg-muted/5">
                  {allProducts.map(p => (
                    <div 
                      key={p.id} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer",
                        stockEntry.productCode === p.code ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent/5"
                      )}
                      onClick={() => setStockEntry({...stockEntry, productCode: p.code})}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-accent/10 bg-white">
                           {p.images?.[0] ? (
                             <>
                               <img src={getThumbnailUrl(p.images[0])} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               <button 
                                 className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setZoomedImage(p.images[0]);
                                 }}
                               >
                                 <Maximize2 className="w-4 h-4 text-white" />
                               </button>
                             </>
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-[8px] opacity-20">NO FOTO</div>
                           )}
                        </div>
                        <div>
                          <div className="font-black text-xs text-primary">{p.code} - {p.name}</div>
                          <div className="flex gap-2 items-center">
                             <Badge variant="secondary" className="text-[8px] bg-accent/10 text-accent border-none">{p.category}</Badge>
                             <span className="text-[9px] font-bold text-muted-foreground uppercase">Stock: {p.stock}</span>
                          </div>
                        </div>
                      </div>
                      {stockEntry.productCode === p.code && <div className="w-3 h-3 rounded-full bg-primary" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest">Cantidad a Ingresar</Label>
                  <Input 
                    type="number" 
                    value={stockEntry.quantity} 
                    onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} 
                    className="h-10 border-accent/20 rounded-xl text-lg font-bold text-center"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest">Motivo</Label>
                  <div className="h-10 flex items-center px-4 bg-muted/20 border-accent/20 border rounded-xl font-bold text-xs text-accent">
                    REPOSICIÓN
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-14 text-lg font-black rounded-2xl bg-accent text-white shadow-lg hover:bg-accent/90"
                onClick={handleAddStock}
                disabled={!stockEntry.productCode || !stockEntry.quantity || saving}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                REGISTRAR REPOSICIÓN
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/90 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Zoom Prenda</DialogTitle>
            <DialogDescription>Detalle de prenda en alta resolución</DialogDescription>
          </DialogHeader>
          {zoomedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={zoomedImage.includes('id=') ? zoomedImage.replace('export=view', 'export=download') : zoomedImage} 
                alt="Vista Zoom" 
                className="max-w-full max-h-[90vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
