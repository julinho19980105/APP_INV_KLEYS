
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImagePlus, X, Save, History, Loader2, Sparkles, PlusCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection, useStorage } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Image from "next/image"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "stilostack_registry_draft"

export default function RegistryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('edit')
  const db = useFirestore()
  const storage = useStorage()
  const { toast } = useToast()
  
  const [saving, setSaving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("updatedAt", "desc")) : null, [db])
  const { data: allProducts } = useCollection(productsQuery)

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

  const [localImagePreviews, setLocalImagePreviews] = React.useState<{file?: File, url: string}[]>([])
  const [priceError, setPriceError] = React.useState<string | null>(null)

  // Cargar borrador o datos de edición
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
      setLocalImagePreviews((editingProduct.images || []).map((url: string) => ({ url })))
    } else {
      const draft = localStorage.getItem(STORAGE_KEY)
      if (draft && !editId) {
        setForm(JSON.parse(draft))
      }
    }
  }, [editingProduct, editId])

  // Persistir borrador
  React.useEffect(() => {
    if (!editId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    }
  }, [form, editId])

  // Validación de precios
  React.useEffect(() => {
    const f = Number(form.priceFardo || 0)
    const m = Number(form.priceMayor || 0)
    const u = Number(form.priceUnidad || 0)

    if (f > 0 && m > 0 && f >= m) setPriceError("Fardo debe ser menor al Mayor")
    else if (m > 0 && u > 0 && m >= u) setPriceError("Mayor debe ser menor a Unidad")
    else setPriceError(null)
  }, [form.priceFardo, form.priceMayor, form.priceUnidad])

  // Listas dinámicas
  const categories = React.useMemo(() => {
    const set = new Set(allProducts?.map(p => p.category).filter(Boolean))
    return Array.from(set)
  }, [allProducts])

  const collections = React.useMemo(() => {
    const set = new Set(allProducts?.map(p => p.collection).filter(Boolean))
    return Array.from(set)
  }, [allProducts])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "Error", description: "Límite 3MB por foto", variant: "destructive" })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setLocalImagePreviews(prev => [...prev, { file, url: reader.result as string }].slice(0, 4))
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImages = async (): Promise<string[]> => {
    if (!storage) return []
    const urls: string[] = []
    
    for (const img of localImagePreviews) {
      if (img.file) {
        const storageRef = ref(storage, `products/${form.code || 'temp'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
        await uploadBytesResumable(storageRef, img.file)
        const downloadURL = await getDownloadURL(storageRef)
        urls.push(downloadURL)
      } else {
        urls.push(img.url)
      }
    }
    return urls
  }

  const handleSave = async () => {
    if (!db || !form.name || !form.code) {
      toast({ title: "Faltan datos", description: "Nombre y Código son obligatorios", variant: "destructive" })
      return
    }
    setSaving(true)
    
    try {
      const imageUrls = await uploadImages()

      const productData = {
        name: form.name,
        code: form.code,
        category: form.category,
        collection: form.collection,
        description: form.description,
        stock: Number(form.stock || 0),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: imageUrls,
        updatedAt: serverTimestamp()
      }

      const pRef = editId ? doc(db, "products", editId) : doc(collection(db, "products"))
      
      await setDoc(pRef, productData, { merge: true })
      
      localStorage.removeItem(STORAGE_KEY)
      toast({ title: "Éxito", description: "Producto guardado en la nube." })
      router.push('/inventory')
    } catch (e: any) {
      toast({ title: "Error", description: "No se pudo guardar: " + e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            {editId ? 'Editar Prenda' : 'Registrar Prenda'}
            <Sparkles className="text-accent w-6 h-6" />
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Almacenamiento en Firebase Storage</p>
        </div>
        <Button variant="outline" className="border-accent text-accent bg-white rounded-xl" onClick={() => router.push('/inventory')}>
          <History className="w-4 h-4 mr-2" /> Ver Inventario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5 border-b border-accent/10 py-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-accent font-bold">Información Básica</CardTitle>
                <div className="bg-accent text-white px-5 py-1.5 rounded-full font-mono font-black text-sm">{form.code || "NUEVO"}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">Nombre de Prenda *</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-12 border-accent/20 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">Código de Referencia *</Label>
                  <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-12 border-accent/20 rounded-xl font-mono" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">Categoría</Label>
                  <div className="relative">
                    <Input 
                      value={form.category} 
                      onChange={e => setForm({...form, category: e.target.value})} 
                      className="h-12 border-accent/20 rounded-xl pr-10" 
                      placeholder="Nueva o selecciona..."
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setForm({...form, category: cat})} className="text-[8px] bg-accent/10 px-1 rounded hover:bg-accent/20">{cat}</button>
                      )).slice(0, 2)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">Colección</Label>
                  <Input value={form.collection} onChange={e => setForm({...form, collection: e.target.value})} className="h-12 border-accent/20 rounded-xl" placeholder="Verano, Invierno..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent/70">Descripción Estética</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[120px] border-accent/20 rounded-[1.5rem] bg-accent/5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg text-primary font-bold">Gestión de Precios Diva</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-primary">STOCK</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-14 border-primary/20 text-center text-2xl font-black text-primary bg-primary/5 rounded-[1.25rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">FARDO (S/)</Label>
                <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-14 border-accent/20 text-center text-xl font-black text-accent rounded-[1.25rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">MAYOR (S/)</Label>
                <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-14 border-accent/20 text-center text-xl font-black text-accent rounded-[1.25rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">UNIDAD (S/)</Label>
                <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-14 border-accent/20 text-center text-xl font-black text-accent rounded-[1.25rem]" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5">
              <CardTitle className="text-lg text-accent flex justify-between items-center font-bold">
                Galería
                <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">{localImagePreviews.length}/4</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               {localImagePreviews.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border-2 border-accent/10 group shadow-lg">
                    <Image src={img.url} alt="" fill className="object-cover" />
                    <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {localImagePreviews.length < 4 && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-[1.5rem] border-4 border-dashed border-accent/20 flex flex-col items-center justify-center gap-3 text-accent hover:border-primary/50 transition-all bg-accent/5">
                    <ImagePlus className="w-7 h-7" />
                    <span className="text-[8px] font-black uppercase">Subir (3MB)</span>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                  </button>
                )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {priceError && <div className="text-destructive text-xs font-bold text-center animate-pulse bg-destructive/10 py-2 rounded-xl border border-destructive/20">{priceError}</div>}
            <Button 
              className="w-full h-20 text-xl font-headline shadow-2xl rounded-[2.5rem] bg-gradient-to-tr from-primary to-accent text-white font-black" 
              onClick={handleSave}
              disabled={saving || !!priceError || !form.name || !form.code}
            >
              {saving ? <Loader2 className="w-8 h-8 animate-spin" /> : <Save className="w-6 h-6 mr-3" />}
              {editId ? 'ACTUALIZAR NUBE' : 'GUARDAR PRENDA'}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-accent font-bold"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY)
                setForm({
                  name: "", code: "", category: "", collection: "", description: "", stock: "", priceFardo: "", priceMayor: "", priceUnidad: ""
                })
                setLocalImagePreviews([])
              }}
            >
              Limpiar Borrador
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
