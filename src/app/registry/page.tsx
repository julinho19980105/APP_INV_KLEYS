"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { ImagePlus, X, Save, History, Edit3, BadgeInfo } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateProductDescription } from "@/ai/flows/generate-product-description"
import Image from "next/image"

export default function RegistryPage() {
  const { toast } = useToast()
  const [loadingAI, setLoadingAI] = React.useState(false)
  
  const [categories, setCategories] = React.useState(["Sacos", "Pantalones", "Vestidos", "Blusas"])
  const [collections, setCollections] = React.useState(["Invierno 2024", "Verano 2025"])
  
  const [newCat, setNewCat] = React.useState("")
  const [newColl, setNewColl] = React.useState("")

  const [form, setForm] = React.useState({
    name: "",
    code: "P-001",
    category: "",
    collection: "",
    description: "",
    quantity: "" as string,
    priceFardo: "" as string,
    priceMayor: "" as string,
    priceUnidad: "" as string,
  })

  const [images, setImages] = React.useState<string[]>([])

  // Generar código correlativo al montar
  React.useEffect(() => {
    // En el futuro esto vendrá del Sheet: SELECT MAX(Codigo) FROM Prendas
    const lastNum = 1 
    setForm(prev => ({
      ...prev,
      code: `P-${String(lastNum).padStart(3, '0')}`
    }))
  }, [])

  const handleAI = async () => {
    if (!form.name || !form.category) {
      toast({ title: "Atención", description: "Nombre y categoría son necesarios para la IA.", variant: "destructive" })
      return
    }
    setLoadingAI(true)
    try {
      const res = await generateProductDescription({ 
        productName: form.name, 
        category: form.category,
        existingDescription: form.description 
      })
      setForm(prev => ({ ...prev, description: res.description }))
    } catch (e) {
      toast({ title: "Error", description: "No se pudo generar la descripción." })
    } finally {
      setLoadingAI(false)
    }
  }

  const handleSave = () => {
    if (!form.name || !form.category || !form.collection || !form.quantity) {
      toast({ 
        title: "Campos Incompletos", 
        description: "Por favor llene Nombre, Categoría, Colección y Cantidad.", 
        variant: "destructive" 
      })
      return
    }
    
    // Aquí irá la llamada al Google Apps Script (POST)
    toast({ 
      title: "¡Guardado con éxito!", 
      description: `La prenda ${form.code} ha sido registrada.`,
      className: "bg-primary text-white" 
    })
    
    // Reset form y aumentar correlativo simulado
    setForm(prev => ({
      ...prev,
      name: "",
      category: "",
      collection: "",
      description: "",
      quantity: "",
      priceFardo: "",
      priceMayor: "",
      priceUnidad: "",
      code: `P-${String(parseInt(prev.code.split('-')[1]) + 1).padStart(3, '0')}`
    }))
    setImages([])
  }

  const addImage = () => {
    if (images.length < 4) {
      setImages([...images, `https://picsum.photos/seed/${Math.random()}/400/400`])
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            Registrar Prenda
            <BadgeInfo className="text-accent w-6 h-6" />
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Catálogo Maestro StiloStack</p>
        </div>
        <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 rounded-xl">
          <History className="w-4 h-4 mr-2" />
          Historial
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
            <CardHeader className="bg-gradient-to-r from-accent/10 via-white to-white border-b border-accent/10">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-lg text-accent flex items-center gap-2">
                  <Edit3 className="w-5 h-5" /> Datos del Producto
                </CardTitle>
                <div className="font-mono text-sm bg-accent text-white px-4 py-1.5 rounded-full shadow-inner font-bold">
                  {form.code}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Nombre de Prenda *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ej. Saco Velvet Premium" 
                  className="h-12 border-accent/20 focus:border-primary rounded-xl text-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Categoría *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-[9px] text-primary font-black tracking-tighter hover:underline">+ AGREGAR / EDITAR</button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl">
                        <DialogHeader><DialogTitle>Gestionar Categorías</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex gap-2">
                            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría..." className="rounded-xl" />
                            <Button onClick={() => { if(newCat) { setCategories([...categories, newCat]); setNewCat(""); } }} className="rounded-xl">Añadir</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                              <div key={c} className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                {c} <X className="w-3 h-3 cursor-pointer" onClick={() => setCategories(categories.filter(x => x !== c))} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger className="border-accent/20 h-11 rounded-xl">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {categories.map(c => <SelectItem key={c} value={c.toLowerCase()} className="rounded-lg">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Colección *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-[9px] text-primary font-black tracking-tighter hover:underline">+ AGREGAR / EDITAR</button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl">
                        <DialogHeader><DialogTitle>Gestionar Colecciones</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex gap-2">
                            <Input value={newColl} onChange={e => setNewColl(e.target.value)} placeholder="Nueva colección..." className="rounded-xl" />
                            <Button onClick={() => { if(newColl) { setCollections([...collections, newColl]); setNewColl(""); } }} className="rounded-xl">Añadir</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {collections.map(c => (
                              <div key={c} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                {c} <X className="w-3 h-3 cursor-pointer" onClick={() => setCollections(collections.filter(x => x !== c))} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                    <SelectTrigger className="border-accent/20 h-11 rounded-xl">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {collections.map(c => <SelectItem key={c} value={c.toLowerCase()} className="rounded-lg">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-accent/70">Descripción Estética</Label>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 text-[10px] bg-primary text-white hover:bg-primary/90 font-bold tracking-widest rounded-full px-4"
                    onClick={handleAI}
                    disabled={loadingAI}
                  >
                    {loadingAI ? "GENERANDO..." : "MÁGIA IA"}
                  </Button>
                </div>
                <Textarea 
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Escribe sobre la tela, el corte o el estilo..." 
                  className="min-h-[120px] border-accent/20 rounded-2xl resize-none focus:ring-primary"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-accent/5 border-b border-accent/10">
              <CardTitle className="text-lg text-accent font-bold">Stock y Precios</CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-primary tracking-widest">CANTIDAD *</Label>
                  <Input 
                    type="number" 
                    value={form.quantity}
                    onChange={e => setForm({...form, quantity: e.target.value})}
                    className="border-primary/20 font-bold h-11 rounded-xl focus:ring-primary text-center text-lg"
                    placeholder="---"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">P. FARDO (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceFardo}
                    onChange={e => setForm({...form, priceFardo: e.target.value})}
                    className="border-accent/20 h-11 rounded-xl text-center font-medium"
                    placeholder="---"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">P. MAYOR (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceMayor}
                    onChange={e => setForm({...form, priceMayor: e.target.value})}
                    className="border-accent/20 h-11 rounded-xl text-center font-medium"
                    placeholder="---"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-accent/70">P. UNIDAD (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceUnidad}
                    onChange={e => setForm({...form, priceUnidad: e.target.value})}
                    className="border-accent/20 h-11 rounded-xl text-center font-medium"
                    placeholder="---"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg text-primary flex justify-between items-center font-bold">
                Fotos
                <span className="text-[10px] bg-primary text-white px-3 py-1 rounded-full">{images.length}/4</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-primary/10 group shadow-md">
                    <Image src={img} alt="" fill className="object-cover" />
                    <button 
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 p-1.5 bg-destructive rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <button 
                    onClick={addImage}
                    className="aspect-square rounded-2xl border-2 border-dashed border-accent/30 flex flex-col items-center justify-center gap-2 text-accent hover:text-primary hover:border-primary transition-all bg-accent/5 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Subir Foto</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-20 text-2xl font-headline shadow-2xl shadow-primary/30 rounded-[2rem] bg-gradient-to-tr from-primary to-accent hover:opacity-90 active:scale-[0.98] border-none" 
            onClick={handleSave}
          >
            <Save className="w-7 h-7 mr-3" />
            GUARDAR PRENDA
          </Button>
          
          <div className="text-[9px] text-center text-muted-foreground uppercase tracking-[0.3em] font-black px-6 leading-relaxed">
            * Campos obligatorios para el catálogo maestro *
          </div>
        </div>
      </div>
    </div>
  )
}
