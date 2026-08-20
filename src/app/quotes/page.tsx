"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  Save, 
  Loader2, 
  UserPlus, 
  PackageSearch,
  Edit2,
  ChevronDown,
  X,
  Check,
  Calculator
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment, 
  getDocs, 
  limit, 
  setDoc,
  getDoc
} from "firebase/firestore"
import { syncCatalogToDrive } from "@/services/sheets-service"

interface QuoteItem {
  id: string
  productId: string
  name: string
  description: string
  quantity: string
  price: string
  stock: number
  img: string
  discount: string
  isRegistered: boolean
  calcUnidades?: string
  calcSeries?: string
  calcLibres?: string
  manualNote?: string
}

const EMPTY_ENTRY: QuoteItem = {
  id: "",
  productId: "",
  name: "",
  description: "",
  quantity: "",
  price: "",
  stock: 0,
  img: "",
  discount: "",
  isRegistered: false,
  calcUnidades: "",
  calcSeries: "",
  calcLibres: "",
  manualNote: ""
}

export default function QuotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { toast } = useToast()
  const db = useFirestore()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  
  const [currentEntry, setCurrentEntry] = React.useState<QuoteItem>(EMPTY_ENTRY)
  const [items, setItems] = React.useState<QuoteItem[]>([])
  
  const [isCalcOpen, setIsCalcOpen] = React.useState(false)
  const [calcData, setCalcData] = React.useState({ unidades: "", series: "", libres: "" })

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  React.useEffect(() => {
    if (!db || editId) return
    const getNextId = async () => {
      const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
      }
    }
    getNextId()
  }, [db, editId])

  React.useEffect(() => {
    if (db && editId) {
      getDoc(doc(db, "quotes", editId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          setQuoteId(data.id)
          setSelectedCustomer({ id: data.customerId, name: data.customerName })
          setItems(data.items || [])
        }
      })
    }
  }, [db, editId])

  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 2) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery, dbCustomers])

  const productSuggestions = React.useMemo(() => {
    if (productQuery.length < 2) return []
    const q = productQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbProducts.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [productQuery, dbProducts])

  const selectProductForEntry = (prod: any) => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "",
      price: prod.priceMayor?.toString() || "",
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: "",
      isRegistered: true,
      calcUnidades: "",
      calcSeries: "",
      calcLibres: "",
      manualNote: ""
    })
    setProductQuery("")
  }

  const addCurrentToList = () => {
    if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) return
    setItems([...items, { ...currentEntry }])
    setCurrentEntry(EMPTY_ENTRY)
  }

  const handleApplyCalc = () => {
    const u = Number(calcData.unidades || 0)
    const s = Number(calcData.series || 0)
    const l = Number(calcData.libres || 0)
    const total = (u * s) + l
    const desc = `${u} UNID X ${s} SERIES${l > 0 ? ` + ${l}` : ''}. `
    setCurrentEntry({ 
      ...currentEntry, 
      quantity: total.toString(), 
      description: desc + (currentEntry.manualNote || ""),
      calcUnidades: calcData.unidades,
      calcSeries: calcData.series,
      calcLibres: calcData.libres
    })
    setIsCalcOpen(false)
  }

  const handleSaveQuote = async () => {
    if (!db || !selectedCustomer || items.length === 0) return
    setSaving(true)
    try {
      const subtotal = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price)), 0)
      const total = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0)
      
      const quoteData = {
        id: quoteId,
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        items: items,
        subtotal: subtotal,
        total: total,
        status: 'active',
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "quotes", quoteId), quoteData)

      // Actualizar stock y kardex
      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          await updateDoc(doc(db, "products", item.productId), {
            stock: increment(-Number(item.quantity)),
            updatedAt: serverTimestamp()
          })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: Number(item.quantity),
            reason: `VENTA ${quoteId} - ${selectedCustomer.name}`,
            timestamp: serverTimestamp()
          })
        }
      }

      // Sincronizar con Drive
      const updatedProducts = await getDocs(query(collection(db, "products")))
      const allProds = updatedProducts.docs.map(d => ({ id: d.id, ...d.data() }))
      await syncCatalogToDrive(allProds)

      toast({ title: editId ? "BOLETA ACTUALIZADA" : "VENTA REGISTRADA" })
      router.push('/sales')
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL GUARDAR" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 pt-2 px-2 md:px-0">
      <div className="flex justify-between items-end border-b-2 border-black pb-4">
        <div>
          <h1 className="text-4xl font-headline font-black text-black uppercase tracking-tight">COTIZACIÓN</h1>
          <Badge variant="outline" className="text-[9px] font-black border-black/20 uppercase tracking-[0.2em] px-3 mt-1">SERIE {quoteId}</Badge>
        </div>
        <div className="flex gap-2">
          {editId && (
            <Button variant="outline" size="icon" className="h-10 w-10 text-destructive rounded-xl border-destructive/20" onClick={() => router.push('/sales')}>
              <X className="w-6 h-6" />
            </Button>
          )}
          <Button className="h-10 bg-black text-white rounded-xl font-black px-6" onClick={handleSaveQuote} disabled={saving || items.length === 0}>
            {saving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {editId ? "ACTUALIZAR" : "GUARDAR VENTA"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase text-black font-black ml-1">CLIENTE</Label>
          <div className="relative">
            <Input 
              placeholder="NOMBRE O ID..." 
              className="h-11 text-xs font-black uppercase rounded-xl border-black/10 bg-white"
              value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
              onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
            />
            {customerSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-2xl overflow-hidden">
                {customerSuggestions.map(c => (
                  <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-black/5 border-b last:border-0" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                    <span className="text-[10px] font-black uppercase text-black">{c.name} <span className="ml-1" style={{ color: brandColor }}>[{c.id}]</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-black text-black ml-1">BUSCAR PRENDA</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4" style={{ color: brandColor }} />
            <Input 
              placeholder="DNI O NOMBRE..." 
              className="pl-9 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white" 
              value={productQuery} 
              onChange={e => setProductQuery(e.target.value)} 
            />
            {productQuery.length >= 2 && (
              <div className="absolute z-50 w-full mt-2 bg-white border rounded-2xl shadow-2xl overflow-hidden">
                {productSuggestions.map(p => (
                  <button key={p.code} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-3 border-b last:border-0" onClick={() => selectProductForEntry(p)}>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-[10px] text-black uppercase">{p.name}</div>
                      <div className="text-[7px] font-black text-black/40 uppercase">{p.code}</div>
                    </div>
                    <Plus className="w-4 h-4" style={{ color: brandColor }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {currentEntry.name && (
        <Card className="rounded-[2rem] border-2 border-black/5 bg-white overflow-hidden shadow-xl">
          <div className="bg-black/5 border-b py-3 px-8 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[14px] font-black uppercase text-black">{currentEntry.name}</span>
              <span className="text-[9px] font-black text-black/40 uppercase tracking-widest">{currentEntry.productId}</span>
            </div>
            <Badge variant="outline" className="font-black text-[10px] px-3 bg-green-50 text-green-600 border-green-200">
              DISPONIBLE: {currentEntry.stock}
            </Badge>
          </div>
          <CardContent className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border shrink-0 bg-muted flex items-center justify-center">
                {currentEntry.img ? <img src={currentEntry.img} className="w-full h-full object-cover" /> : <PackageSearch className="w-8 h-8 opacity-20" />}
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-black/40 ml-1">PRECIO</Label>
                    <Input type="number" className="h-10 text-xs font-black rounded-xl border-black/10" value={currentEntry.price} onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:col-span-2">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-black/40 ml-1">CANTIDAD</Label>
                      <div className="flex gap-1">
                        <Input type="number" className="h-10 text-xs font-black rounded-xl" style={{ borderColor: brandColor }} value={currentEntry.quantity} onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value})} />
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => {
                          setCalcData({ 
                            unidades: currentEntry.calcUnidades || "", 
                            series: currentEntry.calcSeries || "", 
                            libres: currentEntry.calcLibres || "" 
                          });
                          setIsCalcOpen(true);
                        }}>
                          <Calculator className="w-4 h-4" style={{ color: brandColor }} />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-black/40 ml-1">DSCTO</Label>
                      <Input type="number" className="h-10 text-xs font-black border-orange-200 bg-orange-50 text-orange-600 rounded-xl" value={currentEntry.discount} onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-black/40 ml-1">DESCRIPCIÓN / NOTAS</Label>
                  <Input className="h-10 text-[10px] font-normal uppercase bg-black/5 border-none rounded-xl" value={currentEntry.description} onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} />
                </div>
              </div>
            </div>
            <Button className="w-full h-12 bg-black text-white rounded-2xl font-black text-xs uppercase" onClick={addCurrentToList}>
              <Plus className="w-4 h-4 mr-2" /> AGREGAR A LA LISTA
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
        <div className="bg-black/5 border-b py-3 px-6"><span className="text-[10px] font-black uppercase text-black tracking-widest">LISTA DE PRODUCTOS</span></div>
        <div className="divide-y divide-black/5">
          {items.length === 0 ? (
            <div className="p-12 text-center opacity-20 font-black uppercase text-xs">Sin prendas en la lista</div>
          ) : items.map((item) => (
            <div key={item.id} className="p-4 md:px-8 hover:bg-black/[0.01] transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[12px] text-black uppercase">{item.name}</span>
                  <Badge variant="outline" className="text-[7px] font-black py-0 px-2 uppercase border-black/10">{item.productId}</Badge>
                </div>
                <div className="font-headline font-black text-sm text-black">
                  S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(2)}
                </div>
              </div>
              <div className="flex justify-between items-end mt-1">
                <div className="text-[9px] font-normal uppercase text-black/50 leading-relaxed">
                  <div className="font-black text-black/70 mb-0.5">{item.description || "Sin descripción"}</div>
                  <div className="flex gap-2 items-center">
                    <span className="font-black" style={{ color: brandColor }}>{item.quantity} UND</span>
                    <span className="opacity-30">×</span>
                    <span>S/ {item.price}</span>
                    {Number(item.discount) > 0 && (
                      <>
                        <span className="opacity-30">|</span>
                        <span className="text-red-600 font-black">DESC. - S/ {item.discount}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-black/20 hover:text-destructive" onClick={() => setItems(items.filter(i => i.id !== item.id))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 pt-6 gap-6">
        <div className="w-full md:w-auto space-y-1">
          <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">CANTIDAD TOTAL</div>
          <div className="font-headline font-black text-4xl text-black">{items.reduce((acc, i) => acc + Number(i.quantity), 0)} <span className="text-sm">UND</span></div>
        </div>
        <div className="w-full md:w-auto text-left md:text-right space-y-1">
          <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">MONTO TOTAL NETO</div>
          <div className="font-headline font-black text-5xl md:text-6xl text-black tracking-tighter">S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(2)}</div>
        </div>
      </div>

      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-xs">
          <DialogHeader><DialogTitle className="text-xs font-black text-black uppercase tracking-widest">Calculadora de Series</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black/60">Unid x Serie</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-10 text-xs font-black text-center" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black/60">N° Series</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-10 text-xs font-black text-center" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black/60">+ Unid Libres</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-10 text-xs font-black text-center" /></div>
            
            <div className="bg-black/5 p-4 rounded-xl text-center">
              <div className="text-[8px] font-black uppercase text-black/40 mb-1">Total Calculado</div>
              <div className="text-2xl font-black text-black">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} UND</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl font-black text-[9px] uppercase" onClick={() => setIsCalcOpen(false)}>CANCELAR</Button>
              <Button className="bg-black text-white rounded-xl font-black text-[9px] uppercase" onClick={handleApplyCalc}>CONFIRMAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
