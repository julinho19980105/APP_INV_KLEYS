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
import { ImagePlus, X, Save, History, Plus, Edit3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateProductDescription } from "@/ai/flows/generate-product-description"
import Image from "next/image"

export default function RegistryPage() {
  const { toast } = useToast()
  const [loadingAI, setLoadingAI] = React.useState(false)
  
  // Categorías y Colecciones Dinámicas
  const [categories, setCategories] = React.useState(["Sacos", "Pantalones", "Vestidos", "Blusas"])
  const [collections, setCollections] = React.useState(["Invierno 2024", "Verano 2025"])
  
  const [newCat, setNewCat] = React.useState("")
  const [newColl, setNewColl] = React.useState("")

  const [form, setForm] = React.useState({
    name: "",
    code: "P-001", // Código correlativo inicial
    category: "",
    collection: "",
    description: "",
    quantity: 0,
    priceFardo: 0,
    priceMayor: 0,
    priceUnidad: 0,
  })

  const [images, setImages] = React.useState<string[]>([])

  // Simular la obtención del siguiente código correlativo
  React.useEffect(() => {
    // En una app real, esto consultaría el último ID de la base de datos
    const lastNum = 1 // Mock
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
    // Validación de campos obligatorios
    if (!form.name || !form.category || !form.collection || form.quantity <= 0) {
      toast({ 
        title: "Campos Incompletos", 
        description: "Por favor llene Nombre, Categoría, Colección y Cantidad.", 
        variant: "destructive" 
      })
      return
    }
    
    toast({ 
      title: "¡Guardado con éxito!", 
      description: `La prenda ${form.code} ha sido registrada.`,
      className: "bg-primary text-white" 
    })
    
    // Resetear formulario (manteniendo el código correlativo lógico)
    setForm(prev => ({
      ...prev,
      name: "",
      category: "",
      collection: "",
      description: "",
      quantity: 0,
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
          <h1 className="text-4xl font-headline font-bold text-primary">Registrar Prenda</h1>
          <p className="text-muted-foreground">Catálogo Maestro StiloStack</p>
        </div>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
          <History className="w-4 h-4 mr-2" />
          Historial
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg text-primary flex items-center gap-2">
                <Edit3 className="w-5 h-5" /> Datos del Producto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest font-bold">Código (No editable)</Label>
                  <Input value={form.code} readOnly className="bg-muted/50 font-mono text-primary font-bold border-dashed" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest font-bold">Nombre de Prenda *</Label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Ej. Saco Velvet Premium" 
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs uppercase tracking-widest font-bold">Categoría *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary p-0 px-2">+ Agregar</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle></DialogHeader>
                        <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nombre de categoría" />
                        <DialogFooter>
                          <Button onClick={() => {
                            if(newCat) {
                              setCategories([...categories, newCat])
                              setNewCat("")
                            }
                          }}>Guardar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger className="border-primary/20">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs uppercase tracking-widest font-bold">Colección *</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary p-0 px-2">+ Agregar</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nueva Colección</DialogTitle></DialogHeader>
                        <Input value={newColl} onChange={e => setNewColl(e.target.value)} placeholder="Nombre de colección" />
                        <DialogFooter>
                          <Button onClick={() => {
                            if(newColl) {
                              setCollections([...collections, newColl])
                              setNewColl("")
                            }
                          }}>Guardar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Select value={form.collection} onValueChange={v => setForm({...form, collection: v})}>
                    <SelectTrigger className="border-primary/20">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs uppercase tracking-widest font-bold">Descripción Estética</Label>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={handleAI}
                    disabled={loadingAI}
                  >
                    {loadingAI ? "Generando..." : "Mágia IA"}
                  </Button>
                </div>
                <Textarea 
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Tela, corte, estilo..." 
                  className="min-h-[100px] border-primary/20"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-lg text-primary">Stock y Precios</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">CANTIDAD *</Label>
                  <Input 
                    type="number" 
                    value={form.quantity}
                    onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})}
                    className="border-primary/20 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">P. FARDO (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceFardo}
                    onChange={e => setForm({...form, priceFardo: parseFloat(e.target.value) || 0})}
                    className="border-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">P. MAYOR (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceMayor}
                    onChange={e => setForm({...form, priceMayor: parseFloat(e.target.value) || 0})}
                    className="border-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">P. UNIDAD (S/)</Label>
                  <Input 
                    type="number" 
                    value={form.priceUnidad}
                    onChange={e => setForm({...form, priceUnidad: parseFloat(e.target.value) || 0})}
                    className="border-primary/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-primary flex justify-between items-center">
                Fotos
                <span className="text-xs font-normal text-muted-foreground">{images.length}/4</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/10">
                    <Image src={img} alt="" fill className="object-cover" />
                    <button 
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <button 
                    onClick={addImage}
                    className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 text-primary/60 hover:text-primary hover:border-primary transition-all bg-primary/5"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase">Subir</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-16 text-xl font-headline shadow-xl shadow-primary/20 rounded-2xl" 
            onClick={handleSave}
          >
            <Save className="w-6 h-6 mr-2" />
            GUARDAR PRENDA
          </Button>
          
          <div className="text-[10px] text-center text-muted-foreground uppercase tracking-[0.2em] font-bold">
            Campos marcados con (*) son obligatorios
          </div>
        </div>
      </div>
    </div>
  )
}
