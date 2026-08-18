
"use client"

import * as React from "react"
import { Settings, Save, Sparkles, Building2, Upload, LayoutGrid, Layers } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const [config, setConfig] = React.useState({
    companyName: "StiloStack",
    companyLogo: "",
    inventoryViewMode: "collection" // 'collection' | 'category'
  })

  React.useEffect(() => {
    const saved = localStorage.getItem('diva_settings')
    if (saved) setConfig(JSON.parse(saved))
  }, [])

  const handleSave = () => {
    localStorage.setItem('diva_settings', JSON.stringify(config))
    window.dispatchEvent(new Event('storage')) // Notificar a AppShell e Inventory
    toast({ title: "Configuración Guardada", description: "Los cambios se han aplicado correctamente." })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center">
          <Settings className="w-6 h-6 text-black" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-black text-black">Configuración</h1>
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
              <Label className="text-[10px] font-black uppercase text-black ml-1">Nombre del Sistema</Label>
              <Input 
                value={config.companyName}
                onChange={e => setConfig({...config, companyName: e.target.value})}
                className="h-10 font-black border-black/10 rounded-xl text-black uppercase" 
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-black ml-1">Logo Principal (URL)</Label>
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-2xl bg-black/5 border-2 border-dashed border-black/10 flex items-center justify-center overflow-hidden">
                  {config.companyLogo ? (
                    <img src={config.companyLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-black opacity-20" />
                  )}
                </div>
                <Input 
                  placeholder="URL de imagen..."
                  value={config.companyLogo}
                  onChange={e => setConfig({...config, companyLogo: e.target.value})}
                  className="h-10 font-black border-black/10 rounded-xl text-[10px]" 
                />
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
               <Label className="text-[10px] font-black uppercase text-black ml-1">Vista Predeterminada Inventario</Label>
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
                 Al guardar, se cambiará el comportamiento de la pestaña Stock Actual para todas las sesiones.
               </p>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={handleSave} className="h-14 w-full max-w-md bg-black text-white font-black rounded-2xl shadow-xl">
          <Save className="w-5 h-5 mr-2" /> GUARDAR CONFIGURACIÓN GLOBAL
        </Button>
      </div>
    </div>
  )
}
