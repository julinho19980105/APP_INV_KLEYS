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
import { ImagePlus, X, Save, Loader2, Search, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, increment, getDocs, limit } from "firebase/firestore"
import { uploadImageToDrive, syncCatalogToDrive } from "@/services/sheets-service"
import { cn } from "@/lib/utils"

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
  
  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  
  const { data: categories = [] } = useCollection(categoriesQuery)
  const { data: collectionsData = [] } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)

  const [form, setForm] = React.useState({ name: "", category: "", collection: "", description: "", stock: "", priceFardo: "", priceMayor: "", priceUnidad: "" })
  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [stockSearchQuery, setStockSearchQuery] = React.useState("")
  const [stockEntry, setStockEntry] = React.useState({ productCode: "", quantity: "", reason: "Reposición Industrial" })

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
        category: editingProduct.category || "",
        collection: editingProduct.collection || "",
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
        category: form.category,
        collection: form.collection,
        description: form.description,
        stock: Number(form.stock),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: localImagePreviews,
        updatedAt: serverTimestamp()
      }
      
      // GUARDAR EN FIREBASE (Prioridad absoluta)
      await setDoc(doc(db, "products", productCode), productData, { merge: true })
      
      toast({ title: editId ? "PRENDA ACTUALIZADA" : "PRENDA REGISTRADA" })
      
      // SINCRONIZACIÓN NO BLOQUEANTE (Si falla Drive, el producto ya está en Firebase)
      setTimeout(async () => {
        try {
          const updatedSnap = await getDocs(query(collection(db, "products")))
          const allProds = updatedSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          await syncCatalogToDrive(allProds)
        } catch (syncErr) {
          console.warn("Fallo sincronización Drive, se requiere manual desde Inventario.")
        }
      }, 500)
      
      router.push('/inventory')
    } catch (e) { 
      console.error(e)
      toast({ variant: "destructive", title: "Error en el Sistema", description: "No se pudo guardar en la base de datos." }) 
    }
    finally { setSaving(false) }
  }

  const handleStockUpdate = async () => {
    if (!db || !stockEntry.productCode || !stockEntry.quantity) return
    setSaving(true)
    try {
      const qty = Number(stockEntry.quantity)
      await updateDoc(doc(db, "products", stockEntry.productCode), { stock: increment(qty), updatedAt: serverTimestamp() })
      await addDoc(collection(db, "movements"), { productCode: stockEntry.productCode, type: "in", quantity: qty, reason: stockEntry.reason.toUpperCase(), timestamp: serverTimestamp() })
      
      toast({ title: "Stock Actualizado" })
      setStockEntry({ productCode: "", quantity: "", reason: "Reposición Industrial" })
      setStockSearchQuery("")
      
      // Sincronización en segundo plano
      setTimeout(async () => {
        try {
          const updatedSnap = await getDocs(query(collection(db, "products")))
          const allProds = updatedSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          await syncCatalogToDrive(allProds)
        } catch (e) {}
      }, 500)
    } catch (e) { toast({ variant: "destructive", title: "Error al actualizar stock" }) }
    finally { setSaving(false) }
  }

  const filteredProductsForStock = React.useMemo(() => {
    if (stockSearchQuery.length < 2) return []
    const q = stockSearchQuery.toLowerCase()
    return allProducts.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
  }, [allProducts, stockSearchQuery])

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-2 pb-24 px-2 md:px-0">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full justify-start border">
          <TabsTrigger value="new" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">Ficha Técnica</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">Ingreso Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-black/5 border-b py-3 px-6 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5" style={{ color: brandColor }} />
                    <span className="text-[10px] text-black font-black uppercase tracking-widest">Información de Producto</span>
                  </div>
                  <div className="bg-black text-white px-6 py-1 rounded-xl font-black text-xl shadow-lg">{nextId}</div>
                </div>
                <CardContent className="space-y-6 pt-6 px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-black ml-1 text-black/60">Nombre Comercial *</Label>
                      <Input value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} className="h-12 border-black/10 rounded-xl font-black text-sm uppercase" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black ml-1 text-black/60">Categoría *</Label>
                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                          <SelectTrigger className="h-12 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black ml-1 text-black/60">Colección *</Label>
                        <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                          <SelectTrigger className="h-12 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                          <SelectContent>{collectionsData.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black ml-1 text-black/60">Stock</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-12 rounded-xl font-black text-sm" /></div>
                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black ml-1 text-black/60">P. Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-12 rounded-xl font-black text-sm" /></div>
                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black ml-1 text-black/60">P. Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-12 rounded-xl font-black text-sm" /></div>
                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black ml-1 text-black/60">P. Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-12 rounded-xl font-black text-sm" /></div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-black ml-1 text-black/60">Observaciones</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[100px] rounded-2xl bg-black/5 p-4 text-xs font-normal border-none text-black" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardContent className="pt-3 grid grid-cols-2 gap-2 px-6 pb-3">
                  {localImagePreviews.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
                      <img src={getDriveThumb(img, 400)} className="w-full h-full object-cover" alt="Previa" />
                      <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-1 bg-black/5">
                    <ImagePlus className="w-6 h-6" style={{ color: brandColor }} />
                    <span className="text-[8px] font-black uppercase opacity-40">Subir Foto</span>
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
              <div className="flex gap-2">
                {editId && (
                  <Button variant="outline" className="h-16 w-20 rounded-2xl border-destructive/20 text-destructive bg-destructive/5" onClick={() => router.push('/inventory')}>
                    <X className="w-6 h-6" />
                  </Button>
                )}
                <Button className="flex-1 h-16 rounded-2xl bg-black text-white font-black text-base shadow-xl" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-3 w-5 h-5" />} {editId ? "ACTUALIZAR" : "GUARDAR"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border shadow-sm bg-white rounded-[2.5rem] max-w-xl mx-auto overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: brandColor }} />
                <Input placeholder="BUSCAR PRENDA..." value={stockSearchQuery} onChange={e => setStockSearchQuery(e.target.value)} className="pl-12 h-14 font-black uppercase rounded-2xl border-black/10" />
              </div>
              <div className="space-y-3">
                {filteredProductsForStock.map(p => (
                  <div key={p.id} className="p-4 rounded-2xl border flex justify-between items-center cursor-pointer hover:bg-black/5" onClick={() => setStockEntry({...stockEntry, productCode: p.code})}>
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase">{p.name}</span>
                      <span className="text-[9px] font-black text-black/40 uppercase">{p.code}</span>
                    </div>
                    <div className="bg-black text-white px-4 py-1 rounded-xl text-[10px] font-black">ACTUAL: {p.stock}</div>
                  </div>
                ))}
              </div>
              {stockEntry.productCode && (
                <div className="pt-6 border-t-2 border-black/5 space-y-6">
                  <div className="bg-black text-white p-5 rounded-2xl flex justify-between items-center">
                    <span className="font-black text-base uppercase">{stockEntry.productCode}</span>
                    <span className="text-[10px] font-black opacity-60 uppercase">Reposición</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black/60 ml-2">Cantidad</Label><Input type="number" value={stockEntry.quantity} onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} className="h-12 rounded-xl font-black text-center text-lg" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black/60 ml-2">Motivo</Label><Input value={stockEntry.reason} onChange={e => setStockEntry({...stockEntry, reason: e.target.value})} className="h-12 rounded-xl font-black text-[10px] uppercase" /></div>
                  </div>
                  <Button className="w-full h-16 bg-black text-white font-black rounded-2xl shadow-xl" onClick={handleStockUpdate} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : "CONFIRMAR INGRESO"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
