
"use client"

import * as React from "react"
import { Settings, Save, Building2, Upload, LayoutGrid, Layers, X, Loader2, Printer, Link as LinkIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

export default function SettingsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: dbConfig, loading } = useDoc(configDocRef)

  const [form, setForm] = React.useState({
    companyName: "STILOSTACK",
    companyLogo: "",
    brandColor: "#FF3399",
    inventoryViewMode: "collection",
    printerWidth: "80",
    catalogUrl: ""
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (dbConfig) {
      setForm({
        companyName: dbConfig.companyName || "STILOSTACK",
        companyLogo: dbConfig.companyLogo || "",
        brandColor: dbConfig.brandColor || "#FF3399",
        inventoryViewMode: dbConfig.inventoryViewMode || "collection",
        printerWidth: dbConfig.printerWidth || "80",
        catalogUrl: dbConfig.catalogUrl || ""
      })
    }
  }, [dbConfig])

  const handleSave = async () => {
    if (!db) return
    setSaving(true)
    try {
      await setDoc(doc(db, "config", "global"), {
        ...form,
        updatedAt: serverTimestamp()
      })
      toast({ title: "CONFIGURACIÓN GUARDADA" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, companyLogo: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2 pb-24">
      <div className="flex items-center gap-3 border-b-2 border-black pb-4">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-black/10">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Configuración</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Identidad Industrial en Nube</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-black/5 py-4 border-b">
            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Datos de Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-black ml-1">Nombre del Sistema</Label>
              <Input 
                value={form.companyName}
                onChange={e => setForm({...form, companyName: e.target.value})}
                className="h-12 font-black border-black/10 rounded-xl text-black uppercase bg-black/5" 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-black ml-1">Color de Marca</Label>
              <div className="flex gap-2">
                <Input 
                  type="color"
                  value={form.brandColor}
                  onChange={e => setForm({...form, brandColor: e.target.value})}
                  className="w-16 h-12 p-1 rounded-xl cursor-pointer border-black/10"
                />
                <Input 
                  value={form.brandColor}
                  onChange={e => setForm({...form, brandColor: e.target.value})}
                  className="flex-1 h-12 font-black border-black/10 rounded-xl text-black uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-black ml-1">Logo Principal</Label>
              <div className="w-full h-48 rounded-[2rem] bg-black/5 border-2 border-dashed border-black/10 flex items-center justify-center overflow-hidden relative group">
                {form.companyLogo ? (
                  <>
                    <img src={form.companyLogo} alt="Preview" className="w-full h-full object-contain p-6" />
                    <button 
                      onClick={() => setForm(p => ({ ...p, companyLogo: "" }))}
                      className="absolute top-4 right-4 p-2 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <Upload className="w-12 h-12" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Subir logo</span>
                  </div>
                )}
                <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                <button className="absolute inset-0 w-full h-full" onClick={() => fileInputRef.current?.click()} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-black/5 py-4 border-b">
            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2">
              <Printer className="w-4 h-4" /> Hardware y Vistas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
             <div className="space-y-1.5">
               <Label className="text-[9px] font-black uppercase text-black ml-1 flex items-center gap-2">
                 <LinkIcon className="w-3 h-3" /> URL Catálogo Externo
               </Label>
               <Input 
                 value={form.catalogUrl}
                 onChange={e => setForm({...form, catalogUrl: e.target.value})}
                 placeholder="https://script.google.com/macros/s/..."
                 className="h-12 font-medium border-black/10 rounded-xl text-xs bg-black/5" 
               />
             </div>

             <div className="space-y-4">
               <Label className="text-[9px] font-black uppercase text-black ml-1">Ancho de Ticket</Label>
               <RadioGroup 
                 value={form.printerWidth} 
                 onValueChange={v => setForm({...form, printerWidth: v})}
                 className="grid grid-cols-2 gap-4"
               >
                 <div className="flex items-center space-x-3 bg-black/5 p-4 rounded-xl border-2 border-transparent has-[:checked]:border-primary transition-all">
                   <RadioGroupItem value="80" id="w-80" />
                   <Label htmlFor="w-80" className="text-[10px] font-black uppercase cursor-pointer">80 mm</Label>
                 </div>
                 <div className="flex items-center space-x-3 bg-black/5 p-4 rounded-xl border-2 border-transparent has-[:checked]:border-primary transition-all">
                   <RadioGroupItem value="58" id="w-58" />
                   <Label htmlFor="w-58" className="text-[10px] font-black uppercase cursor-pointer">58 mm</Label>
                 </div>
               </RadioGroup>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-8">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="h-16 w-full max-w-lg bg-black text-white font-black rounded-2xl shadow-2xl active:scale-95 transition-all text-base uppercase tracking-widest"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 mr-3" />} 
          CONFIRMAR IDENTIDAD
        </Button>
      </div>
    </div>
  )
}
