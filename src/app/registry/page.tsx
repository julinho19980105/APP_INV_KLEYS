
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
  addDoc,
  deleteDoc,
  writeBatch
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
  
  const [saving, setSaving] = React.useState(false)
  const [nextId, setNextId] = React.useState("P-001")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const docRef = React.useMemo(() => (db && editId) ? doc(db, "products", editId) : null, [db, editId])
  const { data: editingProduct } = useDoc(docRef)
  
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
  
  const [isTagManagerOpen, setIsTagManagerOpen] = React.useState(false)
  const [tagManagerConfig, setTagManagerConfig] = React.useState<{ type: 'category' | 'collection', title: string }>({ type: 'category', title: '' })
  const [newTagName, setNewTagName] = React.useState("")
  const [editingTagName, setEditingTagName] = React.useState<{ id: string, name: string } | null>(null)

  const uniqueCategories = React.useMemo(() => {
    return Array.from(new Set(dbCategories.map(c => (c.name || '').toUpperCase()))).filter(Boolean).sort()
  }, [dbCategories])

  const uniqueCollections = React.useMemo(() => {
    return Array.from(new Set(dbCollections.map(c => (c.name || '').toUpperCase()))).filter(Boolean).sort()
  }, [dbCollections])

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
      const isNew = !editId;
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

      if (isNew && Number(form.stock) > 0) {
        addDoc(collection(db, "movements"), {
          productCode: productCode,
          type: "in",
          quantity: Number(form.stock),
          reason: "STOCK INICIAL AL REGISTRAR",
          timestamp: serverTimestamp()
        });
      }
      
      toast({ title: isNew ? "PRENDA REGISTRADA" : "PRENDA ACTUALIZADA" })
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

      try {
        const driveUrl = await uploadImageToDrive(base64, `${nextId}_${Date.now()}.jpg`);
        setImages(prev => {
          const newImgs = [...prev];
          newImgs[tempIdx] = driveUrl;
          return newImgs;
        });
      } catch (err: any) {
        setImages(prev => prev.filter((_, i) => i !== tempIdx));
        toast({ variant: "destructive", title: "Error al subir a Drive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newImages = [...images];
    const newIdx = direction === 'left' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const temp = newImages[index];
    newImages[index] = newImages[newIdx];
    newImages[newIdx] = temp;
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
      toast({ title: "Agregado correctamente" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleRenameTag = async () => {
    if (!db || !editingTagName || !editingTagName.name.trim()) return
    setSaving(true)
    const newName = editingTagName.name.toUpperCase().trim()
    const type = tagManagerConfig.type
    const collName = type === 'category' ? 'categories' : 'collections'

    try {
      await setDoc(doc(db, collName, editingTagName.id), { name: newName }, { merge: true })
      toast({ title: "Nombre actualizado" })
      setEditingTagName(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (!db) return
    if (!confirm("¿Eliminar de la lista maestra?")) return
    const collName = tagManagerConfig.type === 'category' ? 'categories' : 'collections'
    try {
      await deleteDoc(doc(db, collName, tagId))
      toast({ title: "Eliminado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const currentTagsList = tagManagerConfig.type === 'category' ? dbCategories : dbCollections

  return (
    <div className="max-w-6xl mx-auto space-y-4 pt-4 pb-24 px-2 md:px-0">
      <div className="flex justify-between items-center border-b-2 border-primary/10 pb-4 mb-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory')} className="h-10 w-10 rounded-xl hover:bg-primary/5">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Button>
          <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">Registro</h1>
        </div>
        <div className="bg-primary text-white px-6 py-1.5 rounded-xl font-black text-xl shadow-lg shadow-primary/20">{nextId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <CardContent className="space-y-6 pt-6 px-6 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black ml-1 text-primary tracking-widest">Nombre de Prenda *</Label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    className="h-12 border-primary/10 rounded-xl font-black text-sm uppercase shadow-sm" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Categoría *</Label>
                      <Settings2 className="w-3 h-3 text-primary/30 cursor-pointer" onClick={() => { setTagManagerConfig({ type: 'category', title: 'Categorías' }); setIsTagManagerOpen(true); }} />
                    </div>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger className="h-12 border-primary/10 rounded-xl font-black text-[10px] uppercase bg-white">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat} className="text-[10px] font-black uppercase">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Colección *</Label>
                      <Settings2 className="w-3 h-3 text-primary/30 cursor-pointer" onClick={() => { setTagManagerConfig({ type: 'collection', title: 'Colecciones' }); setIsTagManagerOpen(true); }} />
                    </div>
                    <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger className="h-12 border-primary/10 rounded-xl font-black text-[10px] uppercase bg-white">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueCollections.map(col => (
                          <SelectItem key={col} value={col} className="text-[10px] font-black uppercase">{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">Stock</Label>
                  <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="h-12 rounded-xl font-black text-center border-green-100 bg-green-50 text-green-700" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">P. Fardo</Label>
                  <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} className="h-12 rounded-xl font-black text-center border-orange-50 bg-orange-50 text-orange-600" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">P. Mayor</Label>
                  <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} className="h-12 rounded-xl font-black text-center border-orange-50 bg-orange-50 text-orange-600" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">P. Unidad</Label>
                  <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} className="h-12 rounded-xl font-black text-center border-orange-50 bg-orange-50 text-orange-600" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-1 text-primary">Descripción</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[100px] rounded-2xl bg-primary/5 p-4 text-xs font-medium border-none shadow-inner" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <div className="bg-primary/5 p-4 border-b border-primary/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-primary tracking-widest">Galería Drive</span>
              <span className="text-[9px] font-black text-primary/40">{images.length}/4</span>
            </div>
            <CardContent className="pt-4 grid grid-cols-2 gap-3 px-4 pb-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-primary/10 group bg-secondary shadow-sm">
                  <img src={getDriveThumb(img, 400)} className={cn("w-full h-full object-cover", img.startsWith('data:') && "opacity-40")} alt="Previa" />
                  
                  {img.startsWith('data:') ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-between p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        <button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="p-1.5 bg-destructive text-white rounded-lg shadow-lg">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex justify-center gap-1.5 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm">
                        <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'left'); }} disabled={idx === 0} className="text-white disabled:opacity-20"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'right'); }} disabled={idx === images.length - 1} className="text-white disabled:opacity-20"><ChevronRight className="w-5 h-5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {images.length < 4 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 bg-primary/5 hover:bg-primary/10 transition-all">
                  <ImagePlus className="w-6 h-6 text-primary" />
                  <span className="text-[8px] font-black uppercase text-primary/40">Foto</span>
                </button>
              )}
              <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
            </CardContent>
          </Card>

          <Button 
            className="h-16 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:opacity-95 active:scale-95 transition-all w-full" 
            onClick={handleSave} 
            disabled={saving || hasPendingUploads}
          >
            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="mr-2 w-5 h-5" />} 
            {editId ? "ACTUALIZAR" : "GUARDAR"}
          </Button>
        </div>
      </div>

      <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
        <DialogContent className="rounded-[2rem] max-w-xs p-6 border-none">
          <DialogHeader><DialogTitle className="text-xs font-black uppercase text-primary">{tagManagerConfig.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} className="h-10 text-[10px] font-black uppercase rounded-xl" placeholder="Nueva..." />
              <Button className="h-10 w-10 bg-primary rounded-xl shrink-0" onClick={handleAddNewTag}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {currentTagsList.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/5">
                  <span className="font-black text-[10px] uppercase">{tag.name}</span>
                  <div className="flex gap-1">
                    <Edit2 className="w-3 h-3 text-primary/40 cursor-pointer" onClick={() => setEditingTagName({ id: tag.id, name: tag.name })} />
                    <Trash2 className="w-3 h-3 text-destructive/40 cursor-pointer" onClick={() => handleRemoveTag(tag.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTagName} onOpenChange={() => setEditingTagName(null)}>
        <DialogContent className="rounded-[2rem] max-w-xs p-6 border-none">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-primary">Editar Nombre</Label>
            <Input value={editingTagName?.name || ''} onChange={e => setEditingTagName(prev => prev ? ({ ...prev, name: e.target.value }) : null)} className="h-10 text-[10px] font-black uppercase text-center" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-10 text-[9px] font-black uppercase" onClick={() => setEditingTagName(null)}>CANCELAR</Button>
              <Button className="bg-primary text-white rounded-xl h-10 text-[9px] font-black uppercase" onClick={handleRenameTag}>GUARDAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
