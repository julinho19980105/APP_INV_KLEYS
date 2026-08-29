
"use client"

import * as React from "react"
import { 
  Settings, 
  Save, 
  Building2, 
  Upload, 
  X, 
  Loader2, 
  Printer, 
  CreditCard, 
  Plus, 
  Edit2, 
  Package, 
  Tag,
  ShieldCheck,
  Zap,
  ArrowRightLeft
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, query, orderBy } from "firebase/firestore"
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
  
  const categoriesRef = React.useMemo(() => db ? query(collection(db, "categories"), orderBy("name")) : null, [db])
  const { data: dbCategories = [] } = useCollection(categoriesRef)

  const [form, setForm] = React.useState({
    companyName: "STILOSTACK",
    companyLogo: "",
    brandColor: "#0296FF",
    inventoryViewMode: "collection",
    printerWidth: "80",
    defaultCategory: "all",
    banks: [] as any[]
  })
  
  const [isInitialized, setIsInitialized] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [newBankName, setNewBankName] = React.useState("")
  const [editingBank, setEditingBank] = React.useState<{ id: string, name: string } | null>(null)

  React.useEffect(() => {
    if (dbConfig && !isInitialized) {
      setForm({
        companyName: dbConfig.companyName || "STILOSTACK",
        companyLogo: dbConfig.companyLogo || "",
        brandColor: dbConfig.brandColor || "#0296FF",
        inventoryViewMode: dbConfig.inventoryViewMode || "collection",
        printerWidth: dbConfig.printerWidth || "80",
        defaultCategory: dbConfig.defaultCategory || "all",
        banks: dbConfig.banks || []
      })
      setIsInitialized(true)
    }
  }, [dbConfig, isInitialized])

  const saveToFirestore = async (updatedData: any) => {
    if (!db) return
    try {
      await setDoc(doc(db, "config", "global"), {
        ...updatedData,
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR DE CONEXIÓN CON DB" })
    }
  }

  const handleSaveGeneral = async () => {
    setSaving(true)
    await saveToFirestore(form)
    toast({ title: "CONFIGURACIÓN GENERAL GUARDADA" })
    setSaving(false)
  }

  const addBank = async () => {
    if (!newBankName.trim()) return
    const newBank = {
      id: Math.random().toString(36).substr(2, 9),
      name: newBankName.toUpperCase().trim(),
      isDefault: form.banks.length === 0
    }
    const updatedBanks = [...form.banks, newBank]
    setForm(prev => ({ ...prev, banks: updatedBanks }))
    await saveToFirestore({ ...form, banks: updatedBanks })
    setNewBankName("")
    toast({ title: "BANCO REGISTRADO EN DB" })
  }

  const handleRenameBank = async () => {
    if (!editingBank || !editingBank.name.trim()) return
    const updatedBanks = form.banks.map(b => 
      b.id === editingBank.id ? { ...b, name: editingBank.name.toUpperCase().trim() } : b
    )
    setForm(prev => ({ ...prev, banks: updatedBanks }))
    await saveToFirestore({ ...form, banks: updatedBanks })
    setEditingBank(null)
    toast({ title: "NOMBRE ACTUALIZADO EN DB" })
  }

  const setDefaultBank = async (id: string) => {
    const updatedBanks = form.banks.map(b => ({ ...b, isDefault: b.id === id }))
    setForm(prev => ({ ...prev, banks: updatedBanks }))
    await saveToFirestore({ ...form, banks: updatedBanks })
    toast({ title: "BANCO PREDETERMINADO ACTUALIZADO" })
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

  if (loading && !isInitialized) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2 pb-24 px-2 md:px-0">
      <div className="flex items-center gap-3 border-b-2 border-black pb-4">
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center"><Settings className="w-6 h-6 text-white" /></div>
        <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Configuración</h1>
      </div>

      {/* Esquema Informativo Blindado */}
      <Card className="rounded-[2.5rem] border-2 border-emerald-500/20 bg-emerald-50/30 overflow-hidden">
        <CardHeader className="bg-emerald-500/10 border-b border-emerald-500/10 py-4">
          <CardTitle className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Esquema de Lógica Blindada (ERP)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20"><Zap className="w-4 h-4 text-white" /></div>
              <div>
                <span className="text-[9px] font-black text-emerald-800 uppercase block">Ventas e Inventario</span>
                <p className="text-[8px] font-medium text-emerald-600 uppercase mt-1 leading-relaxed">Cada venta descuenta stock automáticamente. Los productos manuales no afectan el balance maestro.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20"><ArrowRightLeft className="w-4 h-4 text-white" /></div>
              <div>
                <span className="text-[9px] font-black text-blue-800 uppercase block">Edición Blindada</span>
                <p className="text-[8px] font-medium text-blue-600 uppercase mt-1 leading-relaxed">Al editar boletas, el sistema restaura el stock anterior antes de aplicar el nuevo, garantizando cuadres perfectos.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20"><X className="w-4 h-4 text-white" /></div>
              <div>
                <span className="text-[9px] font-black text-red-800 uppercase block">Anulaciones y Retornos</span>
                <p className="text-[8px] font-medium text-red-600 uppercase mt-1 leading-relaxed">Anular una boleta genera un movimiento de RETORNO instantáneo, devolviendo las prendas al catálogo.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20"><Package className="w-4 h-4 text-white" /></div>
              <div>
                <span className="text-[9px] font-black text-orange-800 uppercase block">Ajustes de Producto</span>
                <p className="text-[8px] font-medium text-orange-600 uppercase mt-1 leading-relaxed">Cambiar el stock base de un producto genera un movimiento de AJUSTE (Entrada/Salida) en el Kardex.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
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

          <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 py-4 border-b">
              <CardTitle className="text-[10px] font-black text-black uppercase flex items-center gap-2"><Tag className="w-4 h-4" /> Preferencia Inventario</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase ml-1">Categoría Inicial</Label>
                <Select value={form.defaultCategory} onValueChange={v => setForm({...form, defaultCategory: v})}>
                  <SelectTrigger className="h-12 border-black/10 rounded-xl font-black text-[10px] uppercase bg-white">
                    <SelectValue placeholder="SELECCIONAR..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px] font-black uppercase">TODAS LAS CATEGORÍAS</SelectItem>
                    {dbCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name.toUpperCase()} className="text-[10px] font-black uppercase">
                        {cat.name.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

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
                       <button onClick={() => setDefaultBank(bank.id)} className={cn("w-4 h-4 rounded-full border-2", bank.isDefault ? "bg-primary border-primary" : "bg-white border-black/20")} />
                       <span className={cn("text-[10px] font-black uppercase", bank.isDefault && "text-primary")}>{bank.name}</span>
                    </div>
                    <button className="text-primary/40 hover:text-primary transition-all p-2" onClick={() => setEditingBank(bank)}><Edit2 className="w-3.5 h-3.5" /></button>
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
        <Button onClick={handleSaveGeneral} disabled={saving} className="h-16 w-full max-w-lg bg-black text-white font-black rounded-2xl shadow-2xl active:scale-95 transition-all uppercase tracking-widest">{saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 mr-3" />} CONFIRMAR AJUSTES</Button>
      </div>

      <Dialog open={!!editingBank} onOpenChange={() => setEditingBank(null)}>
        <DialogContent className="rounded-[2rem] max-w-[300px] p-8 border-none">
          <DialogHeader className="sr-only"><DialogTitle>Editar Banco</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-primary">Nombre del Banco</Label>
            <Input value={editingBank?.name || ''} onChange={e => setEditingBank(prev => prev ? ({ ...prev, name: e.target.value }) : null)} className="h-12 text-[12px] font-black uppercase text-center rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-11 text-[9px] font-black uppercase" onClick={() => setEditingBank(null)}>CANCELAR</Button>
              <Button className="bg-primary text-white rounded-xl h-11 text-[9px] font-black uppercase" onClick={handleRenameBank}>GUARDAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
