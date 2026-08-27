
"use client"

import * as React from "react"
import { Settings, Save, Building2, Upload, X, Loader2, Printer, CreditCard, Plus, Edit2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
    banks: [] as any[]
  })
  const [saving, setSaving] = React.useState(false)
  const [newBankName, setNewBankName] = React.useState("")
  const [editingBank, setEditingBank] = React.useState<{ id: string, name: string } | null>(null)

  React.useEffect(() => {
    if (dbConfig) {
      setForm({
        companyName: dbConfig.companyName || "STILOSTACK",
        companyLogo: dbConfig.companyLogo || "",
        brandColor: dbConfig.brandColor || "#FF3399",
        inventoryViewMode: dbConfig.inventoryViewMode || "collection",
        printerWidth: dbConfig.printerWidth || "80",
        banks: dbConfig.banks || []
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
      }, { merge: true })
      toast({ title: "CONFIGURACIÓN GUARDADA" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    } finally {
      setSaving(false)
    }
  }

  const addBank = () => {
    if (!newBankName.trim()) return
    const newBank = {
      id: Math.random().toString(36).substr(2, 9),
      name: newBankName.toUpperCase().trim(),
      isDefault: form.banks.length === 0
    }
    setForm(prev => ({ ...prev, banks: [...prev.banks, newBank] }))
    setNewBankName("")
  }

  const handleRenameBank = () => {
    if (!editingBank || !editingBank.name.trim()) return
    setForm(prev => ({
      ...prev,
      banks: prev.banks.map(b => b.id === editingBank.id ? { ...b, name: editingBank.name.toUpperCase().trim() } : b)
    }))
    setEditingBank(null)
  }

  const setDefaultBank = (id: string) => {
    setForm(prev => ({
      ...prev,
      banks: prev.banks.map(b => ({ ...b, isDefault: b.id === id }))
    }))
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

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2 pb-24 px-2 md:px-0">
      <div className="flex items-center gap-3 border-b-2 border-black pb-4">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center"><Settings className="w-6 h-6 text-white" /></div>
        <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Configuración</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-black/5 py-4 border-b">
            <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2"><Building2 className="w-4 h-4" /> Datos de Empresa</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase ml-1">Nombre</Label><Input value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} className="h-12 font-black border-black/10 rounded-xl uppercase bg-black/5" /></div>
            <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase ml-1">Color de Marca</Label><div className="flex gap-2"><Input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})} className="w-16 h-12 p-1 rounded-xl" /><Input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})} className="flex-1 h-12 font-black border-black/10 rounded-xl" /></div></div>
            <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase ml-1">Logo Principal</Label><div className="w-full h-40 rounded-2xl bg-black/5 border-2 border-dashed border-black/10 flex items-center justify-center relative group overflow-hidden">{form.companyLogo ? <><img src={form.companyLogo} className="w-full h-full object-contain p-4" /><button onClick={() => setForm(p => ({ ...p, companyLogo: "" }))} className="absolute top-2 right-2 p-2 bg-destructive text-white rounded-full"><X className="w-4 h-4" /></button></> : <Upload className="w-8 h-8 opacity-20" />}<input type="file" hidden ref={fileInputRef} onChange={handleFileChange} /><button className="absolute inset-0" onClick={() => fileInputRef.current?.click()} /></div></div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 py-4 border-b">
              <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2"><CreditCard className="w-4 h-4" /> Gestión de Bancos</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="flex gap-2">
                <Input value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="NOMBRE DEL BANCO..." className="h-10 text-[10px] font-black uppercase rounded-xl border-black/10" />
                <Button className="h-10 w-10 rounded-xl bg-black text-white" onClick={addBank}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {form.banks.map(bank => (
                  <div key={bank.id} className="flex items-center justify-between p-3 bg-black/5 rounded-xl border group">
                    <div className="flex items-center gap-3">
                       <Switch checked={bank.isDefault} onCheckedChange={() => setDefaultBank(bank.id)} className="scale-75" />
                       <span className={cn("text-[10px] font-black uppercase", bank.isDefault && "text-primary")}>{bank.name}</span>
                    </div>
                    <button className="text-primary/40 hover:text-primary transition-all" onClick={() => setEditingBank(bank)}><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 py-4 border-b">
              <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2"><Printer className="w-4 h-4" /> Impresora</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <RadioGroup value={form.printerWidth} onValueChange={v => setForm({...form, printerWidth: v})} className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 bg-black/5 p-4 rounded-xl border-2 border-transparent has-[:checked]:border-primary"><RadioGroupItem value="80" id="w-80" /><Label htmlFor="w-80" className="text-[10px] font-black uppercase">80 mm</Label></div>
                <div className="flex items-center space-x-3 bg-black/5 p-4 rounded-xl border-2 border-transparent has-[:checked]:border-primary"><RadioGroupItem value="58" id="w-58" /><Label htmlFor="w-58" className="text-[10px] font-black uppercase">58 mm</Label></div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <Button onClick={handleSave} disabled={saving} className="h-16 w-full max-w-lg bg-black text-white font-black rounded-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-widest">{saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 mr-3" />} CONFIRMAR AJUSTES</Button>
      </div>

      <Dialog open={!!editingBank} onOpenChange={() => setEditingBank(null)}>
        <DialogContent className="rounded-[2rem] max-w-xs p-6 border-none">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-primary">Renombrar Banco</Label>
            <Input value={editingBank?.name || ''} onChange={e => setEditingBank(prev => prev ? ({ ...prev, name: e.target.value }) : null)} className="h-10 text-[10px] font-black uppercase text-center" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-10 text-[9px] font-black uppercase" onClick={() => setEditingBank(null)}>CANCELAR</Button>
              <Button className="bg-primary text-white rounded-xl h-10 text-[9px] font-black uppercase" onClick={handleRenameBank}>GUARDAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
