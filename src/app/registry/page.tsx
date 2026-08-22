
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
  ImagePlus, 
  X, 
  Save, 
  Loader2, 
  Search, 
  Package,
  Heart
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, increment, getDocs, limit } from "firebase/firestore"
import { uploadImageToDrive, syncCatalogToDrive } from "@/services/sheets-service"

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
  const [stockSearchQuery, setStockSearchQuery] = React.useState("")
  const [stockEntry, setStockEntry] = React.useState({ productCode: "", quantity: "", reason: "Reposición Industrial" })

  const uniqueCategories = React.useMemo(() => Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))), [allProducts])
  const uniqueCollections = React.useMemo(() => Array.from(new Set(allProducts.map(p => p.collection).filter(Boolean))), [allProducts])

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
        category: form.category.toUpperCase(),
        collection: form.collection.toUpperCase(),
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

  const handleStockUpdate = async () => {
    if (!db || !stockEntry.productCode || !stockEntry.quantity) return
    setSaving(true)
    try {
      const qty = Number(stockEntry.quantity)
      await updateDoc(doc(db, "products", stockEntry.productCode), { 
        stock: increment(qty), 
        updatedAt: serverTimestamp() 
      })
      await addDoc(collection(db, "movements"), { 
        productCode: stockEntry.productCode, 
        type: "in", 
        quantity: qty, 
        reason: stockEntry.reason.toUpperCase(), 
        timestamp: serverTimestamp() 
      })
      
      toast({ title: "STOCK ACTUALIZADO" })
      setStockEntry({ productCode: "", quantity: "", reason: "Reposición Industrial" })
      setStockSearchQuery("")
    } catch (e) { toast({ variant: "destructive", title: "Error al actualizar stock" }) }
    finally { setSaving(false) }
  }

  const filteredProductsForStock = React.useMemo(() => {
    if (stockSearchQuery.length < 2) return []
    const q = stockSearchQuery.toLowerCase()
    return allProducts.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
  }, [allProducts, stockSearchQuery])

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4 pb-24 px-2 md:px-0">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-secondary p-1 rounded-[1.5rem] w-full justify-start border-none mb-4 shadow-sm">
          <TabsTrigger value="new" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] font-black uppercase">Ficha de Prenda</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-12 data-[state=active]:bg-primary data-[state=active]:text-white text-[11px] font-black uppercase">Entrada a Almacén</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                <div className="bg-secondary/50 border-b border-primary/5 py-4 px-8 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-primary" />
                    <span className="text-[11px] text-primary font-black uppercase tracking-widest">Detalles de Producto</span>
                  </div>
                  <div className="bg-primary text-white px-8 py-1.5 rounded-2xl font-black text-2xl shadow-lg shadow-primary/20">{nextId}</div>
                </div>
                <CardContent className="space-y-8 pt-8 px-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Nombre Comercial *</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} className="h-12 border-primary/10 rounded-2xl font-black text-sm uppercase focus:ring-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Categoría *</Label>
                        <Input list="categories" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="h-12 border-primary/10 rounded-2xl font-black text-[11px] uppercase" />
                        <datalist id="categories">
                          {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Colección *</Label>
                        <Input list="collections" value={form.collection} onChange={e => setForm({...form, collection: e.target.value})} className="h-12 border-primary/10 rounded-2xl font-black text-[11px] uppercase" />
                        <datalist id="collections">
                          {uniqueCollections.map(col => <option key={col} value={col} />)}
                        </datalist>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Stock</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-12 rounded-2xl font-black text-sm border-primary/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-12 rounded-2xl font-black text-sm border-primary/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-12 rounded-2xl font-black text-sm border-primary/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-12 rounded-2xl font-black text-sm border-primary/10" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Descripción Estética</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[120px] rounded-[1.5rem] bg-secondary/50 p-5 text-sm font-medium border-none text-foreground focus:ring-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                <CardContent className="pt-4 grid grid-cols-2 gap-3 px-6 pb-4">
                  {localImagePreviews.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-primary/5 shadow-sm">
                      <img src={getDriveThumb(img, 400)} className="w-full h-full object-cover" alt="Previa" />
                      <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-1.5 bg-destructive rounded-full text-white shadow-md hover:scale-110 transition-transform"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                    <ImagePlus className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black uppercase text-primary/40">Agregar Foto</span>
                  </button>
                  <input type="file" hidden ref={fileInputRef} onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = async () => {
                        const url = await uploadImageToDrive(r.result as string, `${nextId}_${Date.now()}.jpg`);
                        setLocalImagePreviews(p => [...p, url]);
                      };
                      r.readAsDataURL(f);
                    }
                  }} />
                </CardContent>
              </Card>
              <div className="flex gap-4">
                {editId && (
                  <Button variant="outline" className="h-16 w-20 rounded-2xl border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-white transition-all shadow-md" onClick={() => router.push('/inventory')}>
                    <X className="w-6 h-6" />
                  </Button>
                )}
                <Button className="flex-1 h-16 rounded-[1.5rem] bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-3 w-5 h-5" />} {editId ? "ACTUALIZAR" : "GUARDAR FICHA"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] max-w-xl mx-auto overflow-hidden">
            <CardContent className="p-10 space-y-8">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: brandColor }} />
                <Input placeholder="BUSCAR POR NOMBRE O CÓDIGO..." value={stockSearchQuery} onChange={e => setStockSearchQuery(e.target.value)} className="pl-14 h-16 font-black uppercase rounded-3xl border-primary/10 shadow-sm focus:ring-primary" />
              </div>
              <div className="space-y-4">
                {filteredProductsForStock.map(p => (
                  <div key={p.id} className="p-5 rounded-3xl border border-primary/5 flex justify-between items-center cursor-pointer hover:bg-primary/5 transition-all group" onClick={() => setStockEntry({...stockEntry, productCode: p.code})}>
                    <div className="flex flex-col">
                      <span className="font-black text-base uppercase tracking-tight group-hover:text-primary transition-colors">{p.name}</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{p.code}</span>
                    </div>
                    <div className="bg-secondary text-primary px-5 py-2 rounded-2xl text-[11px] font-black border border-primary/10">ACTUAL: {p.stock}</div>
                  </div>
                ))}
              </div>
              {stockEntry.productCode && (
                <div className="pt-8 border-t border-primary/5 space-y-8 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-primary text-white p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-primary/20">
                    <span className="font-black text-xl uppercase">{stockEntry.productCode}</span>
                    <Heart className="w-6 h-6 fill-current" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-muted-foreground ml-3">Cantidad</Label><Input type="number" value={stockEntry.quantity} onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} className="h-14 rounded-2xl font-black text-center text-xl border-primary/10" /></div>
                    <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-muted-foreground ml-3">Motivo</Label><Input value={stockEntry.reason} onChange={e => setStockEntry({...stockEntry, reason: e.target.value})} className="h-14 rounded-2xl font-black text-[11px] uppercase border-primary/10" /></div>
                  </div>
                  <Button className="w-full h-18 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 text-lg uppercase tracking-widest hover:opacity-90 active:scale-95" onClick={handleStockUpdate} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : "CONFIRMAR INGRESO"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
