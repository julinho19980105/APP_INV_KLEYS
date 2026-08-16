
"use client"

import * as React from "react"
import { AppShell } from "@/components/layout/app-shell"
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
import { ImagePlus, X, Save, History, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateProductDescription } from "@/ai/flows/generate-product-description"
import Image from "next/image"

export default function RegistryPage() {
  const { toast } = useToast()
  const [loadingAI, setLoadingAI] = React.useState(false)
  const [form, setForm] = React.useState({
    name: "",
    code: "",
    category: "",
    collection: "",
    description: "",
    quantity: 0,
    priceFardo: 0,
    priceMayor: 0,
    priceUnidad: 0,
  })

  const [images, setImages] = React.useState<string[]>([])

  // Hydration safety for random code
  React.useEffect(() => {
    setForm(prev => ({
      ...prev,
      code: `STK-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    }))
  }, [])

  const handleAI = async () => {
    if (!form.name || !form.category) {
      toast({ title: "Error", description: "Nombre y categoría son necesarios para la IA.", variant: "destructive" })
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
      toast({ title: "Error", description: "No se pudo generar la descripción.", variant: "destructive" })
    } finally {
      setLoadingAI(false)
    }
  }

  const handleSave = () => {
    toast({ title: "Éxito", description: "Prenda registrada correctamente en StiloStack." })
  }

  const addImage = () => {
    if (images.length < 4) {
      setImages([...images, `https://picsum.photos/seed/${Math.random()}/400/400`])
    }
  }

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx))
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-headline font-bold">Registrar Prenda</h1>
            <p className="text-muted-foreground">Crea una nueva entrada en el catálogo maestro.</p>
          </div>
          <Button variant="outline" size="sm">
            <History className="w-4 h-4 mr-2" />
            Historial de Lotes
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código (Automático)</Label>
                    <Input value={form.code} readOnly className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de Prenda</Label>
                    <Input 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})}
                      placeholder="Ej. Saco Velvet Premium" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sacos">Sacos</SelectItem>
                        <SelectItem value="pantalones">Pantalones</SelectItem>
                        <SelectItem value="vestidos">Vestidos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Colección</Label>
                    <Select onValueChange={v => setForm({...form, collection: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar colección" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="winter24">Invierno 2024</SelectItem>
                        <SelectItem value="summer25">Verano 2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Descripción</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-primary"
                      onClick={handleAI}
                      disabled={loadingAI}
                    >
                      {loadingAI ? "Generando..." : "Mejorar con IA"}
                    </Button>
                  </div>
                  <Textarea 
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="Detalles de la tela, corte y estilo..." 
                    className="min-h-[120px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock y Precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input 
                      type="number" 
                      value={form.quantity}
                      onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio Fardo</Label>
                    <Input 
                      type="number" 
                      value={form.priceFardo}
                      onChange={e => setForm({...form, priceFardo: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio Mayor</Label>
                    <Input 
                      type="number" 
                      value={form.priceMayor}
                      onChange={e => setForm({...form, priceMayor: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio Unidad</Label>
                    <Input 
                      type="number" 
                      value={form.priceUnidad}
                      onChange={e => setForm({...form, priceUnidad: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex justify-between items-center">
                  Galería (Max 4)
                  <span className="text-xs font-normal text-muted-foreground">{images.length}/4</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      <Image 
                        src={img} 
                        alt={`Preview ${idx + 1}`} 
                        fill 
                        className="object-cover"
                        data-ai-hint="fashion item"
                      />
                      <div className="absolute top-1 left-1 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-white border border-white/20">
                        IMG {idx + 1}
                      </div>
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {images.length < 4 && (
                    <button 
                      onClick={addImage}
                      className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all bg-accent/5"
                    >
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-xs">Subir Foto</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground italic text-center">
                  Las fotos se gestionarán mediante Drive próximamente.
                </p>
              </CardContent>
            </Card>

            <Button className="w-full h-12 text-lg font-headline" onClick={handleSave}>
              <Save className="w-5 h-5 mr-2" />
              Guardar Prenda
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
