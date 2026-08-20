
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
import { ImagePlus, X, Save, Loader2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, increment, getDocs } from "firebase/firestore"
import { uploadImageToDrive, syncCatalogToDrive } from "@/services/sheets-service"
import { cn } from "@/lib/utils"

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
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
  const categoriesQuery = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsQuery = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  
  const { data: categories = [] } = useCollection(categoriesQuery)
  const { data: collectionsData = [] } = useCollection(collectionsQuery)
  const { data: allProducts = [] } = useCollection(productsQuery)

  const [form, setForm] = React.useState({ name: "", code: "", category: "", collection: "", description: "", stock: "", priceFardo: "", priceMayor: "", priceUnidad: "" })
  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [stockSearchQuery, setStockSearchQuery] = React.useState("")
  const [stockEntry, setStockEntry] = React.useState({ productCode: "", quantity: "", reason: "Reposición Industrial" })

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

  const handleSave = async () => {
    if (!db || !form.name) return
    setSaving(true)
    const productCode = form.code.trim().toUpperCase()
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
      await setDoc(doc(db, "products", productCode), productData, { merge: true })
      
      // Sincronizar catálogo con Drive
      const updatedProducts = await getDocs(query(collection(db, "products")))
      const allProds = updatedProducts.docs.map(d => ({ id: d.id, ...d.data() }))
      await syncCatalogToDrive(allProds)
      
      toast({ title: "Guardado Correctamente", description: "Catálogo sincronizado con Drive." })
      router.push('/inventory')
    } catch (e) { toast({ variant: "destructive", title: "Error al Guardar" }) }
    finally { setSaving(false) }
  }

  const handleStockUpdate = async () => {
    if (!db || !stockEntry.productCode || !stockEntry.quantity) return
    setSaving(true)
    try {
      const qty = Number(stockEntry.quantity)
      await updateDoc(doc(db, "products", stockEntry.productCode), { stock: increment(qty), updatedAt: serverTimestamp() })
      await addDoc(collection(db, "movements"), { productCode: stockEntry.productCode, type: "in", quantity: qty, reason: stockEntry.reason.toUpperCase(), timestamp: serverTimestamp() })
      
      const updatedProducts = await getDocs(query(collection(db, "products")))
      const allProds = updatedProducts.docs.map(d => ({ id: d.id, ...d.data() }))
      await syncCatalogToDrive(allProds)
      
      toast({ title: "Stock Actualizado", description: "Sincronizado con Drive." })
      setStockEntry({ productCode: "", quantity: "", reason: "Reposición Industrial" })
      setStockSearchQuery("")
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
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
          <TabsTrigger value="new" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">Nueva Prenda</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl px-12 data-[state=active]:bg-black data-[state=active]:text-white text-xs font-black uppercase">Ingreso Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-black/5 border-b py-2 px-6 flex justify-between items-center">
                  <span className="text-[10px] text-black font-black uppercase">Ficha Técnica</span>
                  <div className="bg-black text-white px-4 py-0.5 rounded-lg font-black text-lg">{form.code || "..."}</div>
                </div>
                <CardContent className="space-y-4 pt-4 px-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Código de Modelo *</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-10 text-black border-black/10 rounded-xl font-black text-sm uppercase" disabled={!!editId} /></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Nombre Comercial *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} className="h-10 text-black border-black/10 rounded-xl font-black text-sm uppercase" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Categoría *</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger className="h-10 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Colección *</Label><Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}><SelectTrigger className="h-10 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{collectionsData.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Stock Inicial</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-10 rounded-xl font-black text-xs" /></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">P. Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-10 rounded-xl font-black text-xs" /></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">P. Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-10 rounded-xl font-black text-xs" /></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">P. Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-10 rounded-xl font-black text-xs" /></div>
                  </div>
                  <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Observaciones</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[80px] rounded-xl bg-black/5 p-4 text-xs font-normal border-none text-black" placeholder="Descripción libre..." /></div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardContent className="pt-3 grid grid-cols-2 gap-2 px-6 pb-3">
                  {localImagePreviews.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
                      <img src={img} className="w-full h-full object-cover" />
                      <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-1 bg-black/5">
                    <ImagePlus className="w-5 h-5" style={{ color: brandColor }} />
                    <span className="text-[8px] font-black uppercase opacity-40">Subir</span>
                  </button>
                  <input type="file" hidden ref={fileInputRef} onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = async () => {
                        const url = await uploadImageToDrive(r.result as string, `${form.code || 'PROD'}_${Date.now()}.jpg`);
                        setLocalImagePreviews(p => [...p, url]);
                      };
                      r.readAsDataURL(f);
                    }
                  }} />
                </CardContent>
              </Card>
              <Button className="w-full h-14 rounded-2xl bg-black text-white font-black" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2 w-4 h-4" />} GUARDAR</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border shadow-sm bg-white rounded-[2rem] max-w-xl mx-auto overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: brandColor }} />
                <Input placeholder="BUSCAR POR NOMBRE O CÓDIGO..." value={stockSearchQuery} onChange={e => setStockSearchQuery(e.target.value)} className="pl-10 h-10 text-[11px] font-black uppercase rounded-xl" />
              </div>
              <div className="space-y-2">
                {filteredProductsForStock.map(p => (
                  <div key={p.id} className="p-3 rounded-xl border flex justify-between items-center cursor-pointer hover:bg-black/5" onClick={() => setStockEntry({...stockEntry, productCode: p.code})}>
                    <div className="flex flex-col">
                      <span className="font-black text-xs text-black uppercase">{p.name}</span>
                      <span className="text-[8px] font-normal text-black/40 uppercase">{p.code}</span>
                    </div>
                    <span className="text-[10px] font-black" style={{ color: brandColor }}>STOCK: {p.stock}</span>
                  </div>
                ))}
              </div>
              {stockEntry.productCode && (
                <div className="pt-4 border-t space-y-4">
                  <div className="bg-black/5 p-4 rounded-xl flex justify-between items-center">
                    <span className="font-black text-xs uppercase text-black">{stockEntry.productCode}</span>
                    <span className="text-[10px] font-black text-black/40">PREPARADO PARA INGRESO</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Cantidad</Label><Input type="number" value={stockEntry.quantity} onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} className="h-10 rounded-xl font-black" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Motivo</Label><Input value={stockEntry.reason} onChange={e => setStockEntry({...stockEntry, reason: e.target.value})} className="h-10 rounded-xl font-black text-[10px] uppercase" /></div>
                  </div>
                  <Button className="w-full h-12 bg-black text-white font-black rounded-xl" onClick={handleStockUpdate} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : "PROCESAR INGRESO"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
