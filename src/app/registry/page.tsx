
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
import { ImagePlus, X, Save, Loader2, Sparkles, Edit3, Plus, Search, Maximize2, ArrowLeft } from "lucide-react"
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

      toast({ title: "Operación Exitosa", description: `Prenda ${form.code} guardada en inventario.` })
      router.push('/inventory')
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo al guardar en base de datos." })
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
        reason: "Reposición de Mercadería",
        timestamp: serverTimestamp()
      })

      toast({ title: "Stock Actualizado", description: `Se añadieron ${qty} unidades a ${stockEntry.productCode}.` })
      router.push('/inventory')
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Fallo en registro de reposición." })
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
    <div className="max-w-6xl mx-auto space-y-4 -mt-4">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-full justify-start overflow-hidden border shadow-sm">
          <TabsTrigger value="new" className="rounded-xl px-10 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold font-headline uppercase">
            {editId ? 'Editando Prenda' : 'Nueva Prenda'}
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-10 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold font-headline uppercase">
            Ingreso de Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-accent/5 border-b py-3 flex flex-row items-center justify-between px-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary w-4 h-4" />
                    <span className="text-[10px] text-accent font-black uppercase tracking-widest">Ficha Técnica</span>
                  </div>
                  <div className="bg-primary text-white px-4 py-1 rounded-lg font-mono font-black text-lg shadow-sm border border-white">
                    {form.code}
                  </div>
                </div>
                <CardContent className="space-y-4 pt-4 px-6">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Nombre Comercial *</Label>
                    <Input 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})} 
                      className="h-9 border-accent/20 rounded-xl text-sm font-bold uppercase" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Categoría Diva *</Label>
                      <div className="flex gap-2">
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                          <SelectTrigger className="h-8 border-accent/20 rounded-xl font-bold bg-white text-[11px] px-4">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {categories.filter(c => c.name).map(cat => (
                              <SelectItem key={cat.id} value={cat.name} className="rounded-lg text-xs font-bold">{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'category'} onOpenChange={(o) => setManageType(o ? 'category' : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-accent text-accent shrink-0">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="text-primary font-black uppercase tracking-widest text-xs">Categorías</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div className="flex gap-2">
                                <Input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" />
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
                                        <span className="font-bold text-accent text-[11px]">{cat.name}</span>
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
                          <SelectTrigger className="h-8 border-accent/20 rounded-xl font-bold bg-white text-[11px] px-4">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {collectionsData.filter(c => c.name).map(col => (
                              <SelectItem key={col.id} value={col.name} className="rounded-lg text-xs font-bold">{col.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={manageType === 'collection'} onOpenChange={(o) => setManageType(o ? 'collection' : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-accent text-accent shrink-0">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="text-primary font-black uppercase tracking-widest text-xs">Colecciones</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div className="flex gap-2">
                                <Input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-8 text-xs font-bold" />
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
                                        <span className="font-bold text-accent text-[11px]">{col.name}</span>
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
                    <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Observaciones Estéticas</Label>
                    <Textarea 
                      value={form.description} 
                      onChange={e => setForm({...form, description: e.target.value})} 
                      className="min-h-[60px] rounded-xl bg-accent/5 p-3 text-xs font-medium border-none focus:ring-1 focus:ring-accent" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-primary/5 border-b py-2 px-6">
                  <span className="text-[9px] text-primary font-black uppercase tracking-widest">Saldo e Inversión</span>
                </div>
                <CardContent className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-4">
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-primary uppercase">Stock Inicial *</Label>
                    <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-8 text-center text-lg font-black text-primary bg-primary/5 rounded-xl border-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Fardo (S/)</Label>
                    <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Al Mayor (S/)</Label>
                    <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] text-center block font-black text-accent/70 uppercase">Unidad (S/)</Label>
                    <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-8 text-center text-xs font-black rounded-xl border-accent/10" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-accent/5 py-3 px-6 flex justify-between items-center border-b">
                  <span className="text-[9px] font-black text-accent uppercase tracking-widest">Catálogo Visual</span>
                  <span className="text-[8px] bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">{localImagePreviews.length}/4</span>
                </div>
                <CardContent className="pt-4 grid grid-cols-2 gap-2 px-6">
                   {localImagePreviews.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-muted/30">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {localImagePreviews.length < 4 && (
                      <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-accent/20 flex flex-col items-center justify-center gap-1 text-accent bg-accent/5 hover:bg-accent/10 transition-colors">
                        <ImagePlus className="w-5 h-5 opacity-50" />
                        <span className="text-[8px] font-black uppercase opacity-50">Cargar</span>
                        <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                      </button>
                    )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button 
                  className="flex-1 h-16 text-lg font-headline shadow-lg rounded-2xl bg-gradient-to-tr from-primary to-accent text-white font-black hover:scale-[1.02] transition-transform" 
                  onClick={handleSave}
                  disabled={!isFormValid || saving}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {editId ? 'ACTUALIZAR' : 'REGISTRAR'}
                </Button>
                {editId && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-16 w-16 rounded-2xl border-destructive text-destructive hover:bg-destructive/5"
                    onClick={() => router.push('/inventory')}
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
            <div className="bg-accent/5 py-4 px-8 border-b">
              <span className="text-xs text-accent font-black uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Registro de Nuevo Stock
              </span>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Seleccionar Prenda Registrada</Label>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2 border rounded-xl p-2 bg-muted/10">
                  {allProducts.map(p => (
                    <div 
                      key={p.id} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group",
                        stockEntry.productCode === p.code ? "border-primary bg-primary/5" : "border-transparent hover:bg-white hover:border-accent/20"
                      )}
                      onClick={() => setStockEntry({...stockEntry, productCode: p.code})}
                    >
                      <div className="flex items-center gap-3">
                        <button 
                          className="w-8 h-8 rounded-lg overflow-hidden border border-accent/10 bg-white shrink-0 hover:scale-110 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.images?.[0]) setZoomedImage(p.images[0]);
                          }}
                        >
                           {p.images?.[0] ? (
                             <img src={getThumbnailUrl(p.images[0])} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             <div className="text-[7px] opacity-20 font-black">N/A</div>
                           )}
                        </button>
                        <div>
                          <div className="font-black text-xs text-primary group-hover:text-primary transition-colors">{p.code} - {p.name}</div>
                          <div className="flex gap-2 items-center mt-0.5">
                             <Badge variant="outline" className="text-[7px] h-3 px-1 border-accent/30 text-accent uppercase font-black">{p.category}</Badge>
                             <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">Saldo: {p.stock}</span>
                          </div>
                        </div>
                      </div>
                      {stockEntry.productCode === p.code && <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Cant. Ingreso</Label>
                  <Input 
                    type="number" 
                    value={stockEntry.quantity} 
                    onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} 
                    className="h-10 border-accent/20 rounded-xl text-lg font-black text-center text-primary"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-accent/70 tracking-widest ml-1">Tipo de Ingreso</Label>
                  <div className="h-10 flex items-center justify-center px-4 bg-accent/5 border border-accent/20 rounded-xl font-black text-[10px] text-accent uppercase tracking-widest">
                    REPOSICIÓN
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-14 text-lg font-black rounded-2xl bg-accent text-white shadow-lg hover:bg-accent/90 mt-2"
                onClick={handleAddStock}
                disabled={!stockEntry.productCode || !stockEntry.quantity || saving}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                CONFIRMAR REPOSICIÓN
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!zoomedImage} onOpenChange={(o) => !o && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center rounded-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle Visual</DialogTitle>
            <DialogDescription>Imagen de alta resolución de Drive</DialogDescription>
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
                alt="" 
                className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
