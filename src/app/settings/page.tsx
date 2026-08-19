
"use client"

import * as React from "react"
import { Settings, Save, Sparkles, Building2, Upload, LayoutGrid, Layers, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [config, setConfig] = React.useState({
    companyName: "StiloStack",
    companyLogo: "",
    inventoryViewMode: "collection"
  })

  React.useEffect(() => {
    const saved = localStorage.getItem('diva_settings')
    if (saved) setConfig(JSON.parse(saved))
  }, [])

  const handleSave = () => {
    localStorage.setItem('diva_settings', JSON.stringify(config))
    // Notificar a otros componentes (como el AppShell)
    window.dispatchEvent(new Event('storage'))
    toast({ title: "Configuración Guardada", description: "Identidad actualizada correctamente." })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, companyLogo: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center border border-black/10">
          <Settings className="w-6 h-6 text-black" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Configuración</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Identidad Visual y Operativa Diva</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-black/5 py-3 border-b">
            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Datos de Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-black ml-1">Nombre del Sistema</Label>
              <Input 
                value={config.companyName}
                onChange={e => setConfig({...config, companyName: e.target.value})}
                className="h-10 font-black border-black/10 rounded-xl text-black uppercase bg-black/5" 
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-black ml-1">Logo Principal (Subir Archivo)</Label>
              <div className="flex flex-col gap-4">
                <div className="w-full h-40 rounded-2xl bg-black/5 border-2 border-dashed border-black/10 flex items-center justify-center overflow-hidden relative group">
                  {config.companyLogo ? (
                    <>
                      <img src={config.companyLogo} alt="Preview" className="w-full h-full object-contain p-4" />
                      <button 
                        onClick={() => setConfig(p => ({ ...p, companyLogo: "" }))}
                        className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <Upload className="w-10 h-10" />
                      <span className="text-[10px] font-black uppercase">Click para subir logo</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    hidden 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                  />
                  <button 
                    className="absolute inset-0 w-full h-full" 
                    onClick={() => fileInputRef.current?.click()}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-black/5 py-3 border-b">
            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Preferencias Operativas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
             <div className="space-y-3">
               <Label className="text-[9px] font-black uppercase text-black ml-1">Vista Predeterminada Inventario</Label>
               <RadioGroup 
                 value={config.inventoryViewMode} 
                 onValueChange={v => setConfig({...config, inventoryViewMode: v})}
                 className="grid grid-cols-2 gap-4"
               >
                 <div className="flex items-center space-x-2 bg-black/5 p-4 rounded-2xl border-2 border-transparent cursor-pointer has-[:checked]:border-primary transition-all">
                   <RadioGroupItem value="collection" id="v-collection" />
                   <Label htmlFor="v-collection" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-2">
                     <LayoutGrid className="w-3 h-3" /> Colección
                   </Label>
                 </div>
                 <div className="flex items-center space-x-2 bg-black/5 p-4 rounded-2xl border-2 border-transparent cursor-pointer has-[:checked]:border-primary transition-all">
                   <RadioGroupItem value="category" id="v-category" />
                   <Label htmlFor="v-category" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-2">
                     <Layers className="w-3 h-3" /> Categoría
                   </Label>
                 </div>
               </RadioGroup>
             </div>
             
             <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
               <p className="text-[9px] font-black text-primary uppercase leading-relaxed text-center">
                 El modo elegido será el que cargue primero al abrir la pestaña de Stock Actual.
               </p>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4 pb-20">
        <Button onClick={handleSave} className="h-14 w-full max-w-md bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all">
          <Save className="w-5 h-5 mr-2" /> GUARDAR CONFIGURACIÓN DIVA
        </Button>
      </div>
    </div>
  )
}
