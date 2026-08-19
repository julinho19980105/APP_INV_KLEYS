
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  ShoppingCart, 
  Save, 
  Printer, 
  Loader2, 
  UserPlus, 
  PackageSearch,
  Check,
  X,
  Edit2,
  ChevronDown
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
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
  setDoc
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
}

export default function QuotesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  
  // Plantilla Fija
  const [currentEntry, setCurrentEntry] = React.useState<QuoteItem | null>(null)
  
  // Lista de Productos Agregados
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const fetchNextQuoteId = React.useCallback(async () => {
    if (!db) return
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
  }, [db])

  React.useEffect(() => {
    fetchNextQuoteId()
  }, [fetchNextQuoteId])

  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 2) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
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
      quantity: "1",
      price: prod.priceMayor?.toString() || "0",
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: "0",
      isRegistered: true
    })
    setProductQuery("")
  }

  const selectManualProduct = () => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: "MANUAL",
      name: productQuery.toUpperCase().trim() || "PRODUCTO MANUAL",
      description: "",
      quantity: "1",
      price: "0",
      stock: 9999,
      img: "",
      discount: "0",
      isRegistered: false
    })
    setProductQuery("")
  }

  const addCurrentToList = () => {
    if (!currentEntry) return
    const qty = Number(currentEntry.quantity)
    if (currentEntry.isRegistered && qty > currentEntry.stock) {
      toast({ variant: "destructive", title: "STOCK INSUFICIENTE", description: `Máximo disponible: ${currentEntry.stock}` })
      return
    }
    
    // Si ya existe en la lista y es el mismo producto registrado, lo reemplazamos o sumamos
    const existingIndex = items.findIndex(i => i.productId === currentEntry.productId && i.isRegistered && currentEntry.isRegistered)
    if (existingIndex > -1) {
      const newItems = [...items]
      newItems[existingIndex] = currentEntry
      setItems(newItems)
    } else {
      setItems([...items, currentEntry])
    }
    
    setCurrentEntry(null)
    toast({ title: "AGREGADO A LA LISTA" })
  }

  const handleRegisterSale = async () => {
    if (!db || items.length === 0 || (!selectedCustomer && !customerQuery)) return
    const finalCustomerName = selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery.toUpperCase().trim()
    setSaving(true)
    try {
      await setDoc(doc(db, "quotes", quoteId), {
        id: quoteId,
        customerName: finalCustomerName,
        customerId: selectedCustomer?.id || "GENERIC",
        items: items.map(i => ({...i, quantity: Number(i.quantity || 0), price: Number(i.price || 0), discount: Number(i.discount || 0)})),
        total: finalTotal,
        status: 'active',
        createdAt: serverTimestamp()
      })

      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const qty = Number(item.quantity || 0)
          updateDoc(doc(db, "products", item.productId), { stock: increment(-qty) })
          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: qty,
            reason: `VENTA ${quoteId}`,
            timestamp: serverTimestamp()
          })
        }
      }

      toast({ title: "VENTA REGISTRADA", description: `BOLETA ${quoteId} GUARDADA.` })
      setItems([]); setSelectedCustomer(null); setCustomerQuery(""); fetchNextQuoteId()
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR CRÍTICO" })
    } finally {
      setSaving(false)
    }
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
    <div className="max-w-5xl mx-auto space-y-6 pb-24 pt-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-black text-black uppercase tracking-tight">COTIZACIÓN</h1>
          <Badge variant="outline" className="text-[9px] font-black border-black/20 uppercase tracking-[0.2em] px-3 mt-1">Serie {quoteId}</Badge>
        </div>
        <Button variant="outline" className="rounded-xl border-black text-black font-black h-10" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> TICKET</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BUSCADOR DE CLIENTE */}
        <div className="md:col-span-2 space-y-1">
          <Label className="text-[9px] uppercase text-black font-black tracking-widest ml-1">CLIENTE</Label>
          <div className="relative">
            <Input 
              placeholder="NOMBRE O ID..." 
              className="h-11 text-xs font-black text-black uppercase rounded-xl border-black/10 bg-white"
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

        {/* BUSCADOR DE PRENDAS */}
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-black text-black tracking-widest ml-1">BUSCAR PRENDA (DNI)</Label>
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
                    <div className="w-10 h-10 rounded-lg overflow-hidden border bg-muted shrink-0 shadow-sm">
                      {p.images?.[0] ? <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-full h-full p-2 opacity-20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-[10px] text-black uppercase truncate">{p.name}</div>
                      <div className="text-[7px] font-black text-black/40 uppercase">{p.code} | {p.category} | {p.collection}</div>
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

      {/* PLANTILLA FIJA DE ENTRADA */}
      <Card className="rounded-[2rem] border-2 border-primary/20 bg-white overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-4">
        <div className="bg-primary/5 border-b py-3 px-8 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">Preparación de Prenda</span>
          {currentEntry?.isRegistered && (
            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-black text-[10px] px-3">STOCK: {currentEntry.stock}</Badge>
          )}
        </div>
        <CardContent className="p-8 space-y-6">
          {currentEntry ? (
            <div className="space-y-6">
              {/* LÍNEA 1: DATOS NUMÉRICOS */}
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border shrink-0 bg-muted shadow-md">
                  {currentEntry.img ? <img src={getThumbnailUrl(currentEntry.img)} className="w-full h-full object-cover" /> : <PackageSearch className="w-full h-full p-4 opacity-10" />}
                </div>
                <div className="flex-1 grid grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <div className="font-black text-sm text-black uppercase truncate">{currentEntry.name}</div>
                    <div className="text-[9px] font-black uppercase text-black/40">{currentEntry.isRegistered ? currentEntry.productId : "REGISTRO MANUAL"}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-black/40 ml-1">P. Unitario</Label>
                    <div className="flex gap-2">
                      <Input type="number" className="h-10 text-xs font-black border-black/10 rounded-xl bg-white" value={currentEntry.price} onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} />
                      {currentEntry.isRegistered && (
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
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Cantidad</Label>
                    <Input type="number" className="h-10 text-xs font-black border-primary/30 bg-primary/5 text-primary rounded-xl" value={currentEntry.quantity} onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Descuento Subtotal</Label>
                    <Input type="number" className="h-10 text-xs font-black border-orange-200 bg-orange-50 text-orange-600 rounded-xl" value={currentEntry.discount} onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* LÍNEA 2: DESCRIPCIÓN */}
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Descripción / Notas Adicionales</Label>
                <Input 
                  placeholder="ESCRIBE AQUÍ CARACTERÍSTICAS DE LA PRENDA..." 
                  className="h-10 text-[10px] font-black uppercase bg-black/5 border-none rounded-xl px-5"
                  value={currentEntry.description}
                  onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})}
                />
              </div>

              {/* LÍNEA 3: ACCIÓN Y SUBTOTAL */}
              <div className="flex justify-between items-center pt-4 border-t border-black/5">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase text-black/40">SUBTOTAL PRENDA:</span>
                  <span className="font-headline font-black text-2xl text-black">S/ {((Number(currentEntry.price || 0) * Number(currentEntry.quantity || 0)) - Number(currentEntry.discount || 0)).toFixed(2)}</span>
                </div>
                <Button className="h-12 px-10 bg-black text-white rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all" onClick={addCurrentToList}>
                  <Plus className="w-4 h-4 mr-2" /> AGREGAR A LA LISTA
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center gap-4 opacity-20">
              <PackageSearch className="w-16 h-16" />
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">Busca una prenda para empezar la carga</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LISTA DE RESUMEN (CARRITO) */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-black uppercase text-black/40 tracking-[0.2em] ml-2">Lista de Resumen</h2>
        <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black/5 border-b">
                  <th className="p-4 text-[9px] font-black uppercase text-black pl-8">#</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black">Prenda</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black">Código</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black text-center">Cant</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black">Precio</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black">Dscto</th>
                  <th className="p-4 text-[9px] font-black uppercase text-black">Subtotal</th>
                  <th className="p-4 text-right pr-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-black/[0.01] transition-colors group">
                    <td className="p-4 pl-8 text-[10px] font-black text-black/30">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-black text-[11px] text-black uppercase">{item.name}</div>
                      <div className="text-[8px] font-black uppercase text-black/40 truncate max-w-[200px]">{item.description || "SIN NOTAS"}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-[8px] font-black border-black/10", !item.isRegistered && "bg-orange-50 text-orange-600 border-orange-200")}>
                        {item.isRegistered ? item.productId : "MANUAL"}
                      </Badge>
                    </td>
                    <td className="p-4 text-center font-black text-xs">{item.quantity}</td>
                    <td className="p-4 font-black text-[10px]">S/ {Number(item.price).toFixed(2)}</td>
                    <td className="p-4 font-black text-[10px] text-orange-600">S/ {Number(item.discount).toFixed(2)}</td>
                    <td className="p-4 font-black text-xs">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(2)}</td>
                    <td className="p-4 text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-black/5" onClick={() => { setCurrentEntry(item); setItems(items.filter(i => i.id !== item.id)); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        
                        {confirmDeleteId === item.id ? (
                          <div className="flex gap-1 animate-in zoom-in duration-200">
                            <button onClick={() => { setItems(items.filter(i => i.id !== item.id)); setConfirmDeleteId(null); }} className="h-8 px-3 bg-destructive text-white rounded-lg text-[8px] font-black uppercase">SÍ</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="h-8 px-3 bg-black/5 text-black rounded-lg text-[8px] font-black uppercase">NO</button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-black/20 hover:text-destructive" onClick={() => setConfirmDeleteId(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-20 text-center opacity-10">
                      <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Lista vacía</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* PIE DE PÁGINA INDUSTRIAL */}
      <div className="space-y-6 pt-6">
        <div className="flex justify-between items-end border-b-4 border-black pb-6">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">PRENDAS TOTALES</div>
            <div className="font-headline font-black text-4xl text-black">{totalQuantity} <span className="text-sm">UND</span></div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[10px] font-black uppercase text-black/40 tracking-widest">MONTO TOTAL NETO</div>
            <div className="font-headline font-black text-6xl text-black tracking-tighter">S/ {finalTotal.toFixed(2)}</div>
          </div>
        </div>

        <Button 
          className="w-full h-16 bg-black text-white hover:bg-black/90 font-black text-lg rounded-[1.5rem] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4" 
          onClick={handleRegisterSale}
          disabled={saving || items.length === 0 || (!selectedCustomer && !customerQuery)}
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          CONFIRMAR VENTA DIVA
        </Button>
      </div>
    </div>
  )
}
