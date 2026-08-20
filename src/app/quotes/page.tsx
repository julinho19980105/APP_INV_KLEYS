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
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection } from "@/firebase"
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
  // Campos de calculadora para re-edición
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
  
  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  
  const [currentEntry, setCurrentEntry] = React.useState<QuoteItem>(EMPTY_ENTRY)
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [originalItems, setOriginalItems] = React.useState<QuoteItem[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  // Estados para la calculadora
  const [isCalcOpen, setIsCalcOpen] = React.useState(false)
  const [calcData, setCalcData] = React.useState({ unidades: "", series: "", libres: "" })

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const fetchNextQuoteId = React.useCallback(async () => {
    if (!db || editId) return
    const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const lastId = snap.docs[0].id
      const match = lastId.match(/\d+/)
      const lastNum = match ? parseInt(match[0]) : 0
      setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
    } else {
      setQuoteId("B-001")
    }
  }, [db, editId])

  const loadQuoteForEdit = React.useCallback(async () => {
    if (!db || !editId) return
    const docSnap = await getDoc(doc(db, "quotes", editId))
    if (docSnap.exists()) {
      const data = docSnap.data()
      setQuoteId(data.id)
      setCustomerQuery(data.customerName)
      if (data.customerId && data.customerId !== "GENERIC") {
        setSelectedCustomer({ id: data.customerId, name: data.customerName.split(' [')[0] })
        setCustomerQuery("")
      }
      
      const loadedItems = data.items.map((i: any) => ({
        ...i,
        quantity: i.quantity.toString(),
        price: i.price.toString(),
        discount: i.discount.toString(),
        stock: (dbProducts.find(p => p.code === i.productId)?.stock || 0)
      }))
      setItems(loadedItems)
      setOriginalItems(loadedItems)
    }
  }, [db, editId, dbProducts])

  React.useEffect(() => {
    if (editId) {
      loadQuoteForEdit()
    } else {
      fetchNextQuoteId()
    }
  }, [editId, fetchNextQuoteId, loadQuoteForEdit])

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

  const handleRegisterCustomer = async () => {
    if (!db || !customerQuery.trim()) return
    setSaving(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const match = lastId.match(/\d+/)
        const lastNum = match ? parseInt(match[0]) : 0
        nextId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }
      const name = customerQuery.toUpperCase().trim()
      await setDoc(doc(db, "customers", nextId), { id: nextId, name, createdAt: serverTimestamp() })
      setSelectedCustomer({ id: nextId, name })
      setCustomerQuery("")
      toast({ title: "CLIENTE REGISTRADO", description: `${name} [${nextId}]` })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    } finally {
      setSaving(false)
    }
  }

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

  const selectManualProduct = () => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: "MANUAL",
      name: productQuery.toUpperCase().trim() || "PRODUCTO MANUAL",
      description: "",
      quantity: "",
      price: "",
      stock: 99999,
      img: "",
      discount: "",
      isRegistered: false,
      calcUnidades: "",
      calcSeries: "",
      calcLibres: "",
      manualNote: ""
    })
    setProductQuery("")
  }

  const addCurrentToList = () => {
    if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) {
      toast({ variant: "destructive", title: "FALTAN DATOS" })
      return
    }
    const qty = Number(currentEntry.quantity)
    if (currentEntry.isRegistered && qty > currentEntry.stock) {
      toast({ variant: "destructive", title: "STOCK INSUFICIENTE", description: `Disponibles: ${currentEntry.stock}` })
      return
    }
    
    const existingIndex = items.findIndex(i => i.productId === currentEntry.productId && i.isRegistered && currentEntry.isRegistered)
    if (existingIndex > -1) {
      const newItems = [...items]
      newItems[existingIndex] = { ...currentEntry }
      setItems(newItems)
    } else {
      setItems([...items, { ...currentEntry }])
    }
    
    setCurrentEntry(EMPTY_ENTRY)
    toast({ title: "AÑADIDO" })
  }

  const handleRegisterSale = async () => {
    if (!db || items.length === 0 || (!selectedCustomer && !customerQuery)) return
    const finalCustomerName = selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery.toUpperCase().trim()
    setSaving(true)
    
    try {
      if (editId && originalItems.length > 0) {
        for (const item of originalItems) {
          if (item.isRegistered && item.productId !== "MANUAL") {
            const qty = Number(item.quantity)
            await updateDoc(doc(db, "products", item.productId), { stock: increment(qty) })
            await addDoc(collection(db, "movements"), {
              productCode: item.productId,
              type: "return",
              quantity: qty,
              reason: `EDICIÓN BOLETA ${quoteId} - RETORNO STOCK`,
              timestamp: serverTimestamp()
            })
          }
        }
      }

      await setDoc(doc(db, "quotes", quoteId), {
        id: quoteId,
        customerName: finalCustomerName,
        customerId: selectedCustomer?.id || "GENERIC",
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          description: i.description,
          quantity: Number(i.quantity || 0),
          price: Number(i.price || 0),
          discount: Number(i.discount || 0),
          img: i.img || "",
          isRegistered: i.isRegistered
        })),
        total: finalTotal,
        status: 'active',
        createdAt: serverTimestamp()
      })

      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const qty = Number(item.quantity || 0)
          await updateDoc(doc(db, "products", item.productId), { stock: increment(-qty) })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: qty,
            reason: `${editId ? 'EDICIÓN' : 'VENTA'} ${quoteId} - ${finalCustomerName}`,
            timestamp: serverTimestamp()
          })
        }
      }

      toast({ title: "VENTA PROCESADA" })
      router.push('/sales')
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    } finally {
      setSaving(false)
    }
  }

  // Lógica de Calculadora
  const handleOpenCalc = () => {
    setCalcData({
      unidades: currentEntry.calcUnidades || "",
      series: currentEntry.calcSeries || "",
      libres: currentEntry.calcLibres || ""
    })
    setIsCalcOpen(true)
  }

  const handleApplyCalc = () => {
    const u = Number(calcData.unidades || 0)
    const s = Number(calcData.series || 0)
    const l = Number(calcData.libres || 0)
    const total = (u * s) + l
    
    let autoDesc = `${u} UNID X ${s} SERIES`
    if (l > 0) autoDesc += ` + ${l}`
    autoDesc += ". "

    setCurrentEntry({
      ...currentEntry,
      quantity: total.toString(),
      description: autoDesc + (currentEntry.manualNote || ""),
      calcUnidades: calcData.unidades,
      calcSeries: calcData.series,
      calcLibres: calcData.libres
    })
    setIsCalcOpen(false)
  }

  const totalQuantity = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)
  const finalTotal = items.reduce((acc, item) => {
    const lineSub = Number(item.quantity || 0) * Number(item.price || 0)
    return acc + (lineSub - Number(item.discount || 0))
  }, 0)

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    return idMatch ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=300` : url;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 pt-2 px-2 md:px-0">
      <div className="flex justify-between items-end border-b-2 border-black pb-4">
        <div>
          <h1 className="text-4xl font-headline font-black text-black uppercase tracking-tight">COTIZACIÓN</h1>
          <Badge variant="outline" className="text-[9px] font-black border-black/20 uppercase tracking-[0.2em] px-3 mt-1">SERIE {quoteId}</Badge>
        </div>
        {editId && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl"
            onClick={() => router.push('/sales')}
          >
            <X className="w-6 h-6" />
          </Button>
        )}
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
            {customerQuery.length >= 2 && !selectedCustomer && (
              <button onClick={handleRegisterCustomer} className="absolute right-2 top-2.5 h-6 w-6 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform"><UserPlus className="w-3.5 h-3.5" /></button>
            )}
            {customerSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-2xl overflow-hidden">
                {customerSuggestions.map(c => (
                  <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-black/5 flex justify-between border-b last:border-0" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                    <span className="text-[10px] font-black uppercase text-black">{c.name} <span className="text-primary ml-1">[{c.id}]</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-black text-black ml-1">BUSCAR PRENDA</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="DNI O NOMBRE..." 
              className="pl-9 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white" 
              value={productQuery} 
              onChange={e => setProductQuery(e.target.value)} 
            />
            {productQuery.length >= 2 && (
              <div className="absolute z-50 w-full mt-2 bg-white border rounded-2xl shadow-2xl overflow-hidden right-0">
                {productSuggestions.map(p => (
                  <button key={p.code} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-3 border-b last:border-0" onClick={() => selectProductForEntry(p)}>
                    <div className="w-10 h-10 rounded-lg overflow-hidden border bg-muted shrink-0">
                      {p.images?.[0] ? <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-full h-full p-2 opacity-20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-[10px] text-black uppercase truncate">{p.name}</div>
                      <div className="text-[7px] font-black text-black/40 uppercase">{p.code} | {p.category}</div>
                    </div>
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))}
                <button className="w-full px-4 py-3 bg-primary/5 hover:bg-primary/10 text-primary font-black text-[9px] uppercase flex items-center justify-center gap-2" onClick={selectManualProduct}>
                  <Plus className="w-3 h-3" /> AGREGAR MANUAL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="rounded-[2rem] border-2 border-primary/20 bg-white overflow-hidden shadow-xl">
        <div className="bg-primary/5 border-b py-3 px-8 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">PREPARACIÓN DE PRENDA</span>
          {currentEntry.name && (
            <Badge variant="outline" className={cn("font-black text-[10px] px-3", currentEntry.isRegistered ? "bg-green-50 text-green-600 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200")}>
              {currentEntry.isRegistered ? `STOCK: ${currentEntry.stock}` : 'REGISTRO MANUAL'}
            </Badge>
          )}
        </div>
        <CardContent className="p-4 md:p-8 space-y-6">
          {currentEntry.name && (
            <div className="border-b pb-4 mb-2">
              <h2 className="text-lg font-black text-black uppercase tracking-tight">{currentEntry.name}</h2>
              <span className="text-[8px] font-black text-black/40 uppercase tracking-widest">{currentEntry.isRegistered ? currentEntry.productId : 'PRODUCTO MANUAL'}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border shrink-0 bg-muted shadow-md mx-auto md:mx-0">
              {currentEntry.img ? <img src={getThumbnailUrl(currentEntry.img)} className="w-full h-full object-cover" alt="" /> : <PackageSearch className="w-full h-full p-5 opacity-10" />}
            </div>
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">PRECIO UNITARIO</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    className="h-10 text-xs font-black border-black/10 rounded-xl bg-white" 
                    value={currentEntry.price} 
                    onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} 
                  />
                  {currentEntry.isRegistered && currentEntry.productId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-black/10 rounded-xl"><ChevronDown className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-xl font-black text-[10px] uppercase p-2">
                        {dbProducts.find(p => p.code === currentEntry.productId) && (
                          <>
                            <DropdownMenuItem onClick={() => setCurrentEntry({...currentEntry, price: dbProducts.find(p => p.code === currentEntry.productId).priceFardo.toString()})}>Fardo: {dbProducts.find(p => p.code === currentEntry.productId).priceFardo}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCurrentEntry({...currentEntry, price: dbProducts.find(p => p.code === currentEntry.productId).priceMayor.toString()})}>Mayor: {dbProducts.find(p => p.code === currentEntry.productId).priceMayor}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCurrentEntry({...currentEntry, price: dbProducts.find(p => p.code === currentEntry.productId).priceUnidad.toString()})}>Unidad: {dbProducts.find(p => p.code === currentEntry.productId).priceUnidad}</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-black/40 ml-1">CANTIDAD</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      className="h-10 text-xs font-black border-primary/30 bg-primary/5 text-primary rounded-xl" 
                      value={currentEntry.quantity} 
                      onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value})} 
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 shrink-0 border-primary/20 bg-primary/5 text-primary rounded-xl"
                      onClick={handleOpenCalc}
                      disabled={!currentEntry.name}
                    >
                      <Calculator className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-black/40 ml-1">DSCTO</Label>
                  <Input 
                    type="number" 
                    className="h-10 text-xs font-black border-orange-200 bg-orange-50 text-orange-600 rounded-xl" 
                    value={currentEntry.discount} 
                    onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[8px] font-black uppercase text-black/40 ml-1">DESCRIPCIÓN / NOTAS</Label>
            <Input 
              className="h-10 text-[10px] font-black uppercase bg-black/5 border-none rounded-xl px-5"
              value={currentEntry.description}
              onChange={e => {
                const val = e.target.value
                // Intentamos separar la nota manual de lo automático si existe el punto final
                const splitIndex = val.indexOf('. ')
                const manual = splitIndex > -1 ? val.substring(splitIndex + 2) : val
                setCurrentEntry({...currentEntry, description: val, manualNote: manual})
              }}
              placeholder=""
            />
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-black/5">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black uppercase text-black/40">SUBTOTAL LÍNEA:</span>
              <span className="font-headline font-black text-2xl text-black">
                S/ {((Number(currentEntry.price || 0) * Number(currentEntry.quantity || 0)) - Number(currentEntry.discount || 0)).toFixed(2)}
              </span>
            </div>
            <Button 
              className="w-full md:w-auto h-12 px-10 bg-black text-white rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all" 
              onClick={addCurrentToList}
              disabled={!currentEntry.name}
            >
              <Plus className="w-4 h-4 mr-2" /> AGREGAR A LA LISTA
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
        <div className="bg-black/5 border-b py-3 px-6">
          <span className="text-[10px] font-black uppercase text-black tracking-widest uppercase">LISTA DE PRODUCTOS</span>
        </div>
        <div className="divide-y divide-black/5">
          {items.map((item) => (
            <div key={item.id} className="p-4 md:px-8 hover:bg-black/[0.01] transition-colors group relative">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-black text-[12px] text-black uppercase truncate">{item.name}</span>
                  <Badge variant="outline" className={cn("text-[8px] font-black border-black/10 shrink-0", !item.isRegistered && "bg-orange-50 text-orange-600 border-orange-200")}>
                    {item.isRegistered ? item.productId : "MANUAL"}
                  </Badge>
                </div>
                <div className="font-headline font-black text-sm text-black ml-4 shrink-0">
                  S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(2)}
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="text-[9px] font-black uppercase text-black/50 space-x-2">
                  <span className="text-black/70">{item.description || ""}</span>
                  <span className="text-black/20">|</span>
                  <span className="text-primary">{item.quantity} UND</span>
                  <span>×</span>
                  <span>S/ {Number(item.price).toFixed(2)}</span>
                  {Number(item.discount) > 0 && (
                    <>
                      <span className="text-black/20">|</span>
                      <span className="text-destructive">- S/ {Number(item.discount).toFixed(2)} DESC</span>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-black/5" onClick={() => { setCurrentEntry(item); setItems(items.filter(i => i.id !== item.id)); }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  {confirmDeleteId === item.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => { setItems(items.filter(i => i.id !== item.id)); setConfirmDeleteId(null); }} className="h-7 px-2 bg-destructive text-white rounded-lg text-[8px] font-black uppercase">SÍ</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="h-7 px-2 bg-black/5 text-black rounded-lg text-[8px] font-black uppercase">NO</button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-black/20 hover:text-destructive" onClick={() => setConfirmDeleteId(item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-20 text-center text-[10px] font-black uppercase text-black/20 tracking-[0.2em]">
              Sin productos agregados
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 pt-6 gap-6">
        <div className="w-full md:w-auto space-y-1">
          <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">CANTIDAD TOTAL</div>
          <div className="font-headline font-black text-4xl text-black">{totalQuantity} <span className="text-sm">UND</span></div>
        </div>
        <div className="w-full md:w-auto text-left md:text-right space-y-1">
          <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">MONTO TOTAL NETO</div>
          <div className="font-headline font-black text-5xl md:text-6xl text-black tracking-tighter">S/ {finalTotal.toFixed(2)}</div>
        </div>
      </div>

      <Button 
        className="w-full h-16 bg-black text-white hover:bg-black/90 font-black text-lg rounded-[1.5rem] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4" 
        onClick={handleRegisterSale}
        disabled={saving || items.length === 0 || (!selectedCustomer && !customerQuery)}
      >
        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
        GUARDAR VENTA
      </Button>

      {/* Modal de Calculadora Industrial */}
      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-xs font-black text-black uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" /> Calculadora de Series
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-black/60 ml-1">Unid x Serie</Label>
                <Input 
                  type="number" 
                  value={calcData.unidades} 
                  onChange={e => setCalcData({...calcData, unidades: e.target.value})} 
                  className="h-10 text-xs font-black rounded-xl border-black/10 text-center"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-black/60 ml-1">N° Series</Label>
                <Input 
                  type="number" 
                  value={calcData.series} 
                  onChange={e => setCalcData({...calcData, series: e.target.value})} 
                  className="h-10 text-xs font-black rounded-xl border-black/10 text-center"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase text-black/60 ml-1">+ Unid Libres</Label>
              <Input 
                type="number" 
                value={calcData.libres} 
                onChange={e => setCalcData({...calcData, libres: e.target.value})} 
                className="h-10 text-xs font-black rounded-xl border-black/10 text-center"
              />
            </div>
            <div className="bg-black/5 p-4 rounded-2xl text-center">
              <span className="text-[9px] font-black uppercase text-black/40 block mb-1">TOTAL CALCULADO</span>
              <span className="font-headline font-black text-3xl text-primary">
                {(Number(calcData.unidades || 0) * Number(calcData.series || 0)) + Number(calcData.libres || 0)} <span className="text-xs">UND</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                variant="outline" 
                className="h-12 rounded-xl font-black text-[10px] uppercase border-black/10"
                onClick={() => setIsCalcOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                className="h-12 bg-black text-white rounded-xl font-black text-[10px] uppercase"
                onClick={handleApplyCalc}
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
