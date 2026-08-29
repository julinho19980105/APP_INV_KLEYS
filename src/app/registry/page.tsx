
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
  updateDoc,
  increment
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
  const dbCategories = useCollection(categoriesRef).data
  const dbCollections = useCollection(collectionsRef).data

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

  React.useEffect(() => {
    const hasUnsavedChanges = form.name !== "" || images.length > 0;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.name, images.length, saving]);

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
        stock: (editingProduct.baseStock !== undefined ? editingProduct.baseStock : (editingProduct.stock || 0)).toString(),
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
      const inputBaseStock = Number(form.stock);
      
      if (isNew) {
        const productData = {
          name: form.name.toUpperCase(),
          code: productCode,
          category: (form.category || "").toUpperCase(),
          collection: (form.collection || "").toUpperCase(),
          description: form.description,
          stock: inputBaseStock,
          baseStock: inputBaseStock,
          priceFardo: Number(form.priceFardo || 0),
          priceMayor: Number(form.priceMayor || 0),
          priceUnidad: Number(form.priceUnidad || 0),
          images: images, 
          updatedAt: serverTimestamp()
        }
        await setDoc(doc(db, "products", productCode), productData)
        
        if (inputBaseStock > 0) {
          await addDoc(collection(db, "movements"), {
            productCode: productCode,
            type: "in",
            quantity: inputBaseStock,
            reason: "STOCK INICIAL AL REGISTRAR",
            timestamp: serverTimestamp()
          });
        }
      } else {
        const oldBaseStock = editingProduct.baseStock !== undefined ? editingProduct.baseStock : editingProduct.stock;
        const delta = inputBaseStock - oldBaseStock;

        const updateData: any = {
          name: form.name.toUpperCase(),
          category: (form.category || "").toUpperCase(),
          collection: (form.collection || "").toUpperCase(),
          description: form.description,
          baseStock: inputBaseStock,
          stock: increment(delta),
          priceFardo: Number(form.priceFardo || 0),
          priceMayor: Number(form.priceMayor || 0),
          priceUnidad: Number(form.priceUnidad || 0),
          images: images, 
          updatedAt: serverTimestamp()
        }
        await updateDoc(doc(db, "products", productCode), updateData)

        if (delta !== 0) {
          await addDoc(collection(db, "movements"), {
            productCode: productCode,
            type: delta > 0 ? "in" : "out",
            quantity: Math.abs(delta),
            reason: "AJUSTE DE STOCK BASE",
            timestamp: serverTimestamp()
          });
        }
      }
      
      toast({ title: isNew ? "PRENDA REGISTRADA" : "PRENDA ACTUALIZADA" })
      router.push('/inventory')
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al guardar" }) 
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
      await addDoc(collection(db, collectionName), { name: tag, createdAt: serverTimestamp() })
      setNewTagName("")
    } catch (e) {}
  }

  const handleRenameTag = async () => {
    if (!db || !editingTagName || !editingTagName.name.trim()) return
    const newName = editingTagName.name.toUpperCase().trim()
    const collName = tagManagerConfig.type === 'category' ? 'categories' : 'collections'
    try {
      await updateDoc(doc(db, collName, editingTagName.id), { name: newName })
      setEditingTagName(null)
    } catch (e) {}
  }

  const handleRemoveTag = async (tagId: string) => {
    if (!db || !confirm("¿Eliminar?")) return
    const collName = tagManagerConfig.type === 'category' ? 'categories' : 'collections'
    try {
      await deleteDoc(doc(db, collName, tagId))
    } catch (e) {}
  }

  const currentTagsList = tagManagerConfig.type === 'category' ? dbCategories : dbCollections

  return (
    <div className="max-w-6xl mx-auto space-y-2 pt-1 pb-24 px-2 md:px-0">
      <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory')} className="h-8 w-8 rounded-lg hover:bg-primary/5">
            <ArrowLeft className="w-4 h-4 text-primary" />
          </Button>
          <h1 className="text-lg font-headline font-normal text-foreground uppercase tracking-tight">Registro Maestro</h1>
        </div>
        <div className="bg-primary text-white px-4 py-1 rounded-lg font-bold text-base shadow-sm font-headline">{nextId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <Card className="border border-slate-300 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="space-y-3 pt-4 px-5 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    placeholder="NOMBRE DEL PRODUCTO"
                    className="h-11 border-slate-300 rounded-xl font-medium text-sm uppercase shadow-none bg-slate-50/50" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[9px] uppercase font-bold text-slate-400 tracking-[0.12em]">Categoría</Label>
                      <Settings2 className="w-3 h-3 text-primary/30 cursor-pointer" onClick={() => { setTagManagerConfig({ type: 'category', title: 'Categorías' }); setIsTagManagerOpen(true); }} />
                    </div>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger className="h-10 border-slate-300 rounded-xl font-medium text-[10px] uppercase bg-white">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat} className="text-[10px] font-medium uppercase">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[9px] uppercase font-bold text-slate-400 tracking-[0.12em]">Colección</Label>
                      <Settings2 className="w-3 h-3 text-primary/30 cursor-pointer" onClick={() => { setTagManagerConfig({ type: 'collection', title: 'Colecciones' }); setIsTagManagerOpen(true); }} />
                    </div>
                    <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger className="h-10 border-slate-300 rounded-xl font-medium text-[10px] uppercase bg-white">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueCollections.map(col => (
                          <SelectItem key={col} value={col} className="text-[10px] font-medium uppercase">{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="STOCK" className="h-11 rounded-xl font-medium text-center border-slate-300 bg-slate-50 text-slate-800" />
                <Input type="number" value={form.priceFardo} onChange={e => setForm({...form, priceFardo: e.target.value})} placeholder="P. FARDO" className="h-11 rounded-xl font-medium text-center border-slate-300 bg-slate-50 text-slate-800" />
                <Input type="number" value={form.priceMayor} onChange={e => setForm({...form, priceMayor: e.target.value})} placeholder="P. MAYOR" className="h-11 rounded-xl font-medium text-center border-slate-300 bg-slate-50 text-slate-800" />
                <Input type="number" value={form.priceUnidad} onChange={e => setForm({...form, priceUnidad: e.target.value})} placeholder="P. UNIDAD" className="h-11 rounded-xl font-medium text-center border-slate-300 bg-slate-50 text-slate-800" />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase font-bold ml-1 text-slate-400 tracking-[0.12em]">Descripción</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="min-h-[70px] rounded-xl bg-slate-50/50 p-3 text-[11px] font-normal border-slate-300 shadow-none" placeholder="NOTAS ADICIONALES..." />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border border-slate-300 shadow-sm bg-white rounded-2xl overflow-hidden">
            <div className="bg-slate-50/80 p-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-slate-500 tracking-[0.2em]">Galería Drive</span>
              <span className="text-[9px] font-bold text-slate-400">{images.length}/4</span>
            </div>
            <CardContent className="pt-3 grid grid-cols-2 gap-2 px-3 pb-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-slate-50 shadow-none">
                  <img src={getDriveThumb(img, 400)} className={cn("w-full h-full object-cover", img.startsWith('data:') && "opacity-40")} alt="Previa" />
                  {img.startsWith('data:') ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-between p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        <button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="p-1.5 bg-red-500 text-white rounded-lg shadow-lg">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex justify-center gap-1.5 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm">
                        <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'left'); }} disabled={idx === 0} className="text-white disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveImage(idx, 'right'); }} disabled={idx === images.length - 1} className="text-white disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {images.length < 4 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 bg-slate-50/50 hover:bg-slate-50 transition-all">
                  <ImagePlus className="w-5 h-5 text-slate-300" />
                  <span className="text-[8px] font-bold uppercase text-slate-400">Subir</span>
                </button>
              )}
              <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
            </CardContent>
          </Card>

          <Button 
            className="h-14 rounded-xl bg-[#0f172a] text-white font-bold text-sm shadow-lg hover:opacity-95 active:scale-95 transition-all w-full tracking-[0.1em] uppercase" 
            onClick={handleSave} 
            disabled={saving || hasPendingUploads}
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />} 
            {editId ? "ACTUALIZAR" : "GUARDAR PRENDA"}
          </Button>
        </div>
      </div>

      <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
        <DialogContent className="rounded-3xl max-w-xs p-6 border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">{tagManagerConfig.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} className="h-10 text-[10px] font-medium uppercase rounded-xl border-slate-200" placeholder="Nueva..." />
              <Button className="h-10 w-10 bg-primary rounded-xl shrink-0" onClick={handleAddNewTag}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
              {currentTagsList.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-medium text-[10px] uppercase text-slate-700">{tag.name}</span>
                  <div className="flex gap-2">
                    <Edit2 className="w-3.5 h-3.5 text-slate-300 cursor-pointer hover:text-primary transition-colors" onClick={() => setEditingTagName({ id: tag.id, name: tag.name })} />
                    <Trash2 className="w-3.5 h-3.5 text-slate-300 cursor-pointer hover:text-red-500 transition-colors" onClick={() => handleRemoveTag(tag.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
