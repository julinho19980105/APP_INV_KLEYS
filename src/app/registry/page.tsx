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
  DialogTrigger
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, History, Loader2, Sparkles, Settings2, Edit3, Plus, AlertCircle, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, collection, query, orderBy, serverTimestamp, updateDoc, addDoc, limit, getDocs } from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { uploadImageToDrive } from "@/services/sheets-service"

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
  const { data: categories = [] } = useCollection(categoriesQuery)
  const { data: collectionsData = [] } = useCollection(collectionsQuery)

  const [form, setForm] = React.useState({
    name: "",
    code: "P-001",
    category: "",
    collection: "",
    description: "",
    stock: "",
    priceFardo: "",
    priceMayor: "",
    priceUnidad: "",
  })

  const [localImagePreviews, setLocalImagePreviews] = React.useState<string[]>([])
  const [manageType, setManageType] = React.useState<'category' | 'collection' | null>(null)
  const [newItemName, setNewItemName] = React.useState("")
  const [editingItem, setEditingItem] = React.useState<{id: string, name: string} | null>(null)

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
      // Subimos las imágenes a Drive y obtenemos las URLs reales
      const uploadedImageUrls = await Promise.all(
        localImagePreviews.map(async (img, index) => {
          if (img.startsWith('http')) return img; // Si ya es una URL de Drive, no re-subir
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

      const pRef = editId ? doc(db, "products", editId) : doc(collection(db, "products"))
      setDoc(pRef, productData, { merge: true })
        .then(() => {
          toast({ title: "Éxito", description: "Prenda registrada correctamente en Inventario y Drive." })
          router.push('/inventory')
        })
        .catch((serverError: any) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ 
            path: pRef.path, 
            operation: editId ? 'update' : 'create', 
            requestResourceData: productData 
          }));
        });
    } catch (error) {
      console.error("Error general al guardar:", error);
      toast({ variant: "destructive", title: "Error", description: "Hubo un problema al procesar las imágenes." })
    } finally {
      setSaving(false);
    }
  }

  const priceError = form.priceFardo && form.priceMayor && form.priceUnidad && 
    !(Number(form.priceFardo) < Number(form.priceMayor) && Number(form.priceMayor) < Number(form.priceUnidad))

  const isFormValid = form.name && form.category && form.collection && form.stock !== "" && !priceError && !saving

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            {editId ? 'Editar Prenda' : 'Nueva Prenda'}
            <Sparkles className="text-accent w-6 h-6" />
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Gestión de Inventario • Calidad Original</p>
        </div>
        <Button variant="outline" className="border-accent text-accent bg-white rounded-xl h-10 px-6 font-bold" onClick={() => router.push('/inventory')}>
          <History className="w-4 h-4 mr-2" /> Kardex
        </Button>
      </div>

      {priceError && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">
            REGLA DIVA: Fardo es menor que Mayor y Mayor es menor que Unidad
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5 border-b border-accent/10 py-6 flex flex-row items-center justify-between px-8">
              <CardTitle className="text-lg text-accent font-black uppercase tracking-widest">Datos Principales</CardTitle>
              <div className="bg-primary text-white px-8 py-3 rounded-2xl font-mono font-black text-3xl shadow-lg border-4 border-white">
                {form.code}
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 px-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent/70 tracking-widest ml-1">Nombre de Prenda *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-16 border-accent/20 rounded-2xl text-xl font-bold" placeholder="Ej: Polo Tommy Oversize" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70 tracking-widest ml-1">Categoría *</Label>
                  <div className="flex gap-2">
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger className="h-14 border-accent/20 rounded-2xl font-bold bg-white text-lg px-6">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name} className="rounded-xl">{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={manageType === 'category'} onOpenChange={(o) => setManageType(o ? 'category' : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-accent text-accent hover:bg-accent/10 shrink-0">
                          <Settings2 className="w-6 h-6" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm">Gestionar Categorías</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          <div className="flex gap-2">
                            <Input placeholder="Nueva categoría..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-12 rounded-xl" />
                            <Button className="bg-primary h-12 w-12 rounded-xl" onClick={handleAddItem}><Plus className="w-5 h-5" /></Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                            {categories.map(cat => (
                              <div key={cat.id} className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl border border-accent/10">
                                {editingItem?.id === cat.id ? (
                                  <div className="flex gap-2 w-full">
                                    <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-10 text-sm font-bold bg-white" />
                                    <Button size="icon" className="h-10 w-10 bg-green-500 text-white rounded-xl" onClick={handleRenameItem}><Check className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive rounded-xl" onClick={() => setEditingItem(null)}><X className="w-4 h-4" /></Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-bold text-accent">{cat.name}</span>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-accent rounded-xl hover:bg-white flex items-center gap-2" onClick={() => setEditingItem({id: cat.id, name: cat.name})}>
                                      <Edit3 className="w-3 h-3" /> Renombrar
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

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70 tracking-widest ml-1">Colección *</Label>
                  <div className="flex gap-2">
                    <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger className="h-14 border-accent/20 rounded-2xl font-bold bg-white text-lg px-6">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {collectionsData.map(col => (
                          <SelectItem key={col.id} value={col.name} className="rounded-xl">{col.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={manageType === 'collection'} onOpenChange={(o) => setManageType(o ? 'collection' : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-accent text-accent hover:bg-accent/10 shrink-0">
                          <Settings2 className="w-6 h-6" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm">Gestionar Colecciones</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          <div className="flex gap-2">
                            <Input placeholder="Nueva colección..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="h-12 rounded-xl" />
                            <Button className="bg-primary h-12 w-12 rounded-xl" onClick={handleAddItem}><Plus className="w-5 h-5" /></Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                            {collectionsData.map(col => (
                              <div key={col.id} className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl border border-accent/10">
                                {editingItem?.id === col.id ? (
                                  <div className="flex gap-2 w-full">
                                    <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-10 text-sm font-bold bg-white" />
                                    <Button size="icon" className="h-10 w-10 bg-green-500 text-white rounded-xl" onClick={handleRenameItem}><Check className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive rounded-xl" onClick={() => setEditingItem(null)}><X className="w-4 h-4" /></Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-bold text-accent">{col.name}</span>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-accent rounded-xl hover:bg-white flex items-center gap-2" onClick={() => setEditingItem({id: col.id, name: col.name})}>
                                      <Edit3 className="w-3 h-3" /> Renombrar
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

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-accent/70 tracking-widest ml-1">Descripción Estética</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[120px] border-accent/20 rounded-[2rem] bg-accent/5 p-6" placeholder="Detalles de tela, ajuste, etc." />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-primary/5 border-b border-primary/10 py-6 px-8">
              <CardTitle className="text-lg text-primary font-black uppercase tracking-widest">Stock y Tarifas Diva</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-8 px-8">
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-primary tracking-widest">CANTIDAD *</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-20 border-primary/20 text-center text-4xl font-black text-primary bg-primary/5 rounded-[1.5rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70 tracking-widest">FARDO (S/)</Label>
                <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-20 border-accent/20 text-center text-2xl font-black text-accent rounded-[1.5rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70 tracking-widest">AL MAYOR (S/)</Label>
                <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-20 border-accent/20 text-center text-2xl font-black text-accent rounded-[1.5rem]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-center block font-black text-accent/70 tracking-widest">UNIDAD (S/)</Label>
                <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-20 border-accent/20 text-center text-2xl font-black text-accent rounded-[1.5rem]" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-accent/5 py-6 px-8 flex justify-between flex-row items-center">
              <CardTitle className="text-sm font-black text-accent uppercase tracking-widest">Fotos Originales (Máx 4)</CardTitle>
              <span className="text-xs bg-accent text-white px-3 py-1 rounded-full font-bold">{localImagePreviews.length}/4</span>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 px-8">
               {localImagePreviews.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-accent/10 group shadow-md bg-muted">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setLocalImagePreviews(localImagePreviews.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {localImagePreviews.length < 4 && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-[2rem] border-4 border-dashed border-accent/20 flex flex-col items-center justify-center gap-2 text-accent bg-accent/5 hover:bg-accent/10 transition-all">
                    <ImagePlus className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Subir</span>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                  </button>
                )}
            </CardContent>
          </Card>

          <Button 
            className="w-full h-28 text-3xl font-headline shadow-2xl rounded-[3rem] bg-gradient-to-tr from-primary to-accent text-white font-black disabled:opacity-30 disabled:grayscale transition-all hover:scale-[1.02]" 
            onClick={handleSave}
            disabled={!isFormValid}
          >
            {saving ? <Loader2 className="w-10 h-10 animate-spin" /> : <Save className="w-8 h-8 mr-4" />}
            {editId ? 'ACTUALIZAR' : 'REGISTRAR'}
          </Button>
          
          <div className="p-8 bg-white/50 rounded-[2.5rem] border border-accent/10 text-center">
            <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em]">
              Guardado vía Google Drive. Calidad original garantizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

