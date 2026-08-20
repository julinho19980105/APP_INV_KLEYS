
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
  DialogTrigger
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, Loader2, Sparkles, Edit3, Plus, Search, Eraser } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, limit, getDocs, increment, where } from "firebase/firestore"
import { uploadImageToDrive } from "@/services/sheets-service"
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

  const initialForm = { name: "", code: "", category: "", collection: "", description: "", stock: "", priceFardo: "", priceMayor: "", priceUnidad: "" }
  const [form, setForm] = React.useState(initialForm)
  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [manageType, setManageType] = React.useState<'category' | 'collection' | null>(null)
  const [newItemName, setNewItemName] = React.useState("")
  const [editingItem, setEditingItem] = React.useState<{id: string, name: string} | null>(null)
  const [stockSearchQuery, setStockSearchQuery] = React.useState("")

  const [stockEntry, setStockEntry] = React.useState({ productCode: "", quantity: "", reason: "Reposición de Mercadería" })

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
    if (!db || !isFormValid) return
    setSaving(true)
    const productCode = form.code.trim().toUpperCase()

    try {
      const uploadedImageUrls = await Promise.all(
        localImagePreviews.map(async (img, index) => {
          if (img.startsWith('http')) return img
          return await uploadImageToDrive(img, `${productCode}_${index}.jpg`)
        })
      )

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
        images: uploadedImageUrls,
        updatedAt: serverTimestamp()
      }

      await setDoc(doc(db, "products", productCode), productData, { merge: true })
      
      if (!editId) {
        await addDoc(collection(db, "movements"), {
          productCode, type: "in", quantity: Number(form.stock), reason: "Stock Inicial", timestamp: serverTimestamp()
        })
      }
      
      toast({ title: "Guardado" })
      router.push('/inventory')
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
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
        productCode: stockEntry.productCode, type: "in", quantity: Number(stockEntry.quantity), reason: stockEntry.reason, timestamp: serverTimestamp()
      })
      toast({ title: "Ingreso confirmado" })
      router.push('/inventory')
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const isFormValid = React.useMemo(() => {
    return form.name && form.category && form.collection && form.stock !== "" && !saving
  }, [form, saving])

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
                  <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Nombre Comercial *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 text-black border-black/10 rounded-xl font-black text-sm uppercase" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Categoría *</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger className="h-10 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Colección *</Label><Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}><SelectTrigger className="h-10 rounded-xl font-black text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{collectionsData.map(c => <SelectItem key={c.id} value={c.name} className="text-[10px] font-black">{c.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-0.5"><Label className="text-[9px] uppercase font-black ml-1">Observaciones (Normal)</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[80px] rounded-xl bg-black/5 p-4 text-xs font-normal border-none text-black" placeholder="Escriba aquí..." /></div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden"><CardContent className="pt-4 grid grid-cols-4 gap-4 px-6 pb-4"><div className="space-y-0.5"><Label className="text-[8px] block font-black uppercase text-center">Stock</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-10 text-center font-black rounded-xl border-primary/20 bg-primary/5 text-primary" /></div><div className="space-y-0.5"><Label className="text-[8px] block font-black uppercase text-center">Fardo</Label><Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl" /></div><div className="space-y-0.5"><Label className="text-[8px] block font-black uppercase text-center">Mayor</Label><Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl" /></div><div className="space-y-0.5"><Label className="text-[8px] block font-black uppercase text-center">Unidad</Label><Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-10 text-center text-xs font-black rounded-xl" /></div></CardContent></Card>
            </div>
            <div className="space-y-4">
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden"><CardContent className="pt-3 grid grid-cols-2 gap-2 px-6 pb-3">{localImagePreviews.map((img, idx) => (<div key={idx} className="relative aspect-square rounded-xl overflow-hidden border bg-muted/30"><img src={img} alt="" className="w-full h-full object-cover" /><button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white"><X className="w-3 h-3" /></button></div>))}{localImagePreviews.length < 4 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-1 bg-black/5"><ImagePlus className="w-5 h-5 opacity-40" /><span className="text-[8px] font-black uppercase opacity-40">Foto</span><input type="file" hidden ref={fileInputRef} onChange={e => {const f = e.target.files?.[0]; if(f){const r = new FileReader(); r.onloadend = () => setLocalImagePreviews(p => [...p, r.result as string]); r.readAsDataURL(f);}}} /></button>}</CardContent></Card>
              <Button className="w-full h-14 text-base rounded-2xl bg-black text-white font-black shadow-lg" onClick={handleSave} disabled={!isFormValid || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2 w-4 h-4" />} {editId ? 'ACTUALIZAR' : 'GUARDAR'}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="pt-2">
          <Card className="border shadow-sm bg-white rounded-[2rem] overflow-hidden max-w-xl mx-auto">
            <div className="bg-black/5 py-4 px-8 border-b font-black text-xs uppercase text-black">Reposición Industrial</div>
            <CardContent className="p-6 space-y-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" /><Input placeholder="DNI O NOMBRE..." value={stockSearchQuery} onChange={e => setStockSearchQuery(e.target.value)} className="pl-10 h-10 text-[11px] font-black uppercase rounded-xl" /></div>
              {filteredProductsForStock.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-xl">{filteredProductsForStock.map(p => (<div key={p.id} className={cn("p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between", stockEntry.productCode === p.code ? "border-primary bg-primary/5" : "hover:bg-black/5")} onClick={() => setStockEntry({...stockEntry, productCode: p.code})}><div className="flex flex-col"><span className="font-black text-xs text-black uppercase">{p.code} - {p.name}</span><span className="text-[8px] font-black uppercase text-black/40">Stock: {p.stock}</span></div></div>))}</div>
              )}
              {stockEntry.productCode && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2"><div className="grid grid-cols-2 gap-4"><div className="space-y-0.5"><Label className="text-[9px] font-black ml-1 uppercase">Cantidad</Label><Input type="number" value={stockEntry.quantity} onChange={e => setStockEntry({...stockEntry, quantity: e.target.value})} className="h-10 text-lg font-black text-center text-primary rounded-xl border-primary/20" /></div><div className="space-y-0.5"><Label className="text-[9px] font-black ml-1 uppercase">Motivo</Label><Input value={stockEntry.reason} onChange={e => setStockEntry({...stockEntry, reason: e.target.value})} className="h-10 text-[10px] font-black uppercase rounded-xl" /></div></div><Button className="w-full h-14 text-lg font-black rounded-2xl bg-black text-white" onClick={handleAddStock} disabled={!stockEntry.productCode || !stockEntry.quantity || saving}>{saving ? <Loader2 className="animate-spin" /> : "CONFIRMAR INGRESO"}</Button></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
