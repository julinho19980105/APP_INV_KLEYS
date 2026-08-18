
"use client"

import * as React from "react"
import { Settings, Save, Sparkles, Building2, Upload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const [config, setConfig] = React.useState({
    companyName: "StiloStack",
    companyLogo: ""
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
          <Settings className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-black text-black">Configuración</h1>
          <p className="text-xs font-black text-accent uppercase tracking-widest">Identidad Visual Diva</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 py-4 border-b">
            <CardTitle className="text-xs font-black text-primary uppercase flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Datos de Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-black">Nombre del Sistema</Label>
              <Input 
                value={config.companyName}
                onChange={e => setConfig({...config, companyName: e.target.value})}
                className="h-10 font-black border-accent/20 rounded-xl text-black" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-black">Logo Principal</Label>
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-2xl bg-accent/5 border-2 border-dashed border-accent/20 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-accent opacity-40" />
                </div>
                <Button variant="outline" className="h-10 rounded-xl font-black text-xs border-accent text-accent">CARGAR LOGO</Button>
              </div>
            </div>

            <Button className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg mt-4">
              <Save className="w-4 h-4 mr-2" /> GUARDAR CAMBIOS
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-accent/5 py-4 border-b">
            <CardTitle className="text-xs font-black text-accent uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Preferencias de Interfaz
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
             <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10">
               <p className="text-[10px] font-black text-accent uppercase leading-relaxed text-center">
                 El sistema utiliza un esquema de colores de alto contraste con tipografía Space Grotesk para garantizar eficiencia operativa.
               </p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
