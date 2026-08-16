
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DialogFooter
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, History, Loader2, Sparkles, PlusCircle, Settings2, Edit3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection, useStorage } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, getDocs, where } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
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
  
  // Estados para diálogos de gestión
  const [newCategoryName, setNewCategoryName] = React.useState("")
  const [newCollectionName, setNewCollectionName] = React.useState("")
  const [renamingEntity, setRenamingEntity] = React.useState<{type: 'category' | 'collection', oldName: string, newName: string} | null>(null)

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

  // Validación de precios fardo < mayor < unidad
  React.useEffect(() => {
    const f = Number(form.priceFardo || 0)
    const m = Number(form.priceMayor || 0)
    const u = Number(form.priceUnidad || 0)

    if (f > 0 && m > 0 && f >= m) setPriceError("Fardo debe ser menor al Mayor")
    else if (m > 0 && u > 0 && m >= u) setPriceError("Mayor debe ser menor a Unidad")
    else setPriceError(null)
  }, [form.priceFardo, form.priceMayor, form.priceUnidad])

  // Listas únicas para el Select
  const categoriesList = React.useMemo(() => {
    const set = new Set(allProducts?.map(p => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [allProducts])

  const collectionsList = React.useMemo(() => {
    const set = new Set(allProducts?.map(p => p.collection).filter(Boolean))
    return Array.from(set).sort()
  }, [allProducts])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "Error", description: "Máximo 3MB por foto", variant: "destructive" })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setLocalImagePreviews(prev => [...prev, { file, url: reader.result as string }].slice(0, 4))
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImagesToStorage = async (): Promise<string[]> => {
    if (!storage) return []
    const urls: string[] = []
    
    for (const img of localImagePreviews) {
      if (img.file) {
        const storageRef = ref(storage, `products/${form.code || 'new'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`)
        const uploadTask = await uploadBytesResumable(storageRef, img.file)
        const downloadURL = await getDownloadURL(uploadTask.ref)
        urls.push(downloadURL)
      } else {
        urls.push(img.url)
      }
    }
    return urls
  }

  const handleRenameEntity = async () => {
    if (!db || !renamingEntity || !renamingEntity.newName.trim()) return
    
    setSaving(true)
    try {
      const q = query(
        collection(db, "products"), 
        where(renamingEntity.type, "==", renamingEntity.oldName)
      )
      const querySnapshot = await getDocs(q)
      const batchPromises = querySnapshot.docs.map(d => 
        updateDoc(d.ref, { [renamingEntity.type]: renamingEntity.newName.trim() })
      )
      await Promise.all(batchPromises)
      
      if (form[renamingEntity.type] === renamingEntity.oldName) {
        setForm({ ...form, [renamingEntity.type]: renamingEntity.newName.trim() })
      }
      
      toast({ title: "Actualizado", description: `Se actualizaron ${batchPromises.length} prendas.` })
      setRenamingEntity(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!db || !form.name || !form.category || !form.collection || !form.stock) {
      return // No debería pasar por el disabled, pero por seguridad
    }
    setSaving(true)
    
    try {
      const imageUrls = await uploadImagesToStorage()

      const productData = {
        name: form.name,
        code: form.code || `P-${Math.floor(Math.random() * 9000) + 1000}`,
        category: form.category,
        collection: form.collection,
        description: form.description,
        stock: Number(form.stock),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: imageUrls,
        updatedAt: serverTimestamp()
      }

      const pRef = editId ? doc(db, "products", editId) : doc(collection(db, "products"))
      await setDoc(pRef, productData, { merge: true })
      
      if (!editId) localStorage.removeItem(STORAGE_KEY)
      
      toast({ title: "Guardado", description: "La prenda se ha sincronizado con la nube Diva." })
      router.push('/inventory')
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const isFormValid = form.name && form.category && form.collection && form.stock

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            {editId ? 'Editar Prenda' : 'Nueva Prenda'}
            <Sparkles className="text-accent w-6 h-6" />
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Cloud Sync • Firestore Storage</p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="bg-accent text-white px-6 py-2 rounded-2xl font-mono font-black text-xl shadow-[0_10px_20px_rgba(135,184,212,0.3)] border-b-4 border-black/10">
            {form.code || "NUEVO"}
          </div>
          <Button variant="outline" className="border-accent text-accent bg-white rounded-xl h-9 text-xs" onClick={() => router.push('/inventory')}>
            <History className="w-4 h-4 mr-2" /> Inventario
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5 border-b border-accent/10 py-6">
              <CardTitle className="text-lg text-accent font-bold">Detalles de Moda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent/70 ml-1">Nombre Comercial *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-14 border-accent/20 rounded-2xl text-lg font-bold focus:ring-primary" placeholder="Ej: Vestido Gala Noche" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gestión de Categoría */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] uppercase font-black text-accent/70">Categoría *</Label>
                    {form.category && (
                       <button onClick={() => setRenamingEntity({type: 'category', oldName: form.category, newName: form.category})} className="text-[9px] text-primary font-black hover:underline flex items-center gap-1">
                         <Settings2 className="w-3 h-3" /> CONFIG
                       </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger className="h-12 border-accent/20 rounded-xl font-bold bg-white focus:ring-primary">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {categoriesList.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-accent text-accent hover:bg-accent/10">
                          <PlusCircle className="w-6 h-6" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm">Nueva Categoría</DialogTitle>
                        </DialogHeader>
                        <Input 
                          placeholder="Nombre (Ej: Blusas)" 
                          value={newCategoryName} 
                          onChange={e => setNewCategoryName(e.target.value)} 
                          className="rounded-xl border-accent/20 h-12 font-bold"
                        />
                        <DialogFooter>
                          <Button 
                            className="bg-primary rounded-xl w-full h-12 font-black" 
                            onClick={() => {
                              if(newCategoryName.trim()) {
                                setForm({...form, category: newCategoryName.trim()})
                                setNewCategoryName("")
                              }
                            }}
                          >AGREGAR</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Gestión de Colección */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] uppercase font-black text-accent/70">Colección *</Label>
                    {form.collection && (
                       <button onClick={() => setRenamingEntity({type: 'collection', oldName: form.collection, newName: form.collection})} className="text-[9px] text-primary font-black hover:underline flex items-center gap-1">
                         <Settings2 className="w-3 h-3" /> CONFIG
                       </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger className="h-12 border-accent/20 rounded-xl font-bold bg-white focus:ring-primary">
                        <SelectValue placeholder="Elegir..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {collectionsList.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-accent text-accent hover:bg-accent/10">
                          <PlusCircle className="w-6 h-6" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm">Nueva Colección</DialogTitle>
                        </DialogHeader>
                        <Input 
                          placeholder="Ej: Invierno 2025" 
                          value={newCollectionName} 
                          onChange={e => setNewCollectionName(e.target.value)} 
                          className="rounded-xl border-accent/20 h-12 font-bold"
                        />
                        <DialogFooter>
                          <Button 
                            className="bg-primary rounded-xl w-full h-12 font-black" 
                            onClick={() => {
                              if(newCollectionName.trim()) {
                                setForm({...form, collection: newCollectionName.trim()})
                                setNewCollectionName("")
                              }
                            }}
                          >AGREGAR</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent/70 ml-1">Descripción</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  className="min-h-[100px] border-accent/20 rounded-[1.5rem] bg-accent/5 focus:ring-primary font-medium" 
                  placeholder="Detalles sobre estilo, tela, calce..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg text-primary font-bold">Kardex y Valores</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-primary">STOCK *</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-16 border-primary/20 text-center text-3xl font-black text-primary bg-primary/5 rounded-2xl" placeholder="" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">FARDO (S/)</Label>
                <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-16 border-accent/20 text-center text-xl font-black text-accent rounded-2xl" placeholder="" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">MAYOR (S/)</Label>
                <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-16 border-accent/20 text-center text-xl font-black text-accent rounded-2xl" placeholder="" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70">UNIDAD (S/)</Label>
                <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-16 border-accent/20 text-center text-xl font-black text-accent rounded-2xl" placeholder="" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5">
              <CardTitle className="text-lg text-accent flex justify-between items-center font-bold">
                Fotos Diva
                <span className="text-xs bg-accent text-white px-3 py-1 rounded-full">{localImagePreviews.length}/4</span>
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
                    <span className="text-[9px] font-black uppercase">Subir</span>
                    <span className="text-[7px] opacity-60">MAX 3MB</span>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                  </button>
                )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {priceError && <div className="text-destructive text-[10px] font-bold text-center animate-pulse bg-destructive/10 py-2 rounded-xl border border-destructive/20 uppercase tracking-widest">{priceError}</div>}
            <Button 
              className="w-full h-24 text-2xl font-headline shadow-[0_20px_40px_rgba(255,0,127,0.3)] rounded-[2.5rem] bg-gradient-to-tr from-primary to-accent text-white font-black active:scale-95 transition-all" 
              onClick={handleSave}
              disabled={saving || !!priceError || !isFormValid}
            >
              {saving ? <Loader2 className="w-8 h-8 animate-spin" /> : <Save className="w-6 h-6 mr-3" />}
              {editId ? 'ACTUALIZAR' : 'GUARDAR PRENDA'}
            </Button>
          </div>
        </div>
      </div>

      {/* Ventana de Renombrar */}
      <Dialog open={!!renamingEntity} onOpenChange={() => setRenamingEntity(null)}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm">
              Renombrar {renamingEntity?.type === 'category' ? 'Categoría' : 'Colección'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-xs text-muted-foreground">Cambiando: <span className="font-bold text-foreground">{renamingEntity?.oldName}</span></div>
            <Input 
              value={renamingEntity?.newName || ""} 
              onChange={e => renamingEntity && setRenamingEntity({...renamingEntity, newName: e.target.value})}
              className="rounded-xl h-12 border-accent/20 font-bold"
              placeholder="Nuevo nombre..."
            />
          </div>
          <DialogFooter>
            <Button onClick={handleRenameEntity} className="bg-primary rounded-xl w-full h-12 font-black" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRMAR CAMBIO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
