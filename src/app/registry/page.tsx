
"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  ImagePlus, 
  X, 
  Save, 
  Loader2, 
  Edit2,
  Plus,
  ArrowLeft,
  Settings2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  serverTimestamp, 
  getDocs, 
  limit, 
  writeBatch, 
  updateDoc, 
  addDoc,
  deleteDoc
} from "firebase/firestore"
import { uploadImageToDrive } from "@/services/sheets-service"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function getDriveThumb(url: string, size: number = 400) {
  if (!url) return "";
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!url.includes('drive.google.com')) return url;
  
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
  
  const [saving, setSaving] = React.useState(false)
  const [nextId, setNextId] = React.useState("P-001")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
  const productsQuery = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const { data: allProducts = [] } = useCollection(productsQuery)

  // NUEVAS CONSULTAS A COLECCIONES MAESTRAS
  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const collectionsRef = React.useMemo(() => db ? query(collection(db, "collections"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)
  const { data: dbCollections = [] } = useCollection(collectionsRef)

  const [form, setForm] = React.useState({ 
    name: "", 
    category: "", 
    collection: "", 
    description: "", 
    stock: "", 
    priceFardo: "", 
    priceMayor: "", 
    priceUnidad: "" 
  })
  
  const [images, setImages] = React.useState<string[]>([])
  const [uploadingIdx, setUploadingIdx] = React.useState<number | null>(null)
  
  const [isTagManagerOpen, setIsTagManagerOpen] = React.useState(false)
  const [tagManagerConfig, setTagManagerConfig] = React.useState<{ type: 'category' | 'collection', title: string }>({ type: 'category', title: '' })
  const [newTagName, setNewTagName] = React.useState("")
  const [editingTagName, setEditingTagName] = React.useState<{ id: string, name: string } | null>(null)

  // COMBINACIÓN DE DATOS MAESTROS CON PRODUCTOS EXISTENTES
  const uniqueCategories = React.useMemo(() => {
    const fromProducts = allProducts.map(p => (p.category || '').toUpperCase()).filter(Boolean)
    const fromMaster = dbCategories.map(c => (c.name || '').toUpperCase()).filter(Boolean)
    return Array.from(new Set([...fromProducts, ...fromMaster])).sort()
  }, [allProducts, dbCategories])

  const uniqueCollections = React.useMemo(() => {
    const fromProducts = allProducts.map(p => (p.collection || '').toUpperCase()).filter(Boolean)
    const fromMaster = dbCollections.map(c => (c.name || '').toUpperCase()).filter(Boolean)
    return Array.from(new Set([...fromProducts, ...fromMaster])).sort()
  }, [allProducts, dbCollections])

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
      setImages(editingProduct.images || [])
      setNextId(editingProduct.code)
    }
  }, [editingProduct])

  const hasPendingUploads = images.some(img => img.startsWith('data:'));

  const handleSave = async () => {
    if (!db || !form.name) return
    if (hasPendingUploads) {
      toast({ variant: "destructive", title: "ESPERE A QUE LAS FOTOS SUBAN A DRIVE" });
      return;
    }
    
    setSaving(true)
    const productCode = nextId.toUpperCase()
    try {
      const productData = {
        name: form.name.toUpperCase(),
        code: productCode,
        category: (form.category || "").toUpperCase(),
        collection: (form.collection || "").toUpperCase(),
        description: form.description,
        stock: Number(form.stock),
        priceFardo: Number(form.priceFardo || 0),
        priceMayor: Number(form.priceMayor || 0),
        priceUnidad: Number(form.priceUnidad || 0),
        images: images, 
        updatedAt: serverTimestamp()
      }
      
      await setDoc(doc(db, "products", productCode), productData, { merge: true })
      
      toast({ title: editId ? "PRENDA ACTUALIZADA" : "PRENDA REGISTRADA" })
      router.push('/inventory')
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al guardar en base de datos" }) 
    }
    finally { setSaving(false) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || images.length >= 4) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const tempIdx = images.length;
      
      setImages(prev => [...prev, base64]);
      setUploadingIdx(tempIdx);

      try {
        const driveUrl = await uploadImageToDrive(base64, `${nextId}_${Date.now()}.jpg`);
        
        setImages(prev => {
          const newImgs = [...prev];
          newImgs[tempIdx] = driveUrl;
          return newImgs;
        });
        toast({ title: "Imagen subida exitosamente" });
      } catch (err: any) {
        setImages(prev => prev.filter((_, i) => i !== tempIdx));
        toast({ 
          variant: "destructive", 
          title: "Error al subir a Drive",
          description: err.message || "Verifica la consola para más detalles."
        });
      } finally {
        setUploadingIdx(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newImages = [...images];
    const newIdx = direction === 'left' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    [newImages[index], newImages[newIdx]] = [newImages[newIdx], newImages[index]];
    setImages(newImages);
  };

  const handleAddNewTag = async () => {
    if (!db || !newTagName.trim()) return
    const tag = newTagName.toUpperCase().trim()
    const collectionName = tagManagerConfig.type === 'category' ? 'categories' : 'collections'
    try {
      await addDoc(collection(db, collectionName), {
        name: tag,
        createdAt: serverTimestamp()
      })
      setNewTagName("")
      toast({ title: "Agregado a la lista maestra" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleRenameTag = async () => {
    if (!db || !editingTagName || !editingTagName.name.trim()) return
    setSaving(true)
    const oldName = dbCategories.find(c => c.id === editingTagName.id)?.name || dbCollections.find(c => c.id === editingTagName.id)?.name
    const newName = editingTagName.name.toUpperCase().trim()
    const type = tagManagerConfig.type
    const collName = type === 'category' ? 'categories' : 'collections'

    try {
      const batch = writeBatch(db)
      
      // Actualizar en la colección maestra
      batch.update(doc(db, collName, editingTagName.id), { name: newName })

      // Actualizar en productos existentes (Opcional, pero recomendado para consistencia)
      const targetProducts = allProducts.filter(p => (p[type] || '').toUpperCase() === (oldName || '').toUpperCase())
      targetProducts.forEach(p => {
        batch.update(doc(db, "products", p.id), { [type]: newName, updatedAt: serverTimestamp() })
      })

      await batch.commit()
      toast({ title: "Cambio Global Exitoso" })
      setEditingTagName(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (!db) return
    if (!confirm("¿Desea eliminar esta etiqueta de la lista maestra?")) return
    const collName = tagManagerConfig.type === 'category' ? 'categories' : 'collections'
    try {
      await deleteDoc(doc(db, collName, tagId))
      toast({ title: "Eliminado de la lista" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const currentTagsList = tagManagerConfig.type === 'category' ? dbCategories : dbCollections

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4 pb-24 px-2 md:px-0">
      <div className="flex justify-between items-center border-b-2 border-primary/10 pb-6 mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory')} className="h-12 w-12 rounded-2xl hover:bg-primary/5">
            <ArrowLeft className="w-6 h-6 text-primary" />
          </Button>
          <h1 className="text-3xl font-headline font-black text-foreground uppercase tracking-tight">Registro</h1>
        </div>
        <div className="bg-primary text-white px-8 py-2 rounded-2xl font-black text-2xl shadow-xl shadow-primary/20">{nextId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
            <CardContent className="space-y-10 pt-10 px-10 pb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[11px] uppercase font-black ml-1 text-primary tracking-widest">Nombre de la Prenda *</Label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    placeholder=""
                    className="h-14 border-primary/10 rounded-2xl font-black text-base uppercase focus:ring-primary shadow-sm" 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1 pr-1">
                      <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Categoría *</Label>
                      <button 
                        className="text-primary/40 hover:text-primary transition-colors p-1" 
                        onClick={() => { setTagManagerConfig({ type: 'category', title: 'Gestionar Categorías' }); setIsTagManagerOpen(true); }}
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger className="h-14 border-primary/10 rounded-2xl font-black text-[12px] uppercase shadow-sm bg-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat} className="text-[11px] font-black uppercase">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1 pr-1">
                      <Label className="text-[11px] uppercase font-black text-primary tracking-widest">Colección *</Label>
                      <button 
                        className="text-primary/40 hover:text-primary transition-colors p-1" 
                        onClick={() => { setTagManagerConfig({ type: 'collection', title: 'Gestionar Colecciones' }); setIsTagManagerOpen(true); }}
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger className="h-14 border-primary/10 rounded-2xl font-black text-[12px] uppercase shadow-sm bg-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {uniqueCollections.map(col => (
                          <SelectItem key={col} value={col} className="text-[11px] font-black uppercase">{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">Stock</Label>
                  <Input 
                    type="number" 
                    value={form.stock} 
                    onChange={e => setForm({...form, stock: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-green-200 bg-green-50 text-green-700 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Fardo</Label>
                  <Input 
                    type="number" 
                    value={form.priceFardo} 
                    onChange={e => setForm({...form, priceFardo: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-100 bg-orange-50 text-orange-600 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Mayor</Label>
                  <Input 
                    type="number" 
                    value={form.priceMayor} 
                    onChange={e => setForm({...form, priceMayor: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-100 bg-orange-50 text-orange-600 shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-muted-foreground">P. Unidad</Label>
                  <Input 
                    type="number" 
                    value={form.priceUnidad} 
                    onChange={e => setForm({...form, priceUnidad: e.target.value})} 
                    className="h-14 rounded-2xl font-black text-lg text-center border-orange-100 bg-orange-50 text-orange-600 shadow-sm" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] uppercase font-black ml-1 text-primary tracking-widest">Descripción Estética</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  className="min-h-[120px] rounded-[2rem] bg-primary/5 p-6 text-sm font-medium border-none text-foreground focus:ring-primary shadow-inner" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-primary/5 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-primary tracking-widest">Galería Drive</span>
              <span className="text-[10px] font-black text-primary/40">{images.length} / 4 FOTOS</span>
            </div>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 px-6 pb-6">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-primary/5 shadow-md group bg-secondary">
                  <img src={getDriveThumb(img, 400)} className={cn("w-full h-full object-cover", img.startsWith('data:') && "opacity-50")} alt="Previa" />
                  
                  {img.startsWith('data:') ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => setImages(images.filter((_, i) => i !== idx))} 
                        className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      {/* CONTROLES DE ORDEN - MÓVIL AMIGABLE */}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {idx > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveImage(idx, 'left'); }}
                            className="bg-black/60 text-white p-2 rounded-xl hover:bg-black"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                        )}
                        {idx < images.length - 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveImage(idx, 'right'); }}
                            className="bg-black/60 text-white p-2 rounded-xl hover:bg-black"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {images.length < 4 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 bg-primary/5 hover:bg-primary/10 transition-all group">
                  <ImagePlus className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase text-primary/40">Agregar Foto</span>
                </button>
              )}
              <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {hasPendingUploads && (
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span className="text-[10px] font-black uppercase text-orange-700">Subiendo a Drive...</span>
              </div>
            )}
            <Button 
              className="h-20 rounded-[2.5rem] bg-primary text-white font-black text-xl shadow-2xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all w-full" 
              onClick={handleSave} 
              disabled={saving || hasPendingUploads}
            >
              {saving ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="mr-3 w-6 h-6" />} 
              {editId ? "ACTUALIZAR" : "GUARDAR"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-md overflow-hidden p-0">
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <DialogTitle className="text-sm font-black text-primary uppercase tracking-widest">{tagManagerConfig.title}</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary/40 ml-1">Agregar Nueva</Label>
              <div className="flex gap-2">
                <Input 
                  value={newTagName} 
                  onChange={e => setNewTagName(e.target.value)}
                  className="h-12 font-black uppercase border-primary/10 rounded-xl"
                />
                <Button className="h-12 w-12 rounded-xl bg-primary text-white shadow-lg" onClick={handleAddNewTag}>
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary/40 ml-1">Existentes en Lista Maestra</Label>
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                {currentTagsList.length > 0 ? currentTagsList.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/5">
                    <span className="font-black text-xs uppercase text-foreground">{tag.name}</span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-primary/40 hover:text-primary hover:bg-white"
                        onClick={() => setEditingTagName({ id: tag.id, name: tag.name })}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-destructive/40 hover:text-destructive hover:bg-white"
                        onClick={() => handleRemoveTag(tag.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 opacity-20 font-black text-[10px] uppercase">Lista vacía</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTagName} onOpenChange={() => setEditingTagName(null)}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-primary uppercase tracking-widest text-center">Corregir</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 ml-1">Nuevo Nombre</Label>
              <Input 
                value={editingTagName?.name || ''} 
                onChange={e => setEditingTagName(prev => prev ? ({ ...prev, name: e.target.value.toUpperCase() }) : null)}
                className="h-14 font-black uppercase text-center border-primary/10 rounded-2xl shadow-inner"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-14 rounded-2xl font-black text-[10px] uppercase" onClick={() => setEditingTagName(null)}>CANCELAR</Button>
              <Button className="h-14 rounded-2xl bg-primary text-white font-black text-[10px] uppercase" onClick={handleRenameTag} disabled={saving || !editingTagName?.name.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : "CAMBIAR TODO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
